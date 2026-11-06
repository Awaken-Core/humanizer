"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {

    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true);
    }, [])

    if (!mounted) {
        return (
            <Button
                type="button"
                aria-label="Toggle theme"
                size={"icon-sm"}
                variant="outline"
                className="z-10 rounded-full border-slate-200 bg-white text-slate-900 pointer-events-none dark:border-neutral-700 dark:bg-neutral-900"
                tabIndex={-1}
            >
                <span className="h-5 w-5 block" aria-hidden="true" />
            </Button>
        )
    }

    return (
        <Button
            type="button"
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            size={"icon-sm"}
            variant="outline"
            className="z-10 rounded-full border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
            {resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
    )
};
