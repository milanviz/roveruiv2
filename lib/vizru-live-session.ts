"use client";

/**
 * Live voice through the Vizru platform.
 *
 * One call runs a workflow whose Agent Node is in live mode; it returns a
 * session id and a short-lived join token, and the browser dials the platform's
 * media relay with those and streams audio. The browser holds no provider key
 * and declares no tools — instructions and the tool list are assembled
 * server-side from the block's properties, so nothing here can influence them.
 *
 * What the browser *does* own is carrying out tool calls the platform routes
 * back down: see `registerClientTool`. The platform decides which tools exist
 * and whether the model may call them; this side only executes.
 *
 * Leg A carries an 8-byte little-endian header, then the payload:
 *
 *     0        1        2        4                8
 *     type u8  flags u8 seq u16  ts_ms u32        PCM16LE / JSON
 *
 * Little-endian so a DataView reads it with no byte swapping.
 */

import { APP_CONFIG } from "@/app/config/config";
import { WORKFLOW_LINKS } from "@/lib/workflow-links";
import { getAuthFromStorage } from "@/lib/auth";

const FRAME = {
  AUDIO_IN: 0x01,
  AUDIO_OUT: 0x02,
  CONTROL: 0x10,
  HEADER_BYTES: 8,
  SEQ_MODULO: 65536,
} as const;

export interface SessionHandle {
  session_id: string;
  token: string;
  socket_url: string;
  socket_ns: string;
  room: string;
  modalities?: string;
  transport?: string;
}

export type VoiceState =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "ended";

export interface LiveCallbacks {
  onState?: (state: VoiceState) => void;
  onTranscript?: (text: string, role: "user" | "assistant", final: boolean) => void;
  onToolActivity?: (name: string, status: string, label?: string) => void;
  onEnded?: (reason: string) => void;
  onError?: (message: string) => void;
  onLog?: (message: string) => void;
}

/* -------------------------------------------------------------------------- */
/*  Client tools                                                              */
/* -------------------------------------------------------------------------- */

export type ClientToolHandler = (
  args: Record<string, unknown>,
) => unknown | Promise<unknown>;

const clientTools = new Map<string, ClientToolHandler>();

/**
 * Let the agent do something in this browser.
 *
 * The tool must also be declared on the Agent Node's `live_client_tools`, which
 * is what the model is actually offered — registering here without declaring it
 * there means the model never calls it, and declaring it there without
 * registering here means the call arrives and is refused. The platform owns the
 * contract; this is the implementation of one end of it.
 *
 * @returns an unregister function, for effect cleanup
 */
export function registerClientTool(name: string, handler: ClientToolHandler): () => void {
  clientTools.set(name, handler);
  return () => {
    if (clientTools.get(name) === handler) clientTools.delete(name);
  };
}

/* -------------------------------------------------------------------------- */
/*  Module state — one call at a time                                         */
/* -------------------------------------------------------------------------- */

let socket: WebSocket | null = null;

/** Set synchronously at the first click, so a second cannot race the first. */
let starting = false;

let audioContext: AudioContext | null = null;
let capture: AudioWorkletNode | null = null;
let playback: AudioWorkletNode | null = null;
let micStream: MediaStream | null = null;

let seq = 0;
let muted = false;
let assistantSpeaking = false;
let assistantSpeakingSince = 0;
let underruns = 0;
let callbacks: LiveCallbacks = {};

/**
 * How long after the agent starts speaking a local barge-in is ignored.
 *
 * Speech onset is the loudest moment of a reply and where the echo canceller
 * leaks most, so it is when a false barge-in is likeliest — and a false
 * barge-in flushes the buffer and eats the reply. A real interruption in this
 * window still arrives from the provider a moment later and does flush.
 */
const BARGE_IN_GUARD_MS = 400;

const log = (message: string) => {
  console.log("[vizru-live]", message);
  callbacks.onLog?.(message);
};

/**
 * Single owner of "is the agent talking".
 *
 * The capture worklet needs it to duck the microphone and the barge-in guard
 * needs its onset time; setting it in one place stops those from disagreeing.
 */
function setAssistantSpeaking(value: boolean) {
  if (value === assistantSpeaking) return;

  assistantSpeaking = value;
  if (value) assistantSpeakingSince = Date.now();
  capture?.port.postMessage({ type: "speaking", value });
}

/* -------------------------------------------------------------------------- */
/*  Step 1 — run the workflow                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Start the session server-side and get the join handle.
 *
 * `/sys/api.v1` rather than `workflow.exec`, because it is the only route that
 * accepts a bearer token: `Request::IsApi` is true for `sys/api.v1` and
 * `sys/api.v2` and nowhere else, and the JWT branch is gated on it.
 *
 * Extra `context` entries ride along as ordinary top-level form fields. The
 * service ignores keys it does not declare, and the workflow's Generic POST
 * block reads the request itself — so each becomes a named field of that
 * block's output, referenced downstream as `{projectId}` and the like.
 */
export async function startVizruSession(
  context: Record<string, string> = {},
): Promise<SessionHandle> {
  const { token } = getAuthFromStorage();
  if (!token) throw new Error("Not signed in: no platform token available.");

  const body = new URLSearchParams();
  body.set("op", "workflow.process");
  body.set("args[workflow-code]", WORKFLOW_LINKS.LIVE_AGENT);

  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null && value !== "") body.set(key, String(value));
  }

  log(`starting session via ${WORKFLOW_LINKS.LIVE_AGENT}`);

  const response = await fetch(`${APP_CONFIG.PUBLIC_API_URL}sys/api.v1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body: body.toString(),
  });

  const text = await response.text();

  let envelope: any;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`The platform returned a non-JSON response (HTTP ${response.status}).`);
  }

  // The API reports its own status inside the body — the controller collects
  // headers rather than emitting them, so a refusal still arrives as HTTP 200.
  // Reading response.status here would call a 401 a success.
  const status = Array.isArray(envelope?.Status) ? Number(envelope.Status[0]) : response.status;
  if (status !== 200) {
    const detail = Array.isArray(envelope?.Status) && envelope.Status[2] ? envelope.Status[2] : "";
    throw new Error(`The platform answered ${status}. ${detail}`.trim());
  }

  const handle = findHandle(envelope?.Body);
  if (!handle) {
    throw new Error(
      "The workflow ran but returned no session handle. Check its Agent Node is in Live mode.",
    );
  }

  log(`session ${handle.session_id}`);
  return handle;
}

/**
 * `workflow.process` returns the last block's output row with its keys prefixed
 * by the row index, so `session_id` arrives as `0.session_id`.
 */
function findHandle(body: unknown): SessionHandle | null {
  if (!body || typeof body !== "object") return null;

  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    flat[key.replace(/^\d+\./, "")] = value;
  }

  if (typeof flat.session_id !== "string" || typeof flat.token !== "string") return null;

  return {
    session_id: flat.session_id,
    token: flat.token,
    socket_url: typeof flat.socket_url === "string" ? flat.socket_url : "",
    socket_ns: typeof flat.socket_ns === "string" ? flat.socket_ns : "/agent-media",
    room: typeof flat.room === "string" ? flat.room : "",
    modalities: typeof flat.modalities === "string" ? flat.modalities : "audio",
    transport: typeof flat.transport === "string" ? flat.transport : "relay",
  };
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — join the relay                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Both steps behind one call, so starting voice is a single click.
 *
 * The join token lives about two minutes, so running the workflow and dialling
 * the relay are deliberately not separated by anything a user has to do.
 */
export async function startVizruVoice(
  handlers: LiveCallbacks = {},
  context: Record<string, string> = {},
): Promise<SessionHandle> {
  if (socket || starting) throw new Error("A voice session is already running.");
  starting = true;

  callbacks = handlers;
  seq = 0;
  muted = false;
  underruns = 0;
  assistantSpeaking = false;

  callbacks.onState?.("connecting");

  let handle: SessionHandle;
  try {
    handle = await startVizruSession(context);
  } catch (error) {
    starting = false;
    callbacks.onState?.("idle");
    throw error;
  }

  try {
    await connect(handle);
    await openAudio();
    sendControl({ op: "start", modalities: [handle.modalities || "audio"] });
  } catch (error) {
    stopVizruVoice();
    throw error;
  } finally {
    starting = false;
  }

  return handle;
}

function connect(handle: SessionHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const base =
      handle.socket_url ||
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;

    const url =
      `${base}${handle.socket_ns || "/agent-media"}` +
      `?session_id=${encodeURIComponent(handle.session_id)}` +
      `&token=${encodeURIComponent(handle.token)}` +
      `&role=browser`;

    log(`dialling ${base}${handle.socket_ns}`);

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    socket = ws;

    let opened = false;

    ws.onopen = () => {
      opened = true;
      log("relay connected");
      resolve();
    };

    // `error` carries nothing useful and always precedes `close`, which carries
    // the code and the relay's reason. Rejecting here would throw away the only
    // real information about the failure.
    ws.onerror = () => log("relay socket error");

    ws.onclose = (event) => {
      log(`relay closed (${event.code}${event.reason ? ": " + event.reason : ""})`);

      if (!opened) {
        reject(
          new Error(
            event.reason
              ? `The relay refused the session: ${event.reason} (${event.code}).`
              : `Nothing answered at ${base}${handle.socket_ns}.`,
          ),
        );
        return;
      }

      callbacks.onEnded?.(event.reason || "closed");
      callbacks.onState?.("ended");
    };

    ws.onmessage = (event) => onFrame(event.data as ArrayBuffer);
  });
}

async function openAudio(): Promise<void> {
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Without WebRTC's wiring these are the only echo controls available. On
      // a speaker rather than a headset the agent hears itself and interrupts.
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  audioContext = new AudioContext();

  // A context constructed after an await is outside the click that started it,
  // so the browser may hand it back suspended — in which case playback is never
  // pulled and audio arrives, buffers, and is never heard.
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      /* reported below */
    }
  }
  if (audioContext.state !== "running") {
    log(`audio context is "${audioContext.state}"; the browser is refusing playback`);
  }

  await Promise.all([
    audioContext.audioWorklet.addModule("/capture.worklet.js"),
    audioContext.audioWorklet.addModule("/playback.worklet.js"),
  ]);

  const source = audioContext.createMediaStreamSource(micStream);
  capture = new AudioWorkletNode(audioContext, "vizru-capture", {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    processorOptions: { targetRate: 16000 },
  });

  capture.port.onmessage = (event) => {
    const message = event.data;

    if (message.type === "audio") {
      if (!muted) sendFrame(FRAME.AUDIO_IN, new Uint8Array(message.pcm));
      return;
    }

    if (
      message.type === "speech-start" &&
      assistantSpeaking &&
      Date.now() - assistantSpeakingSince > BARGE_IN_GUARD_MS
    ) {
      bargeIn();
    }
  };
  source.connect(capture);

  playback = new AudioWorkletNode(audioContext, "vizru-playback", {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    processorOptions: { sourceRate: 24000 },
  });

  playback.port.onmessage = (event) => {
    const data = event.data;
    if (data?.type === "playing") log("playback started");

    // Starvation and overflow fail in opposite directions and need opposite
    // fixes, so they are never reported as one number.
    if (data?.type === "underrun") {
      underruns++;
      if (underruns === 1 || underruns % 10 === 0) {
        log(`playback underrun x${underruns} (jitter target now ${data.targetMs} ms)`);
      }
    }
    if (data?.type === "overflow") {
      log(`playback overflow x${data.overflows} — the reply outran the buffer`);
    }
  };
  playback.connect(audioContext.destination);

  log(`microphone open at ${audioContext.sampleRate} Hz, context ${audioContext.state}`);
}

/* -------------------------------------------------------------------------- */
/*  Frames                                                                    */
/* -------------------------------------------------------------------------- */

function onFrame(buffer: ArrayBuffer) {
  if (buffer.byteLength < FRAME.HEADER_BYTES) return;

  const type = new DataView(buffer).getUint8(0);
  const payload = new Uint8Array(buffer, FRAME.HEADER_BYTES);

  if (type === FRAME.AUDIO_OUT) {
    setAssistantSpeaking(true);
    const copy = new Uint8Array(payload).buffer;
    playback?.port.postMessage({ type: "audio", pcm: copy }, [copy]);
    return;
  }

  if (type !== FRAME.CONTROL) return;

  try {
    onControl(JSON.parse(new TextDecoder().decode(payload)));
  } catch {
    log("unparseable control frame");
  }
}

function onControl(message: Record<string, any>) {
  switch (String(message.op || "")) {
    case "ready": {
      // The node was built before the runner said what it would send, on an
      // assumption. Adopting the reported rate is the difference between
      // speech and the whole reply at the wrong pitch.
      const rate = Number(message.sample_rate_out) || 24000;
      playback?.port.postMessage({ type: "rate", sourceRate: rate });
      callbacks.onState?.("ready");
      log(`session ready (out ${rate} Hz)`);
      break;
    }

    case "state":
      setAssistantSpeaking(message.value === "speaking");
      callbacks.onState?.(String(message.value) as VoiceState);
      break;

    case "transcript":
      callbacks.onTranscript?.(
        String(message.text || ""),
        message.role === "user" ? "user" : "assistant",
        Boolean(message.final),
      );
      break;

    case "tool":
      callbacks.onToolActivity?.(
        String(message.name || ""),
        String(message.status || ""),
        message.label ? String(message.label) : undefined,
      );
      break;

    case "tool_call":
      void runClientTool(message);
      break;

    case "interrupted":
      // Everything queued is speech the user has already talked over. Logged
      // because this is the only thing that removes a contiguous chunk from the
      // middle of a reply.
      playback?.port.postMessage({ type: "flush" });
      setAssistantSpeaking(false);
      log("interrupted by the provider — playback flushed");
      break;

    case "mute":
      muted = Boolean(message.value);
      break;

    case "ended":
      callbacks.onEnded?.(String(message.reason || "ended"));
      stopVizruVoice();
      break;

    case "terminate":
      stopVizruVoice();
      break;
  }
}

/**
 * Run one platform-dispatched tool call and report back.
 *
 * A result is sent on every path, including a thrown handler: the model holds
 * its turn open waiting for one, and a runner that never hears back times the
 * call out and tells the model the application is not responding.
 */
async function runClientTool(message: Record<string, any>) {
  const callId = String(message.id || "");
  const name = String(message.name || "");
  const args = (message.arguments || {}) as Record<string, unknown>;

  log(`tool call: ${name}`);

  let result: unknown;
  const handler = clientTools.get(name);

  if (!handler) {
    // Say so rather than silently succeeding — the model can then explain
    // itself instead of believing it did something it did not.
    result = { status: "error", message: `No handler registered for "${name}".` };
  } else {
    try {
      result = { status: "ok", result: (await handler(args)) ?? "done" };
    } catch (error) {
      result = { status: "error", message: String(error) };
    }
  }

  sendControl({ op: "tool_result", id: callId, result });
}

function sendFrame(type: number, payload: Uint8Array) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const frame = new Uint8Array(FRAME.HEADER_BYTES + payload.length);
  const view = new DataView(frame.buffer);

  view.setUint8(0, type);
  view.setUint8(1, 0);
  view.setUint16(2, seq, true);
  view.setUint32(4, Date.now() & 0xffffffff, true);
  frame.set(payload, FRAME.HEADER_BYTES);

  seq = (seq + 1) % FRAME.SEQ_MODULO;
  socket.send(frame.buffer);
}

function sendControl(message: Record<string, unknown>) {
  sendFrame(FRAME.CONTROL, new TextEncoder().encode(JSON.stringify(message)));
}

/* -------------------------------------------------------------------------- */
/*  Controls                                                                  */
/* -------------------------------------------------------------------------- */

export function bargeIn() {
  // Silence the speaker locally first and tell the server second. Waiting for
  // the round trip is what makes a voice agent feel slow.
  playback?.port.postMessage({ type: "flush" });
  setAssistantSpeaking(false);
  log("barge-in");
  sendControl({ op: "barge_in" });
}

export function setVizruMuted(value: boolean) {
  muted = value;
}

export function sendVizruText(text: string) {
  sendControl({ op: "text", text });
}

export function isVizruVoiceActive(): boolean {
  return socket !== null || starting;
}

export function stopVizruVoice() {
  starting = false;

  if (socket && socket.readyState === WebSocket.OPEN) {
    sendControl({ op: "hangup" });
    socket.close();
  }
  socket = null;

  micStream?.getTracks().forEach((track) => track.stop());
  micStream = null;

  // Disconnect before closing. Closing the context is asynchronous, and a
  // playback node still wired to a destination during that window can be heard
  // underneath a session started immediately afterwards.
  try {
    capture?.disconnect();
    playback?.disconnect();
  } catch {
    /* already torn down */
  }
  capture?.port.close();
  playback?.port.close();
  capture = null;
  playback = null;

  audioContext?.close();
  audioContext = null;

  assistantSpeaking = false;
  callbacks.onState?.("idle");
  log("session stopped");
}
