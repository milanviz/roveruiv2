"use client";

import { useEffect } from "react";
import { refreshAuthToken } from "@/lib/auth";
import { connectVizruSocket, disconnectVizruSocket } from "@/lib/vizru-socket";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        let cancelled = false;

        // Fetch token on mount (app load), then open the realtime socket with it.
        //
        // The socket authenticates once, at the handshake, so it cannot be
        // opened before the token exists — connecting earlier is a silent no-op
        // and the app would simply never receive a Realtime Push.
        (async () => {
            await refreshAuthToken();
            if (!cancelled) connectVizruSocket();
        })();

        return () => {
            cancelled = true;
            disconnectVizruSocket();
        };
    }, []);

    return <>{children}</>;
}
