"use client";

import { useEffect } from "react";
import { refreshAuthToken } from "@/lib/auth";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Fetch token on mount (app load)
        refreshAuthToken();
    }, []);

    return <>{children}</>;
}
