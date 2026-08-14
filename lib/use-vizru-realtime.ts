"use client";

/**
 * React access to the platform's Realtime Push channel.
 *
 * Screens should use these rather than the socket module directly: the
 * connection is shared, and the hooks make sure a component that unmounts stops
 * receiving without disturbing anyone else listening to the same tag.
 */

import { useEffect, useRef, useState } from "react";

import {
  connectVizruSocket,
  getVizruSocketState,
  onVizruEvent,
  onVizruSocketState,
  type SocketState,
} from "@/lib/vizru-socket";

/**
 * Subscribe to one Realtime Push tag for the lifetime of a component.
 *
 * ```tsx
 * useVizruRealtime("rover_update", (payload) => {
 *   setItems((prev) => [payload, ...prev]);
 * });
 * ```
 *
 * The handler is held in a ref, so passing an inline arrow function does not
 * resubscribe on every render — which would otherwise churn socket listeners on
 * any component that re-renders often.
 */
export function useVizruRealtime(tag: string, handler: (payload: any) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!tag) return;

    // Idempotent: the first caller opens the connection and the rest join it.
    // Calling it here as well as in AuthProvider means a screen mounted before
    // the token arrived still connects once it has.
    connectVizruSocket();

    return onVizruEvent(tag, (payload) => handlerRef.current(payload));
  }, [tag]);
}

/** Connection state, for a status dot or a reconnecting banner. */
export function useVizruSocketState(): SocketState {
  const [state, setState] = useState<SocketState>(getVizruSocketState());

  useEffect(() => onVizruSocketState(setState), []);

  return state;
}
