"use client";

import React from "react";
import { CurvedCarousel } from "./curved-carousel";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

interface HeroProps {
    images?: string[];
}

export function Hero({ images }: HeroProps) {
    return (
        <div className="relative h-screen bg-black overflow-hidden flex flex-col justify-start items-center pt-24">

            <div className="container mx-auto px-6 z-10 flex flex-col items-center">
                {/* Text Content */}
                <div className="text-center max-w-4xl mx-auto mb-[70px] mt-[15px] relative z-20 mr-[0px] ml-[0px]">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#A47CF3] text-sm mb-6"
                    >
                        <Sparkles size={14} />
                        <span className="text-transparent bg-clip-text bg-gradient-to-t from-[#A47CF3] to-[#683FEA]">AI-Powered Magic</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight"
                    >
                        Create Stunning Images <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-400 to-gray-600">
                            with Just a Click
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto"
                    >
                        Turn your selfies into high-quality professional visuals in seconds.
                        No design skills needed—just upload and let AI do the rest.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        {/* Replaced generic button with Next.js Link/Button integration if needed, or kept as is but using Link */}
                        {/* The original code had a custom styled button directly. Keeping it for fidelity, but maybe wrapping in Link if it should go somewhere? 
                Usually "Generate Image" implies logging in or starting. Let's make it open the login modal (or link to login).
                Since `isLoginOpen` is in Navbar, checking how to trigger it...
                Actually, Navbar has the AuthModal. If this button is for "Generate", it inherently means start using the app.
                For now, I'll just keep the visuals. But making it functional is better.
                Since I don't have direct access to Navbar state here, I'll just leave it as a visual button or maybe Link to /login?
                The standard pattern for unauth users is "Sign Up".
                
                Let's keep the exact visual from the source first. The source used a <button>.
             */}
                        {/* Button links to feed immediately, even for guests */}
                        <Link
                            href="/?browse=true"
                            className="group w-48 h-14 bg-[#1C1A1C] rounded-full flex items-center justify-center gap-3 cursor-pointer transition-all duration-500 ease-in-out hover:bg-gradient-to-t hover:from-[#A47CF3] hover:to-[#683FEA] hover:shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.4),inset_0px_-4px_0px_0px_rgba(0,0,0,0.2),0px_0px_0px_4px_rgba(255,255,255,0.2),0px_0px_180px_0px_#9917FF] hover:-translate-y-0.5"
                        >
                            <Sparkles className="w-5 h-5 text-[#AAAAAA] transition-all duration-700 ease-out group-hover:text-white group-hover:scale-125 fill-current" />
                            <span className="text-[#AAAAAA] font-semibold text-sm transition-colors group-hover:text-white">
                                Generate Image
                            </span>
                        </Link>

                    </motion.div>
                </div>

                {/* Carousel Background */}
                <div className="w-full flex items-center justify-center mt-[-250px] md:mt-[-200px] mb-[-100px] relative z-0">
                    <CurvedCarousel images={images} />
                </div>

                {/* Footer/Trust section simplified */}
                <div className="mt-20 border-t border-white/10 w-full py-8 relative z-10 bg-black">
                    <p className="text-center text-gray-500 text-sm mb-6">TRUSTED BY CREATORS FROM</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale">
                        {/* Mock Logos */}
                        <div className="text-white font-bold text-xl">NEXUS</div>
                        <div className="text-white font-bold text-xl">VORTEX</div>
                        <div className="text-white font-bold text-xl">LUMINA</div>
                        <div className="text-white font-bold text-xl">QUANTUM</div>
                        <div className="text-white font-bold text-xl">ORBIT</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
