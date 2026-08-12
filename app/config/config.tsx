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
            ? "https://home.qa.hirover.ai/"
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

    PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-rover",

    INSIGHTS_PUBLIC_CHAT_API_URL: PYTHON_API_BASE_URL + "/ask-insight",

    PYTHON_API_BASE_URL,

    CREATE_PROJECT_WF: "workflow.exec/rovercreateprojectforgetstarted67efdd66a4730",

    AFTER_MESSAGE_RECEIVE_WF: "workflow.trigger/roverv2rovermainquery692562863e860",

    TRANSLATE_WF: "workflow.exec/rovertranslatetext6655997db8938",

    ORIGIN_URL: origin.includes("localhost") || origin.includes("v0.app")
        ? "https://home.qa.hirover.ai/"
        : typeof window !== "undefined"
            ? origin
            : "",

    WORKFLOW_EXEC: "workflow.exec/",
} as const;
