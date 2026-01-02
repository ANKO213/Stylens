"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateStyle, createStyle } from "@/app/actions/admin-styles";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface StyleItem {
    id: string;
    title: string;
    image_url: string;
    prompt: string;
    created_at: string;
}

interface AdminFeedTableProps {
    initialStyles: StyleItem[];
    userEmail?: string | null;
}

export function AdminFeedTable({ initialStyles, userEmail }: AdminFeedTableProps) {
    const router = useRouter();
    const supabase = createClient();
    const [styles, setStyles] = useState<StyleItem[]>(initialStyles);
    const [editingStyle, setEditingStyle] = useState<StyleItem | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Partial<StyleItem>>({});
    const [isUploading, setIsUploading] = useState(false);

    // Create State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItem, setNewItem] = useState<{ title: string; prompt: string; imageFile: File | null }>({
        title: "",
        prompt: "",
        imageFile: null
    });

    // Deterministic date formatter to fix hydration mismatch
    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
    };

    const handleEditClick = (style: StyleItem) => {
        setEditingStyle(style);
        setFormData({
            title: style.title || "",
            prompt: style.prompt || "",
            image_url: style.image_url || ""
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `feed/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Upload to Supabase Storage (Using 'avatars' bucket as a shared public bucket for this demo)
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            setFormData(prev => ({ ...prev, image_url: publicUrl }));
            toast.success("Image uploaded successfully");

        } catch (error: any) {
            toast.error("Upload failed: " + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        if (!editingStyle) return;

        setIsLoading(true);
        try {
            const result = await updateStyle(editingStyle.id, formData);

            if (!result.success) {
                throw new Error(result.error);
            }

            setStyles(prev => prev.map(s =>
                s.id === editingStyle.id
                    ? { ...s, ...formData } as StyleItem
                    : s
            ));

            // Refresh server data
            router.refresh();

            toast.success("Style updated successfully");
            setEditingStyle(null);

        } catch (error: any) {
            toast.error("Failed to update style: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSave = async () => {
        if (!newItem.title || !newItem.prompt || !newItem.imageFile) {
            toast.error("Please fill all fields and select an image");
            return;
        }

        setIsUploading(true);
        try {
            // 1. Upload Image
            const fileExt = newItem.imageFile.name.split('.').pop();
            const fileName = `styles/${Date.now()}-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('style-images')
                .upload(fileName, newItem.imageFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('style-images')
                .getPublicUrl(fileName);

            // 2. Server Action Insert
            const result = await createStyle({
                title: newItem.title,
                prompt: newItem.prompt,
                image_url: publicUrl
            });

            if (result.success && result.data) {
                toast.success("Style created!");
                setStyles([result.data, ...styles]);
                setIsCreateOpen(false);
                setNewItem({ title: "", prompt: "", imageFile: null });
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to create");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent opening edit modal
        if (!confirm("Are you sure you want to delete this style?")) return;

        try {
            const { error } = await supabase.from("styles").delete().eq("id", id);
            if (error) throw error;
            setStyles(prev => prev.filter(s => s.id !== id));
            toast.success("Style deleted");
        } catch (error: any) {
            toast.error("Delete failed: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="bg-[#18181b] border border-[rgba(255,255,255,0.05)] rounded-full px-5 py-2 flex items-center gap-2 shadow-sm">
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Total Photos</span>
                    <span className="text-[14px] font-bold text-white font-mono">{styles.length}</span>
                </div>

                <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="h-[40px] bg-[rgba(26,26,26,0.8)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] rounded-full text-white font-bold text-[11px] uppercase tracking-widest px-6 hover:bg-[rgba(255,255,255,0.1)] hover:scale-105 transition-all shadow-lg"
                >
                    Add Photo
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {styles.map((style) => (
                    <div
                        key={style.id}
                        className="group relative bg-[#18181b] border border-[rgba(255,255,255,0.05)] rounded-[24px] overflow-hidden shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] hover:border-[rgba(255,255,255,0.1)] transition-all cursor-pointer"
                        onClick={() => handleEditClick(style)}
                    >
                        {/* Image Preview */}
                        <div className="relative aspect-[3/4] w-full bg-zinc-900">
                            <Image
                                src={style.image_url}
                                alt={style.title || "Style"}
                                fill
                                className="object-cover transition-transform group-hover:scale-105"
                                unoptimized
                            />

                            {/* Delete Action - Top Right */}
                            <button
                                onClick={(e) => handleDelete(e, style.id)}
                                className="absolute top-3 right-3 size-[32px] flex items-center justify-center bg-[rgba(26,26,26,0.8)] backdrop-blur-md rounded-full border border-[rgba(255,255,255,0.1)] text-white/70 hover:text-red-400 hover:bg-[rgba(255,255,255,0.1)] transition-all opacity-0 group-hover:opacity-100"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 space-y-2">
                            <h3 className="font-bold text-white tracking-wide truncate text-[14px] uppercase" title={style.title}>{style.title || "Untitled"}</h3>
                            <p className="text-[12px] text-zinc-400 line-clamp-2 font-light tracking-wide leading-relaxed" title={style.prompt}>
                                {style.prompt || "No prompt set"}
                            </p>
                            <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                                <span>{style.id.slice(0, 8)}...</span>
                                <span>{formatDate(style.created_at)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingStyle} onOpenChange={(open) => !open && setEditingStyle(null)}>
                <DialogContent className="max-w-2xl bg-[#121212] border-[rgba(255,255,255,0.1)] text-white sm:rounded-[32px] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-widest uppercase">Edit Feed Item</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-8 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Preview & Upload */}
                            <div className="space-y-4">
                                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
                                    {formData.image_url ? (
                                        <Image
                                            src={formData.image_url}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">
                                            No Image
                                        </div>
                                    )}
                                </div>

                                {/* File Upload Input */}
                                <div className="space-y-2">
                                    <Label htmlFor="image-upload">Replace Image</Label>
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                        className="cursor-pointer"
                                    />
                                    {isUploading && <p className="text-xs text-muted-foreground animate-pulse">Uploading...</p>}
                                </div>
                            </div>

                            {/* Form */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs uppercase tracking-wider">Title</Label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                        placeholder="E.g., Cyberpunk City"
                                        className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-offset-0 focus-visible:ring-zinc-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs uppercase tracking-wider">Image URL</Label>
                                    <Input
                                        value={formData.image_url}
                                        onChange={(e) => setFormData(p => ({ ...p, image_url: e.target.value }))}
                                        placeholder="https://..."
                                        disabled={isUploading}
                                        className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-offset-0 focus-visible:ring-zinc-700"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-zinc-400 text-xs uppercase tracking-wider">Prompt</Label>
                                    <Textarea
                                        value={formData.prompt}
                                        onChange={(e) => setFormData(p => ({ ...p, prompt: e.target.value }))}
                                        placeholder="Enter the detailed prompt..."
                                        rows={8}
                                        className="resize-none bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-offset-0 focus-visible:ring-zinc-700 font-light leading-relaxed"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setEditingStyle(null)}
                            className="hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full px-6"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isLoading || isUploading}
                            className="bg-white text-black hover:bg-zinc-200 rounded-full font-bold uppercase tracking-wider px-8"
                        >
                            {isLoading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="bg-[#121212] border-[rgba(255,255,255,0.1)] text-white sm:rounded-[32px] p-8">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-widest uppercase">Add New Style</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">
                        <div className="grid gap-2">
                            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Title</Label>
                            <Input
                                value={newItem.title}
                                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                                placeholder="e.g. Cyberpunk"
                                className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-offset-0 focus-visible:ring-zinc-700"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Prompt</Label>
                            <Textarea
                                value={newItem.prompt}
                                onChange={(e) => setNewItem({ ...newItem, prompt: e.target.value })}
                                placeholder="AI generation prompt..."
                                className="bg-zinc-900 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-offset-0 focus-visible:ring-zinc-700 min-h-[120px] font-light"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-zinc-400 text-xs uppercase tracking-wider">Image</Label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        setNewItem({ ...newItem, imageFile: e.target.files[0] });
                                    }
                                }}
                                className="bg-zinc-900 border-white/10 text-white cursor-pointer file:text-white file:bg-zinc-800 file:border-0 file:rounded-full file:px-4 file:text-xs file:font-semibold"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setIsCreateOpen(false)}
                            className="hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-full px-6"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateSave}
                            disabled={isUploading}
                            className="bg-white text-black hover:bg-zinc-200 rounded-full font-bold uppercase tracking-wider px-8"
                        >
                            {isUploading ? "Uploading..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
