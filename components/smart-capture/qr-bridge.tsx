"use client";

import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createCaptureSession, getSessionStatus } from "@/app/actions/capture-session";
import { Loader2, Smartphone, CheckCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QRBridgeProps {
    onCaptureComplete: (imageKey: string) => void;
    onCancel: () => void;
}

export function QRBridge({ onCaptureComplete, onCancel }: QRBridgeProps) {
    const [session, setSession] = useState<{ id: string; url: string } | null>(null);
    const [status, setStatus] = useState<'initializing' | 'waiting' | 'scanning' | 'captured' | 'error'>('initializing');

    // 1. Create Session on Mount
    useEffect(() => {
        let mounted = true;
        async function init() {
            try {
                const sess = await createCaptureSession();
                if (mounted) {
                    setSession(sess);
                    setStatus('waiting');
                }
            } catch (e) {
                console.error(e);
                if (mounted) setStatus('error');
            }
        }
        init();
        return () => { mounted = false; };
    }, []);

    // 2. Poll for status
    useEffect(() => {
        if (!session || status === 'captured' || status === 'error') return;

        const interval = setInterval(async () => {
            const state = await getSessionStatus(session.id);
            if (state) {
                if (state.status === 'scanning' && status !== 'scanning') {
                    setStatus('scanning');
                }
                if (state.status === 'captured' && state.imageUrl) {
                    setStatus('captured');
                    // Small delay to show success UI before closing
                    setTimeout(() => {
                        onCaptureComplete(state.imageUrl!); // imageUrl here is actually the R2 Key
                    }, 1500);
                }
            }
        }, 2000); // Poll every 2s

        return () => clearInterval(interval);
    }, [session, status, onCaptureComplete]); // Removed 'status' from dependency to avoid loop if not careful, but logic handles it

    return (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-zinc-950 border border-zinc-800 rounded-[32px] p-8 max-w-sm w-full text-center relative shadow-2xl flex flex-col items-center">
                {/* Close */}
                <button
                    onClick={onCancel}
                    className="absolute top-5 right-5 text-zinc-500 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6 flex justify-center relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Smartphone className="w-10 h-10 text-white" />
                    </div>
                </div>

                {status === 'initializing' && (
                    <div className="flex flex-col items-center py-10 w-full">
                        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin mb-4" />
                        <p className="text-zinc-500">Generating secure link...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center py-6 w-full">
                        <p className="text-red-400 mb-4">Connection Failed</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-zinc-800 text-white px-4 py-2 rounded-full text-sm hover:bg-zinc-700"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {(status === 'waiting' || status === 'scanning') && session && (
                    <div className="space-y-8 w-full">
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight mb-2">Face Scan</h3>
                            <p className="text-zinc-400 text-sm leading-relaxed px-2">
                                Scan this QR code with your mobile device to launch the Smart Camera. It uses intelligent focal scaling to capture a studio-quality portrait.
                            </p>
                        </div>

                        <div className="bg-white p-3 rounded-2xl mx-auto w-fit shadow-xl relative group">
                            <QRCodeSVG value={session.url} size={200} />

                            {/* Overlay for scanning state */}
                            {status === 'scanning' && (
                                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                                    <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Device Connected</p>
                                </div>
                            )}
                        </div>

                        {/* Steps */}
                        <div className="text-left space-y-3 pl-4">
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-zinc-500 font-bold text-xs ring-1 ring-zinc-800">1</span>
                                <span>Open Camera on your Phone</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 text-zinc-500 font-bold text-xs ring-1 ring-zinc-800">2</span>
                                <span>Scan the code above</span>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'captured' && (
                    <div className="flex flex-col items-center py-10 animate-in zoom-in duration-300 w-full">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_-5px_rgba(34,197,94,0.5)]">
                            <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">Scan Complete!</h3>
                        <p className="text-zinc-400 text-sm">Processing your avatar...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
