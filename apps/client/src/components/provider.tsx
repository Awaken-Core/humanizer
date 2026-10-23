"use client";

import * as React from "react";
import { Toaster } from "./ui/sonner";
import QueryProvider from "./query-client";
import { ThemeProvider } from "./theme-provider";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { Analytics } from "@vercel/analytics/next"
import { env } from "@/lib/env";

if (typeof window !== "undefined") {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
        api_host: env.NEXT_PUBLIC_POSTHOG_HOST,
        capture_pageview: true,
        capture_pageleave: true,
    });
}

const Providers = ({ children }: { children: React.ReactNode }) => {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <>
            <PostHogProvider client={posthog}>
                <QueryProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="dark"
                        forcedTheme="dark"
                        enableSystem={false}
                        disableTransitionOnChange
                    >
                        {children}
                        {mounted && <Toaster position="top-center" />}
                    </ThemeProvider>
                </QueryProvider>
            </PostHogProvider>

            <Analytics />
        </>
    );
};

export default Providers;
