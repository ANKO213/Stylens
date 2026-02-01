"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, User, Ruler, Weight, User2, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FaceUpload } from "@/components/auth/face-upload";
import { AvatarVisualizer } from "./avatar-visualizer";
import { saveAvatar, BodyType } from "@/app/actions/avatar-storage";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AvatarWizardProps {
    onCancel: () => void;
    onComplete: () => void;
}

export function AvatarWizard({ onCancel, onComplete }: AvatarWizardProps) {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // Gender, Stats, Scan, Name/Save
    const [isSaving, setIsSaving] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        id: crypto.randomUUID(),
        gender: 'male' as 'male' | 'female',
        skinColor: '#F5D0C5',
        heightCm: 170,
        weightKg: 70,
        bodyType: 'rectangle' as BodyType,
        age: 25,
        name: "",
        imageKeys: { main: "" } as { main: string; side1?: string; side2?: string }
    });

    const steps = [
        { id: 1, title: "Identity", icon: User2 },
        { id: 2, title: "Body", icon: Ruler },
        { id: 3, title: "Face", icon: User },
        { id: 4, title: "Finish", icon: Check },
    ];

    const skinColors = [
        "#F5D0C5", "#E8B48F", "#D4AA78", "#AC8B64", "#7B5C3E", "#463020"
    ];

    const handleNext = () => {
        if (step === 3 && !formData.imageKeys.main) {
            toast.error("Please provide at least one photo (Simulation)");
            // Allow skipping for dev
        }
        setStep(Math.min(4, step + 1) as any);
    };

    const handleBack = () => {
        setStep(Math.max(1, step - 1) as any);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast.error("Please name your avatar");
            return;
        }

        setIsSaving(true);
        try {
            await saveAvatar({
                id: formData.id,
                name: formData.name,
                gender: formData.gender,
                age: formData.age,
                heightCm: formData.heightCm,
                weightKg: formData.weightKg,
                bodyType: formData.bodyType,
                skinColor: formData.skinColor,
                imageKeys: formData.imageKeys,
                createdAt: Date.now(),
                isMain: false // Default false
            });

            toast.success("Avatar created!");
            onComplete();
            router.refresh();
        } catch (e) {
            toast.error("Failed to save avatar");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto h-[600px] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl relative">
            <div className="absolute top-4 right-4 z-50 md:hidden">
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
            </div>

            {/* LEFT: Visualizer / Preview */}
            <div className="w-full md:w-1/3 bg-zinc-900/50 relative border-b md:border-b-0 md:border-r border-zinc-800 p-8 flex flex-col items-center justify-center transition-all bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/30 via-zinc-900/10 to-transparent">
                <div className="absolute top-6 left-6 z-10 hidden md:block">
                    <h3 className="text-zinc-500 text-[10px] font-mono uppercase tracking-[0.2em]">Preview</h3>
                </div>

                <div className="w-full h-80 relative flex items-center justify-center">
                    <AvatarVisualizer
                        gender={formData.gender}
                        heightCm={formData.heightCm}
                        weightKg={formData.weightKg}
                        bodyType={formData.bodyType}
                        skinColor={formData.skinColor}
                    />
                </div>

                <div className="mt-8 flex gap-3">
                    {skinColors.map(color => (
                        <button
                            key={color}
                            onClick={() => setFormData({ ...formData, skinColor: color })}
                            className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all hover:scale-125 shadow-lg",
                                formData.skinColor === color ? "border-white scale-125 ring-2 ring-white/20" : "border-transparent scale-100"
                            )}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                </div>
            </div>

            {/* RIGHT: Controls */}
            <div className="flex-1 flex flex-col bg-zinc-950">
                {/* Header */}
                <div className="p-6 border-b border-zinc-900/50 flex items-center justify-between">
                    <div className="flex gap-1">
                        {steps.map((s, i) => (
                            <div key={s.id} className="flex items-center">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                                    step >= s.id ? "bg-white text-black scale-100 shadow-md" : "bg-zinc-900 text-zinc-600 scale-90"
                                )}>
                                    {s.id}
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={cn(
                                        "w-8 h-0.5 transition-colors duration-300 mx-1",
                                        step > s.id ? "bg-zinc-700" : "bg-zinc-900"
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: GENDER */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Select Identity</h2>
                                    <p className="text-zinc-500 text-sm mt-1">Choose a base model for your avatar.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setFormData({ ...formData, gender: 'male' })}
                                        className={cn(
                                            "h-48 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all duration-300 relative overflow-hidden group",
                                            formData.gender === 'male'
                                                ? "border-blue-500 bg-blue-500/5 text-white shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]"
                                                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                                            formData.gender === 'male' ? "bg-blue-500 text-white" : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700"
                                        )}>
                                            <User2 className="w-8 h-8" />
                                        </div>
                                        <span className="font-medium">Male</span>
                                    </button>

                                    <button
                                        onClick={() => setFormData({ ...formData, gender: 'female' })}
                                        className={cn(
                                            "h-48 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 transition-all duration-300 relative overflow-hidden group",
                                            formData.gender === 'female'
                                                ? "border-pink-500 bg-pink-500/5 text-white shadow-[0_0_30px_-10px_rgba(236,72,153,0.3)]"
                                                : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                                            formData.gender === 'female' ? "bg-pink-500 text-white" : "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700"
                                        )}>
                                            <User2 className="w-8 h-8" />
                                        </div>
                                        <span className="font-medium">Female</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: STATS */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Physical Attributes</h2>
                                    <p className="text-zinc-500 text-sm mt-1">Specify your real-world measurements.</p>
                                </div>

                                {/* Height & Weight Sliders */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4 p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/50">
                                        <div className="flex justify-between items-center">
                                            <Label className="flex items-center gap-2 text-base">
                                                <Ruler className="w-5 h-5 text-indigo-400" /> Height
                                            </Label>
                                            <span className="text-sm font-mono text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 font-bold">
                                                {formData.heightCm} <span className="text-zinc-500 text-xs font-normal">cm</span>
                                            </span>
                                        </div>
                                        <Slider
                                            value={[formData.heightCm]}
                                            onValueChange={(val: number[]) => setFormData({ ...formData, heightCm: val[0] })}
                                            min={140} max={220} step={1}
                                            className="py-2"
                                        />
                                        <div className="flex justify-between text-xs text-zinc-600 px-1">
                                            <span>140cm</span>
                                            <span>220cm</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800/50">
                                        <div className="flex justify-between items-center">
                                            <Label className="flex items-center gap-2 text-base">
                                                <Weight className="w-5 h-5 text-rose-400" /> Weight
                                            </Label>
                                            <span className="text-sm font-mono text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 font-bold">
                                                {formData.weightKg} <span className="text-zinc-500 text-xs font-normal">kg</span>
                                            </span>
                                        </div>
                                        <Slider
                                            value={[formData.weightKg]}
                                            onValueChange={(val: number[]) => setFormData({ ...formData, weightKg: val[0] })}
                                            min={40} max={150} step={1}
                                            className="py-2"
                                        />
                                        <div className="flex justify-between text-xs text-zinc-600 px-1">
                                            <span>40kg</span>
                                            <span>150kg</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Body Type Selector - Visual Upgrade */}
                                <div className="space-y-4">
                                    <Label className="text-base text-white">Body Shape</Label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                        {(['rectangle', 'inverted_triangle', 'hourglass', 'pear', 'apple'] as BodyType[]).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setFormData({ ...formData, bodyType: type })}
                                                className={cn(
                                                    "flex flex-col items-center p-3 rounded-2xl border-2 transition-all relative overflow-hidden group hover:scale-[1.02]",
                                                    formData.bodyType === type
                                                        ? "border-blue-500 bg-blue-500/10 shadow-[0_0_20px_-5px_rgba(59,130,246,0.3)]"
                                                        : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800"
                                                )}
                                            >
                                                {/* Visual Representation */}
                                                <div className={cn(
                                                    "w-full aspect-[3/4] rounded-xl mb-3 flex items-center justify-center transition-colors relative bg-zinc-950",
                                                    formData.bodyType === type ? "bg-blue-500/20" : ""
                                                )}>
                                                    {/* Simple geometric representation using CSS shapes or placeholders */}
                                                    <div className={cn(
                                                        "w-12 h-20 bg-current transition-all opacity-80",
                                                        type === 'rectangle' && "rounded-sm",
                                                        type === 'inverted_triangle' && "clip-path-triangle-inv w-16", // Need custom CSS for complex shapes or just use images. simpler:
                                                        // For now using rounded adjustments
                                                        type === 'rectangle' && "w-10 rounded-sm",
                                                        type === 'apple' && "w-14 rounded-full h-14",
                                                        type === 'pear' && "w-12 rounded-b-3xl rounded-t-lg",
                                                        type === 'hourglass' && "w-10 rounded-xl scale-x-75 scale-y-125 border-y-8 border-current", // Abstract attempt
                                                        type === 'inverted_triangle' && "w-14 rounded-t-xl rounded-b-sm",

                                                        formData.bodyType === type ? "text-blue-400" : "text-zinc-600 group-hover:text-zinc-400"
                                                    )} />

                                                    {formData.bodyType === type && (
                                                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-white" />
                                                        </div>
                                                    )}
                                                </div>

                                                <span className={cn(
                                                    "text-xs uppercase font-bold tracking-wide text-center",
                                                    formData.bodyType === type ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                                                )}>
                                                    {type.replace('_', ' ')}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-zinc-500 text-center mt-2 capitalize">
                                        Selected: {formData.bodyType.replace('_', ' ')}
                                    </p>
                                </div>

                                {/* Age Slider */}
                                <div className="space-y-4 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/50">
                                    <div className="flex justify-between items-center">
                                        <Label className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-zinc-500" /> Age
                                        </Label>
                                        <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">{formData.age}</span>
                                    </div>
                                    <Slider
                                        value={[formData.age]}
                                        onValueChange={(val: number[]) => setFormData({ ...formData, age: val[0] })}
                                        min={18} max={80} step={1}
                                        className="py-2"
                                    />
                                </div>

                            </motion.div>
                        )}

                        {/* STEP 3: FACE UPLOAD */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="space-y-6 h-full flex flex-col"
                            >
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Face Capture</h2>
                                    <p className="text-zinc-500 text-sm mt-1">Upload clear photos to train your digital twin.</p>
                                </div>

                                <div className="flex-1 min-h-0 bg-zinc-900/20 rounded-3xl overflow-hidden border border-zinc-800">
                                    <FaceUpload
                                        simple={true}
                                        onUpload={async () => { }} // Not used with custom handler
                                        // We need a way to close? FaceUpload doesn't have a close button if not in modal?
                                        // Actually FaceUpload has a close button if onClose provided.
                                        customUploadHandler={async (files) => {
                                            const { getAvatarPresignedUrl } = await import("@/app/actions/get-avatar-presigned-url");

                                            // Helper
                                            const uploadFile = async (file: File, name: string) => {
                                                const res = await getAvatarPresignedUrl(formData.id, name, file.type);
                                                if (res.error || !res.url) throw new Error(res.error || "Upload failed");

                                                await fetch(res.url, {
                                                    method: "PUT",
                                                    body: file,
                                                    headers: { "Content-Type": file.type }
                                                });
                                                return res.key;
                                            }

                                            const newKeys = { ...formData.imageKeys };

                                            if (files.main) {
                                                newKeys.main = await uploadFile(files.main, "main.jpg");
                                            }
                                            if (files.side1) {
                                                newKeys.side1 = await uploadFile(files.side1, "side1.jpg");
                                            }
                                            if (files.side2) {
                                                newKeys.side2 = await uploadFile(files.side2, "side2.jpg");
                                            }

                                            setFormData(prev => ({ ...prev, imageKeys: newKeys }));
                                            toast.success("Photos uploaded successfully!");
                                            // Auto advance
                                            setTimeout(() => handleNext(), 1000);
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 4: FINISH */}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-2xl font-bold text-white tracking-tight">Final Details</h2>
                                    <p className="text-zinc-500 text-sm mt-1">Name your digital twin to finish setup.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Avatar Name</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="e.g. Cinematic Portrait"
                                            className="bg-zinc-900 border-zinc-800 h-12 text-lg focus-visible:ring-offset-0 focus-visible:border-white transition-all"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 space-y-4">
                                        <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                            <User2 className="w-4 h-4" /> Identity Summary
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                                                <span className="text-xs text-zinc-500 block mb-1">Gender</span>
                                                <span className="text-sm text-white font-medium capitalise">{formData.gender || "Not set"}</span>
                                            </div>
                                            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                                                <span className="text-xs text-zinc-500 block mb-1">Age</span>
                                                <span className="text-sm text-white font-medium">{formData.age} years</span>
                                            </div>
                                            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 col-span-2">
                                                <span className="text-xs text-zinc-500 block mb-1">Face Data</span>
                                                <span className={cn("text-xs font-medium flex items-center gap-2", formData.imageKeys.main ? "text-green-500" : "text-amber-500")}>
                                                    {formData.imageKeys.main ? (
                                                        <><Check className="w-3 h-3" /> Encrypted & Ready</>
                                                    ) : (
                                                        "Not Uploaded"
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>

                {/* Footer Navigation */}
                <div className="p-6 border-t border-zinc-900/50 flex justify-between bg-zinc-950 rounded-br-3xl">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 1}
                        className="text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-full pl-2 pr-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back
                    </Button>

                    {step < 4 ? (
                        <Button
                            onClick={handleNext}
                            className="bg-white text-black hover:bg-zinc-200 rounded-full px-8 font-medium shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-105"
                        >
                            Next <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 rounded-full px-8 font-medium shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Avatar
                        </Button>
                    )}
                </div>
            </div>
        </div >
    );
}
