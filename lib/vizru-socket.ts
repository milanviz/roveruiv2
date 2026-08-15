"use client";

/**
 * The platform's realtime socket — the legacy socket.io server, not the live
 * agent relay.
 *
 * This is how a Realtime Push block reaches the browser. The workflow posts to
 * the socket server's `/emit_block`, which finds the sockets belonging to the
 * identifier the block names and emits the block's `tags` value as the event
 * name, carrying the block's variables as the payload. So a screen subscribes
 * by tag and receives whatever that workflow pushed.
 *
 * Two things about this server are not negotiable:
 *
 *  1. **It is socket.io 2.3.** The wire protocol changed in v3, so a v3 or v4
 *     client cannot talk to it at all — it fails the handshake rather than
 *     degrading. `socket.io-client` is pinned to ^2.5 for that reason.
 *
 *  2. **WebSocket only.** The server sets `transports: ["websocket"]` and
 *     `upgrade: false`, so a client that starts on polling never connects.
 *
 * Authentication is in two parts, and they are easy to confuse:
 *
 *  - **The handshake** carries a fixed token, verified by `socketio-jwt`
 *    against the socket server's own secret — not the platform's. A platform
 *    user JWT sent here comes back as
 *    `{"code":"invalid_token","message":"invalid signature"}`. It is a shared
 *    gate; it says nothing about who is connecting.
 *
 *  - **Identity** is the `vizru_user` event, sent once connected. That is what
 *    sets `viz_userId` on the server, and what a Realtime Push addressed to a
 *    user is matched against.
 *
 * chatv2 is a different server with a different scheme (`authorization` plus
 * `tenent_id`, a real per-user token). The query below carries both so that
 * pointing at either is a URL change and nothing more — but note that a
 * Realtime Push block only ever reaches the legacy server.
 */

import io from "socket.io-client";

import { APP_CONFIG } from "@/app/config/config";
import { getAuthFromStorage } from "@/lib/auth";

type Handler = (payload: any) => void;

export type SocketState = "idle" | "connecting" | "connected" | "error";

let socket: any = null;
let state: SocketState = "idle";

/**
 * Bumped whenever the connection is torn down.
 *
 * Minting the token is a round trip, so a disconnect can land while a connect
 * is still waiting on it. Without this the in-flight connect would go on to
 * create a socket nobody asked for — and in React's development double-mount
 * that is a second live connection.
 */
let generation = 0;

/**
 * Tag -> handlers.
 *
 * Kept here rather than binding each caller straight onto the socket so that
 * several components can listen to one tag, and so subscriptions survive a
 * reconnect: socket.io drops its listeners when the underlying connection is
 * replaced, and re-registering from this map is what makes that invisible.
 */
const handlers = new Map<string, Set<Handler>>();

/** Tags already attached to the current socket instance. */
const boundTags = new Set<string>();

const stateListeners = new Set<(value: SocketState) => void>();

function setState(value: SocketState) {
  if (value === state) return;
  state = value;
  stateListeners.forEach((listener) => listener(value));
}

/** The socket server's public origin. */
function socketUrl(): string {
  return APP_CONFIG.SOCKET_URL;
}

/**
 * Get the JWT the socket handshake is authenticated with.
 *
 * Deliberately not the token from `lib/auth.ts`. The socket server verifies
 * against its own secret, so the API token does not satisfy it — a handshake
 * carrying the wrong one is refused before any event is delivered, which looks
 * from the outside like a socket that connects and then goes quiet.
 *
 * The response shape is whatever the workflow's last block outputs, so the
 * field is looked for under the spellings the platform's token workflows
 * actually use rather than assuming one.
 */
async function fetchSocketToken(): Promise<string> {
  const url = `${APP_CONFIG.PUBLIC_API_URL}${APP_CONFIG.SOCKET_TOKEN_WF}`;

  const response = await fetch(url, { method: "POST", body: new FormData() });
  if (!response.ok) {
    throw new Error(`socket token workflow answered ${response.status}`);
  }

  const data = await response.json();
  const row = Array.isArray(data) ? data[0] : data;

  // `Token` is what this workflow returns; the rest are the spellings the
  // platform's other token workflows use, kept so a rebuilt workflow does not
  // silently stop working.
  const token =
    row?.Token || row?.jwt || row?.token || row?.value || row?.jwtToken || row?.JwtToken || "";

  if (!token) {
    // Print what did come back: the workflow is editable, and a renamed output
    // field is the likeliest reason this stops working.
    console.error("[vizru-socket] no token in the workflow response", data);
    throw new Error("the socket token workflow returned no token");
  }

  return token;
}

/**
 * Read the claims out of a JWT.
 *
 * No verification — the platform signed it and the server will check it. This
 * only reads what we were handed.
 */
function decodeJwtClaims(token: string): Record<string, any> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;

    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));

    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Announce who this connection belongs to.
 *
 * Identity comes from the socket token's own claims, not from `lib/auth.ts`.
 * That is deliberate: in development `mock-fetch` intercepts the auth workflow
 * and stores a placeholder user, so the storage route announced `usr-guest`
 * with an empty tenant — the socket connected, joined a room nobody pushes to,
 * and sat there receiving nothing. The token the platform minted for this
 * socket already says exactly who it is for, and cannot disagree with itself.
 */
function announceUser(socketToken: string) {
  if (!socket) return;

  const claims = decodeJwtClaims(socketToken);
  const stored = getAuthFromStorage();

  const id = claims?.uid || stored.userId;
  const email = claims?.email || stored.userEmail;
  const username = claims?.fname || stored.loginUserName || email;

  socket.emit("vizru_user", {
    id,
    tid: APP_CONFIG.TENANT_ID,
    username,
    email,
    // The server uses this for its own API callbacks, so it has to be a token
    // the platform will accept — the socket token is one, the mock is not.
    auth_token: socketToken || stored.token,
  });

  console.log(`[vizru-socket] identified as ${username} (${id})`);
}

/** Attach one tag to the live socket. */
function bind(tag: string) {
  if (!socket || boundTags.has(tag)) return;
  boundTags.add(tag);

  socket.on(tag, (payload: any) => {
    const set = handlers.get(tag);
    if (!set) return;

    // A throwing handler must not take the others down with it — they are
    // unrelated screens that happen to share a tag.
    set.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[vizru-socket] handler for "${tag}" threw`, error);
      }
    });
  });
}

/**
 * Open the connection, or do nothing if it is already open.
 *
 * Safe to call from several places and on every render; the first caller with a
 * token wins and the rest are no-ops.
 */
export async function connectVizruSocket(): Promise<void> {
  if (typeof window === "undefined") return;
  // `connecting` as well as `socket`: minting the token is a round trip, and
  // without this a second caller during that window opens a second connection.
  if (socket || state === "connecting") return;

  const url = socketUrl();
  if (!url) {
    console.warn("[vizru-socket] no socket URL configured; realtime is off");
    return;
  }

  setState("connecting");

  const attempt = generation;

  // Best effort, deliberately. Only chatv2 needs a per-user token; the legacy
  // server authenticates the handshake with a fixed value and would connect
  // perfectly well without this. Failing the whole connection because the user
  // token could not be minted would take realtime down for the server that
  // never wanted it.
  let userToken = "";
  try {
    userToken = await fetchSocketToken();
  } catch (error) {
    console.warn(
      "[vizru-socket] no per-user token; connecting anyway (only chatv2 requires one)",
      error,
    );
  }

  // Torn down, or another caller finished, while the token was in flight.
  if (socket || attempt !== generation) {
    if (attempt !== generation) setState("idle");
    return;
  }

  socket = io(url, {
    // The server refuses anything that is not a raw WebSocket.
    transports: ["websocket"],
    upgrade: false,
    // The same credential under all three names, because the two socket
    // servers spell it differently and this way the URL is the only thing that
    // has to change to point at either:
    //
    //   legacy  chat-react-app    ?token=…                    (socketio-jwt)
    //   v2      chatv2-react-app  ?authorization=…&tenent_id=…
    //
    // Each server reads the one it wants and ignores the rest. `tenent_id` is
    // spelled the way the server spells it, not the way it should be.
    query: {
      // Legacy: a fixed gate token, signed with that server's own secret.
      token: APP_CONFIG.SOCKET_HANDSHAKE_TOKEN,
      // chatv2: the platform's per-user token, plus the tenant.
      authorization: userToken,
      tenent_id: APP_CONFIG.TENANT_ID,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    // The path is the socket.io default; the platform does not override it.
    forceNew: false,
  });

  socket.on("connect", () => {
    setState("connected");
    console.log("[vizru-socket] connected");

    announceUser(userToken);
    // Re-attach every tag: this runs again after a reconnect, and the previous
    // socket's listeners went with it.
    handlers.forEach((_set, tag) => bind(tag));
  });

  socket.on("disconnect", (reason: string) => {
    setState("connecting");
    console.log(`[vizru-socket] disconnected (${reason})`);
  });

  socket.on("connect_error", (error: any) => {
    setState("error");
    console.error("[vizru-socket] connect error", error?.message || error);
  });

  socket.on("error", (error: any) => {
    // The server sends this for a rejected token, which is worth separating
    // from a network failure because it never resolves by retrying.
    setState("error");
    console.error("[vizru-socket] server error", error);
  });
}

/** Close the connection and forget the subscriptions. */
export function disconnectVizruSocket(): void {
  // Bumped first, so a connect still waiting on its token abandons quietly.
  generation++;

  if (!socket) {
    boundTags.clear();
    handlers.clear();
    setState("idle");
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  boundTags.clear();
  handlers.clear();
  setState("idle");
}

/**
 * Re-authenticate after the JWT is refreshed.
 *
 * The token is checked once at handshake, so a refreshed token only takes
 * effect on a new connection. Subscriptions are deliberately preserved.
 */
export async function reconnectVizruSocket(): Promise<void> {
  const kept = new Map(handlers);

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  boundTags.clear();
  handlers.clear();
  setState("idle");

  await connectVizruSocket();
  kept.forEach((set, tag) => {
    handlers.set(tag, set);
    bind(tag);
  });
}

/**
 * Listen for one Realtime Push tag.
 *
 * The tag is whatever the block's **Socket Event Tag** is set to — `new_message`
 * unless the author changed it. The payload is the block's variables, already
 * parsed.
 *
 * @returns an unsubscribe function
 */
export function onVizruEvent(tag: string, handler: Handler): () => void {
  if (!handlers.has(tag)) {
    handlers.set(tag, new Set());
    // Only bind the tag to the socket the first time anyone asks for it, so a
    // popular tag does not accumulate duplicate socket listeners.
    bind(tag);
  }

  handlers.get(tag)!.add(handler);

  return () => {
    const set = handlers.get(tag);
    if (!set) return;

    set.delete(handler);
    // The tag stays bound even when empty: socket.io v2 has no way to remove a
    // single listener added as a closure, and an empty set costs nothing.
  };
}

export function getVizruSocketState(): SocketState {
  return state;
}

/** Wait until the shared socket can receive events, with a bounded fallback. */
export async function waitForVizruSocketConnection(timeoutMs = 12000): Promise<boolean> {
  await connectVizruSocket();
  if (state === "connected") return true;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (connected: boolean) => {
      if (settled) return;
      settled = true;
      stateListeners.delete(listener);
      window.clearTimeout(timer);
      resolve(connected);
    };
    const listener = (value: SocketState) => {
      if (value === "connected") finish(true);
      else if (value === "error") finish(false);
    };
    const timer = window.setTimeout(() => finish(false), timeoutMs);

    stateListeners.add(listener);
    listener(state);
  });
}

export function onVizruSocketState(listener: (value: SocketState) => void): () => void {
  stateListeners.add(listener);
  listener(state);
  return () => stateListeners.delete(listener);
}
