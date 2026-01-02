"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "For You", "Portraits", "Anime", "Cyberpunk", "Professional", "Sketch", "Photography", "Abstract", "3D Render"];

interface SearchModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        // In a real app, this would route to /search?q=... or filter the feed context
        console.log("Searching for:", query);
        // onOpenChange(false); // Optional: close on search?
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] gap-6 p-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">What do you want to create?</DialogTitle>
                </DialogHeader>

                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for styles, aesthetics, or creators..."
                        className="pl-12 h-14 rounded-full text-lg bg-muted/50 border-transparent focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleSearch(searchQuery);
                                onOpenChange(false);
                            }
                        }}
                        autoFocus
                    />
                </div>

                {/* Categories */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Explore Capabilities</h4>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => {
                                    handleSearch(cat);
                                    onOpenChange(false);
                                }}
                                className="px-4 py-2 rounded-full bg-muted/50 hover:bg-muted text-foreground font-medium transition-colors border border-transparent hover:border-border text-sm"
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
