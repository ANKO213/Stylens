"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { BodyType } from "@/app/actions/avatar-storage";

interface AvatarVisualizerProps {
    gender: 'male' | 'female';
    heightCm: number;
    weightKg: number;
    bodyType: BodyType;
    skinColor: string;
}

export function AvatarVisualizer({ gender, heightCm, weightKg, bodyType, skinColor }: AvatarVisualizerProps) {

    // 1. Height Scaling
    // Base height: 170cm = scale 1.0
    const scaleY = useMemo(() => {
        return 0.8 + ((heightCm - 140) / (220 - 140)) * 0.4; // Map 140-220cm to 0.8-1.2 scale
    }, [heightCm]);

    // 2. Width/Bulk Scaling (BMI-ish)
    // Base BMI ~22. 
    // Weight 40kg -> Thin, 150kg -> Heavy
    const bmiScale = useMemo(() => {
        // Very rough approximation of "width" based on weight relative to height
        // Taller people need more weight to look same width
        const baseWeight = (heightCm - 100); // Simple base
        const ratio = weightKg / baseWeight;
        // ratio 1.0 = normal. 0.5 = thin. 1.5 = heavy.
        return 0.7 + (ratio * 0.4);
    }, [weightKg, heightCm]);


    // 3. Body Shape Morphing
    // We adjust shoulder/hip/waist ratios based on BodyType
    const shapeStyles = useMemo(() => {
        let shoulders = 1.0;
        let waist = 1.0;
        let hips = 1.0;
        let borderRadius = "20px"; // Default softness

        switch (bodyType) {
            case 'inverted_triangle':
                shoulders = 1.2; hips = 0.9; waist = 1.0;
                break;
            case 'pear':
                shoulders = 0.9; hips = 1.25; waist = 1.0;
                break;
            case 'hourglass':
                shoulders = 1.1; hips = 1.1; waist = 0.85;
                break;
            case 'apple':
                shoulders = 1.0; hips = 1.0; waist = 1.2;
                break;
            case 'rectangle':
            default:
                shoulders = 1.0; hips = 1.0; waist = 1.0;
                break;
        }

        return { shoulders, waist, hips };
    }, [bodyType]);

    return (
        <div className="relative w-full h-full flex items-end justify-center pb-8 overflow-hidden">
            {/* Background Glow */}
            <div
                className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent opacity-50 pointer-events-none"
                style={{ filter: `blur(40px)` }}
            />

            <motion.div
                className="relative flex flex-col items-center"
                animate={{
                    scaleY: scaleY,
                    scaleX: bmiScale, // Overall thickness
                }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                style={{ originY: 1 }} // Scale from bottom
            >
                {/* HEAD */}
                <motion.div
                    className="w-24 h-24 rounded-full mb-1 shadow-lg relative z-10"
                    style={{ backgroundColor: skinColor }}
                    animate={{
                        scale: 1.0 / Math.sqrt(scaleY), // Inverse scale to keep head somewhat round
                    }}
                />

                {/* UPPER BODY (Shoulders/Chest) */}
                <motion.div
                    className="shadow-xl relative"
                    style={{
                        backgroundColor: skinColor,
                    }}
                    animate={{
                        // We construct a shape using clip-path or multiple divs
                        // For simplicity, let's use a stack of blocks for specific shape control
                        // Top Block (Shoulders to Waist)
                        width: 100 * shapeStyles.shoulders,
                        height: 70,
                        borderTopLeftRadius: gender === 'male' ? 10 : 30,
                        borderTopRightRadius: gender === 'male' ? 10 : 30,
                        marginBottom: -5 // Overlap
                    }}
                />

                {/* WAIST/HIPS/LEGS */}
                <motion.div
                    className="shadow-xl relative"
                    style={{
                        backgroundColor: skinColor,
                    }}
                    animate={{
                        // Waist is the pinch point, Hips are the bottom width
                        width: 100 * shapeStyles.hips, // Hips width
                        height: 90,
                        // Try to simulate tapering from waist (top of this block) to hips
                        borderBottomLeftRadius: 20,
                        borderBottomRightRadius: 20,
                        // Pseudo-waist effect only works if we change width?
                        // Let's keep it abstract.
                    }}
                />

                {/* NOTE: Detailed morphing of "Apple" vs "Hourglass" with simple divs is hard.
                    Ideally we'd use SVG paths. 
                    Let's stick to a simple rounded rect that varies in aspect ratio for now
                    but apply the "BodyType" as a modifier to borderRadius or separate parts.
                */}
            </motion.div>
        </div>
    );
}
// Redefining simpler version for better visual stability
export function AvatarVisualizerSimple({ gender, heightCm, weightKg, bodyType, skinColor }: AvatarVisualizerProps) {
    // ... logic ...
    return null;
}
