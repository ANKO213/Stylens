"use client";

import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

export function LoginTriggerButton() {
    return (
        <Button
            onClick={() => window.dispatchEvent(new CustomEvent('open-login'))}
            className="bg-white text-black hover:bg-gray-200 rounded-full px-8 h-12 font-medium"
        >
            <LogIn className="w-4 h-4 mr-2" />
            Log in to view Archive
        </Button>
    );
}
