"use client";

import { Workflow } from "lucide-react";
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
    // Database-backed user/project workflows. The URLs shared in the Vizru UI
    // use hash routes (`#workflow.trigger/...` / `#workflow.debugger/...`). A
    // URL fragment is never sent in an HTTP request, so fetch must use the
    // callable workflow.trigger path and the workflow id.
    USER_DETAILS_WF: "workflow.trigger/6a808ee4c2d02f1db00f8ee3",
    PROJECT_LIST_WF: "workflow.trigger/6a8091a187061342c60acce2",
    SHARE_PROJECT_WF: "workflow.exec/roverprojectshare664dbc92c3028",
    ARCHIVE_PROJECT_WF: "workflow.exec/roverprojectarchive66603dce19f00",
    CHAT_HISTORY_WF: "workflow.trigger/6a80c45a6887dec5dc0bbc88",

    GET_INSIGHTS_WF: "workflow.exec/roverv2getmyinsights692431386908a",
    ADD_TO_INSIGHTS_WF: "workflow.exec/roverv2voting695e06fb20368",
    ARCHIVE_INSIGHT_WF: "workflow.exec/rovermyinsightsarchiveunarchive670ce78016abf",
    EXPORT_INSIGHTS_WF: "workflow.exec/roverexporttopdfbackground66fa922e0d4d9",
    // File preview
    FILE_PREVIEW_WF: "workflow.exec/roverv2filepreview6960c18d1c5ad",
    //Beat workflow
    BEAT_WORKFLOW: "workflow.exec/roverv2beatworkflowforfiles6960d48b7e252",

    // Live voice agent.
    //
    // A bare short code, not a `workflow.exec/` path like the others: this one
    // is run through `sys/api.v1` with `op=workflow.process`, because that is
    // the only route that accepts a bearer token. The workflow's Agent Node is
    // in live mode and returns a session handle for the media relay.
    LIVE_AGENT_WF: "test876a720666dd91d",

    PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-rover",

    // Ask Rover text agent. The workflow response is also pushed incrementally
    // over the platform socket as `agent_stream` payloads.
    ASK_ROVER_CHAT_WF: "workflow.trigger/6a75d645d22b6778627fdfd2",

    INSIGHTS_PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-insight",

    PYTHON_API_BASE_URL,

    CREATE_PROJECT_WF: "workflow.trigger/6a8092676a4c74d61e08e6e2",
    SAVE_FILM_DASHBOARD_WF: "workflow.trigger/6a809e65547065464e019593",
    GET_FILM_DASHBOARD_WF: "workflow.trigger/6a80acced616afc2d905109d",

    AFTER_MESSAGE_RECEIVE_WF: "workflow.trigger/6a80c8c32b3b61a48101e458",

    TRANSLATE_WF: "workflow.exec/rovertranslatetext6655997db8938",

    ORIGIN_URL: isLocalOrigin
        ? "https://ai-demo.vizru-ras.com/"
        : origin.includes("v0.app")
        ? "https://ai-demo.vizru-ras.com/"
        : typeof window !== "undefined"
            ? origin
            : "",

    WORKFLOW_EXEC: "workflow.exec/",

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
     * Mints the JWT the socket handshake is authenticated with.
     *
     * A different token from the one `lib/auth.ts` fetches for API calls: the
     * socket server verifies against its own secret, so the API token does not
     * satisfy it. Called through `workflow.trigger`, which needs no bearer of
     * its own — the platform session cookie authenticates it.
     */
    SOCKET_TOKEN_WF: "workflow.trigger/6a7eceb5f8dec4e8a9054b52",

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
