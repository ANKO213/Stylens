"use client";

import { useState } from "react";
import { verifyAdminPassword } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const result = await verifyAdminPassword(password);
            if (result.success) {
                toast.success("Welcome back, Commander");
                router.refresh(); // Reload to trigger server-side check
            } else {
                toast.error("Access Denied");
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full flex items-center justify-center bg-black">
            <div className="w-full max-w-sm p-8 space-y-6 bg-[#121212] border border-white/10 rounded-[32px] text-center">
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-wrap-gradient flex items-center justify-center bg-zinc-900 border border-white/10">
                        <Lock className="w-6 h-6 text-white/70" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-white uppercase tracking-widest">Admin Access</h1>
                <p className="text-zinc-500 text-xs uppercase tracking-wide">Restricted Area</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        type="password"
                        placeholder="Enter Passcode"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-zinc-900 border-white/10 text-center text-white placeholder:text-zinc-600 rounded-full h-12 focus-visible:ring-offset-0 focus-visible:border-white/20"
                    />
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-full h-12 bg-white text-black font-bold uppercase tracking-widest hover:bg-zinc-200"
                    >
                        {loading ? "Verifying..." : "Unlock"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
