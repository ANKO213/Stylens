"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, ArrowRight, Github } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LoginForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    async function onSocialLogin(provider: 'google' | 'github') {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            toast.error(error.message);
            setIsLoading(false);
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const username = formData.get("username") as string;

        try {
            if (isSignUp) {
                const { error, data } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username,
                            email,
                        },
                    },
                });
                if (error) throw error;

                // Explicitly sync to profiles table if user is created
                // Explicitly sync to profiles table using Server Action
                if (data.user) {
                    const { syncUserProfile } = await import("@/app/actions/auth-profile");
                    const result = await syncUserProfile(data.user.id, username, email);
                    if (!result.success) {
                        console.warn("Profile sync warning:", result.error);
                    }
                }

                toast.success("Check your email for the confirmation link!");
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.refresh();
                // Close modal is handled by parent effect on user change
            }
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="flex flex-col p-8 bg-[#0F0F10] text-white rounded-[40px] shadow-2xl w-full max-w-[420px] mx-auto border border-white/5 font-sans relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-20 bg-white/5 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col items-center mb-8 z-10">
                <div className="w-12 h-12 mb-6 relative">
                    {/* Official Logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Stylens Logo" className="w-full h-full object-contain" />
                </div>

                <span className="text-[10px] uppercase tracking-wider text-white/40 mb-2 font-medium">
                    {isSignUp ? "Create your unique design" : "Welcome back"}
                </span>
                <h1 className="text-2xl font-medium tracking-tight text-center">
                    {isSignUp ? "Sign up account" : "Log in to account"}
                </h1>
                <p className="text-white/40 text-xs mt-2 text-center max-w-[200px]">
                    {isSignUp ? "Enter your personal data to create your account" : "Enter your credentials to access your account"}
                </p>
            </div>

            {/* Form */}
            <form onSubmit={onSubmit} className="space-y-4 z-10">
                {isSignUp && (
                    <div className="group">
                        <div className="relative">
                            <input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="Username"
                                required
                                className="w-full h-12 pl-4 pr-4 bg-[#1C1C1E] text-white text-sm placeholder:text-white/20 rounded-2xl border border-white/5 focus:border-white/20 focus:ring-0 outline-none transition-all"
                            />
                        </div>
                    </div>
                )}

                <div className="group">
                    <div className="relative">
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Email address"
                            required
                            className="w-full h-12 pl-4 pr-4 bg-[#1C1C1E] text-white text-sm placeholder:text-white/20 rounded-2xl border border-white/5 focus:border-white/20 focus:ring-0 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="group">
                    <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            required
                            className="w-full h-12 pl-4 pr-12 bg-[#1C1C1E] text-white text-sm placeholder:text-white/20 rounded-2xl border border-white/5 focus:border-white/20 focus:ring-0 outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 mt-6 bg-white hover:bg-white/90 text-black font-medium rounded-full transition-all flex items-center justify-center gap-2 group"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            {isSignUp ? "Sign up" : "Log in"}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                    )}
                </Button>
            </form>

            <div className="mt-8 text-center z-10">
                <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-white/40 hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                    {isSignUp ? "Already have an account?" : "Don't have an account?"}
                    <span className="bg-[#1C1C1E] border border-white/5 px-3 py-1.5 rounded-lg text-white font-medium hover:bg-white/10 transition-colors">
                        {isSignUp ? "Log in" : "Sign up"}
                    </span>
                </button>
            </div>
        </div>
    );
}
