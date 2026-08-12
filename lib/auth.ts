import { APP_CONFIG } from "@/app/config/config";


export interface AuthData {
    token: string;
    userId: string;
    lsId: string;
    userEmail: string;
    loginUserName: string;
}

const STORAGE_KEYS = {
    TOKEN: "rover_token",
    USER_ID: "rover_user_id",
    LS_ID: "rover_ls_id",
    USER_EMAIL: "rover_user_email",
    LOGIN_USERNAME: "rover_login_username",
};

export const fetchJWTToken = async (): Promise<AuthData> => {
    try {
        const response = await fetch(
            `${APP_CONFIG.PUBLIC_API_URL}${APP_CONFIG.WORKFLOW_EXEC}roverv2getjwttoken692829d6ac4aa`,
            {
                method: "POST",
                body: new FormData(),
            }
        );
        if(response.status === 401){
            window.location.href = APP_CONFIG.PUBLIC_API_URL + "user.signout";
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch JWT token: ${response.status}`);
        }

        const data = await response.json();
        // The API returns an array with the token in the first element's jwt field
        const token = Array.isArray(data) && data.length > 0 ? data[0].jwt : "";
        const userId = Array.isArray(data) && data.length > 0 ? data[0]["user-id"] || "" : "";
        const lsId = Array.isArray(data) && data.length > 0 ? data[0]["ls-id"] || "" : "";
        const userEmail = Array.isArray(data) && data.length > 0 ? data[0]["user-email"] || "" : "";
        const loginUserName = Array.isArray(data) && data.length > 0 ? data[0]["login-username"] || "" : "";

        console.log("JWT Token Fetched");

        // Store in localStorage
        if (typeof window !== "undefined") {

            localStorage.setItem(STORAGE_KEYS.TOKEN, token);
            localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
            localStorage.setItem(STORAGE_KEYS.LS_ID, lsId);
            localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userEmail);
            localStorage.setItem(STORAGE_KEYS.LOGIN_USERNAME, loginUserName);
        }

        return { token, userId, lsId, userEmail, loginUserName };
    } catch (error) {
        console.error("JWT Token Error:", error);

        // if (typeof window !== "undefined" && window.location.pathname === "/") {
        //     window.location.href = APP_CONFIG.PUBLIC_API_URL + "user.signout";
        // }
        return { token: "", userId: "", lsId: "", userEmail: "", loginUserName: "" };
    }
};

export const getAuthFromStorage = (): AuthData => {
    if (typeof window === "undefined") {
        return { token: "", userId: "", lsId: "", userEmail: "", loginUserName: "" };
    }
    return {
        token: localStorage.getItem(STORAGE_KEYS.TOKEN) || "",
        userId: localStorage.getItem(STORAGE_KEYS.USER_ID) || "",
        lsId: localStorage.getItem(STORAGE_KEYS.LS_ID) || "",
        userEmail: localStorage.getItem(STORAGE_KEYS.USER_EMAIL) || "",
        loginUserName: localStorage.getItem(STORAGE_KEYS.LOGIN_USERNAME) || "",
    };
};

export const refreshAuthToken = async (): Promise<AuthData> => {
    return await fetchJWTToken();
};
