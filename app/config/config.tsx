"use client";

import { Workflow } from "lucide-react";

const getOrigin = () => {
    if (typeof window !== "undefined") {
        return window.location.origin + "/";
    }
    return ""; // fallback to empty string during SSR
};

const origin = getOrigin();
const PYTHON_API_BASE_URL = "https://roverv2-qa.vizru-ras.com"
export const APP_CONFIG = {
    PUBLIC_API_URL:
        origin.includes("localhost") || origin.includes("v0.app")
            ? "https://ai-demo.vizru-ras.com/"
            : typeof window !== "undefined"
                ? "/"
                : "",
    PROJECT_LIST_WF: "workflow.exec/roverv2getprojectlistforgetstarteddashboard692945aec2c62", //roverprojectlistforgetstarteddashboardchild67e68a347bae6",
    SHARE_PROJECT_WF: "workflow.exec/roverprojectshare664dbc92c3028",
    ARCHIVE_PROJECT_WF: "workflow.exec/roverprojectarchive66603dce19f00",
    CHAT_HISTORY_WF: "workflow.exec/roverv2getquestionsagainstproject69259c1d9e29e",

    GET_INSIGHTS_WF: "workflow.exec/roverv2getmyinsights692431386908a",
    ADD_TO_INSIGHTS_WF: "workflow.exec/roverv2voting695e06fb20368",
    ARCHIVE_INSIGHT_WF: "workflow.exec/rovermyinsightsarchiveunarchive670ce78016abf",
    EXPORT_INSIGHTS_WF: "workflow.exec/roverexporttopdfbackground66fa922e0d4d9",
    // payment Workflow
    CREATE_SESSION_WF: "workflow.exec/createstripecheckoutsession68faedae08428",
    PAYMENT_MAIL_WF: "workflow.exec/paymentmail68f739f37c403",
    PRICING_DETAILS_WF: "workflow.exec/roverv2stripepaymentdetails695f4afdd30a0",
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

    INSIGHTS_PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-insight",

    PYTHON_API_BASE_URL,

    CREATE_PROJECT_WF: "workflow.exec/rovercreateprojectforgetstarted67efdd66a4730",

    AFTER_MESSAGE_RECEIVE_WF: "workflow.trigger/roverv2rovermainquery692562863e860",

    TRANSLATE_WF: "workflow.exec/rovertranslatetext6655997db8938",

    ORIGIN_URL: origin.includes("localhost") || origin.includes("v0.app")
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
        process.env.NEXT_PUBLIC_SOCKET_URL || "https://chat-react-app.vizru-ras.com",

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
        process.env.NEXT_PUBLIC_SOCKET_HANDSHAKE_TOKEN ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmaXJzdF9uYW1lIjoiSm9obiIsImxhc3RfbmFtZSI6IkRvZSIsImVtYWlsIjoiam9obkBkb2UuY29tIn0.VecL2MImatj3_4y7I-y0sCoIOd3WPn86Z6ltQQ8fPwg",

    /**
     * Tenant id, used for the tenant-wide socket room.
     *
     * Not carried in the JWT, so it has to be configured. Leaving it unset only
     * costs tenant-broadcast messages; a Realtime Push addressed to a user id
     * still arrives, because that matches on the user rather than the tenant.
     */
    TENANT_ID: process.env.NEXT_PUBLIC_TENANT_ID || "11",
} as const;
