"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AddStylePage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Safe client creation
    let supabase: any = null;
    try { supabase = createClient(); } catch (e) { }

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!supabase) {
            toast.error("Supabase not configured. Add keys to .env.local");
            return;
        }

        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;
        const prompt = formData.get("prompt") as string;
        const file = (formData.get("image") as File);

        if (!file || file.size === 0) {
            toast.error("Please select an image");
            setLoading(false);
            return;
        }

        try {
            // 1. Upload Image
            const fileExt = file.name.split('.').pop();
            const fileName = `styles/${Date.now()}-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('style-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('style-images')
                .getPublicUrl(fileName);

            // 3. Insert into styles table
            const { error: dbError } = await supabase
                .from('styles')
                .insert({
                    title,
                    prompt,
                    image_url: publicUrl,
                    model_config: {} // Optional, standard config
                });

            if (dbError) throw dbError;

            toast.success("Style created successfully!");
            (e.target as HTMLFormElement).reset();
            router.push("/"); // Redirect to feed to see it

        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to create style");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-md mx-auto py-12 px-4">
            <div className="bg-white border rounded-xl shadow-sm p-6">
                <h1 className="text-2xl font-bold mb-6 text-center">Add New Style</h1>

                <form onSubmit={onSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Style Title</Label>
                        <Input id="title" name="title" placeholder="e.g. Cyberpunk City" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="prompt">AI Prompt</Label>
                        <Textarea
                            id="prompt"
                            name="prompt"
                            placeholder="Describe the style in detail..."
                            required
                            className="min-h-[100px]"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="image">Preview Image</Label>
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors cursor-pointer relative">
                            <Input
                                type="file"
                                id="image"
                                name="image"
                                accept="image/*"
                                required
                                className="absolute inset-0 opacity-0 cursor-pointer h-full"
                            />
                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">Click to upload</span>
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin mr-2" /> : "Create Style"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
