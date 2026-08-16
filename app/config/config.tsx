"use client";

import { ENV } from "@/lib/env";

const getOrigin = () => {
    if (typeof window !== "undefined") {
        return window.location.origin + "/";
    }
    return ""; // fallback to empty string during SSR
};

const origin = getOrigin();
const isLocalOrigin = origin.includes("localhost") || origin.includes("127.0.0.1");
const configuredPublicApiUrl = ENV.PUBLIC_API_URL
  ? `${ENV.PUBLIC_API_URL.replace(/\/$/, "")}/`
  : undefined;
const PYTHON_API_BASE_URL = "https://roverv2-qa.vizru-ras.com"
export const APP_CONFIG = {
    PUBLIC_API_URL:
        isLocalOrigin
            ? "/vizru-api/"
            : configuredPublicApiUrl || (origin.includes("v0.app")
            ? "https://ai-demo.vizru-ras.com/"
            : typeof window !== "undefined"
                ? "/"
                : ""),
    PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-rover",

    INSIGHTS_PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-insight",

    PYTHON_API_BASE_URL,

    ORIGIN_URL: isLocalOrigin
        ? "https://ai-demo.vizru-ras.com/"
        : origin.includes("v0.app")
        ? "https://ai-demo.vizru-ras.com/"
        : typeof window !== "undefined"
            ? origin
            : "",

    /**
     * The platform's realtime socket server — how a Realtime Push block reaches
     * this app.
     *
     * Its own host and port, not the API's: the platform serves the app on 443
     * and the socket server separately, so this cannot be derived from the API
     * URL. It is what the platform calls `ExternalSocketServer`.
     */
    SOCKET_URL:
        ENV.SOCKET_URL || "https://chat-react-app.vizru-ras.com",

    /**
     * Handshake token for the **legacy** socket server.
     *
     * A fixed value, not a user credential. That server verifies against its
     * own secret, which is not the platform's — a platform JWT is refused with
     * `invalid signature`. This exact string is what `sys/socketio/Socketio.php`
     * sends, so it is already on the wire in every browser that opens the
     * classic UI; identity is not carried here at all, it is established
     * afterwards by the `vizru_user` event.
     *
     * It is a shared gate rather than authentication, and that is the platform's
     * existing design rather than a choice made here.
     */
    SOCKET_HANDSHAKE_TOKEN:
        ENV.SOCKET_HANDSHAKE_TOKEN ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmaXJzdF9uYW1lIjoiSm9obiIsImxhc3RfbmFtZSI6IkRvZSIsImVtYWlsIjoiam9obkBkb2UuY29tIn0.VecL2MImatj3_4y7I-y0sCoIOd3WPn86Z6ltQQ8fPwg",

    /**
     * Tenant id, used for the tenant-wide socket room.
     *
     * Not carried in the JWT, so it has to be configured. Leaving it unset only
     * costs tenant-broadcast messages; a Realtime Push addressed to a user id
     * still arrives, because that matches on the user rather than the tenant.
     */
    TENANT_ID: ENV.TENANT_ID || "11",
} as const;
