import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Edit2, 
  Share2, 
  Settings, 
  Grid, 
  Archive, 
  Users, 
  Zap, 
  Image as ImageIcon, 
  Camera,
  Coins,
  LogOut
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { Separator } from './ui/separator';

const MOCK_USER = {
  email: "alex.designer@example.com",
  handle: "@alex_creates",
  joinedDate: "December 2023",
  bio: "I'm imagining... --ar 1:1 --video 1",
  credits: 850,
  bannerUrl: null, // null means use default gradient
  avatarUrl: null, // null means use default color/placeholder
};

const MOCK_GALLERY = [
  { id: 1, url: "https://images.unsplash.com/photo-1762117666457-919e7345bd90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWx2ZXIlMjBsYXB0b3AlMjBvbiUyMHdoaXRlJTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3NjY3ODUxNjd8MA&ixlib=rb-4.1.0&q=80&w=1080", title: "Laptop Concept 1" },
  { id: 2, url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca4?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 2" },
  { id: 3, url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 3" },
  { id: 4, url: "https://images.unsplash.com/photo-1541807084-5c52b6b3bd99?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 4" },
  { id: 5, url: "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 5" },
  { id: 6, url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=1000&auto=format&fit=crop", title: "Laptop Concept 6" },
];

export function ProfilePage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-700">
      {/* Container */}
      <div className="max-w-6xl mx-auto pb-20">
        
        {/* Banner Section */}
        <div className="relative group">
          <div className="h-64 md:h-80 w-full bg-gradient-to-b from-zinc-700 to-zinc-900 rounded-b-[2rem] overflow-hidden relative">
            {/* Banner overlay gradient */}
            <div className="absolute inset-0 bg-black/20" />
            
            {/* Set Banner Button */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button variant="secondary" className="rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 backdrop-blur-sm border border-zinc-700/50">
                <ImageIcon className="w-4 h-4 mr-2" />
                Set Banner Image
              </Button>
            </div>
          </div>

          {/* Profile Picture Section - Overlapping */}
          <div className="absolute -bottom-16 left-8 md:left-12">
            <div className="relative group/avatar">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-zinc-800 rounded-3xl border-4 border-[#09090b] shadow-xl overflow-hidden flex items-center justify-center">
                {/* Fallback Avatar */}
                <div className="w-full h-full bg-zinc-700/50 flex items-center justify-center text-zinc-500">
                  <Camera className="w-12 h-12 opacity-50" />
                </div>
                
                {/* Set Profile Image Button Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                  <Button size="sm" variant="secondary" className="rounded-full text-xs bg-zinc-800/90 text-zinc-200 border border-zinc-600">
                    Set Profile Image
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Info Section */}
        <div className="mt-20 px-8 md:px-12 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1 space-y-2">
            {/* Email / Name */}
            <div className="flex items-center gap-3 group">
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                {MOCK_USER.email}
              </h1>

            </div>
            
            {/* Joined Date */}
            <div className="text-zinc-500 font-medium text-sm">
              Joined {MOCK_USER.joinedDate}
            </div>
            
            {/* Bio */}
          </div>

          {/* Actions & Credits */}
          <div className="flex flex-col items-start md:items-end gap-4">

            {/* Credits Block (New Requirement) */}
            <div className="w-full md:w-auto bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Credits</div>
                <div className="text-xl font-bold text-white tabular-nums">{MOCK_USER.credits}</div>
              </div>
              <Button size="sm" variant="outline" className="ml-auto md:ml-2 bg-transparent border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 h-8 text-xs">
                Buy More
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-12 px-8 md:px-12">
          <div className="flex items-center gap-8 border-b border-zinc-800 pb-1">
            <div className="text-sm font-medium text-white pb-3 border-b-2 border-white">
              Archive
            </div>
            
            <div className="ml-auto pb-3">
              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white hover:bg-zinc-800/50">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="mt-8 px-4 md:px-8">
          <motion.div 
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {MOCK_GALLERY.map((item) => (
              <div key={item.id} className="group relative aspect-square bg-white rounded-lg overflow-hidden border border-zinc-800 cursor-pointer">
                <div className="absolute inset-0 bg-zinc-100 flex items-center justify-center p-8">
                  <img 
                    src={item.url} 
                    alt={item.title}
                    className="w-full h-full object-contain drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                  <div className="bg-zinc-900/80 backdrop-blur text-zinc-300 p-1.5 rounded hover:text-white hover:bg-black transition-colors">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                   <div className="bg-zinc-900/80 backdrop-blur text-zinc-300 p-1.5 rounded hover:text-white hover:bg-black transition-colors">
                    <Share2 className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
