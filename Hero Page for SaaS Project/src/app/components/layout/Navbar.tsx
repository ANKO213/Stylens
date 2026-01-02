import React from "react";
import { Button } from "../ui/button";
import logo from "figma:asset/be9d361bd6a8964511a15d792427e4ef339f112f.png";

export function Navbar() {
  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 pointer-events-none">
      {/* Logo */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <img src={logo} alt="FaceAI Logo" className="w-8 h-8 object-contain" />
        <span className="text-white font-bold text-lg tracking-tight">FaceAI</span>
      </div>

      {/* Center Navigation - Floating Island */}
      <nav className="hidden md:flex items-center bg-[#1A1A1A] p-1.5 rounded-full border border-white/5 shadow-xl pointer-events-auto absolute left-1/2 -translate-x-1/2">
        <a href="#" className="px-5 py-2 bg-white text-black text-sm font-medium rounded-full shadow-sm transition-all">
          Home
        </a>
        <a href="#" className="px-5 py-2 text-gray-400 text-sm font-medium hover:text-white transition-colors">
          Features
        </a>
        <a href="#" className="px-5 py-2 text-gray-400 text-sm font-medium hover:text-white transition-colors">
          Gallery
        </a>
        <a href="#" className="px-5 py-2 text-gray-400 text-sm font-medium hover:text-white transition-colors">
          Pricing
        </a>
        <a href="#" className="px-5 py-2 text-gray-400 text-sm font-medium hover:text-white transition-colors">
          Contact
        </a>
      </nav>

      {/* Right Side Buttons */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <Button className="bg-white text-black hover:bg-gray-200 rounded-full px-6 h-10 text-sm font-medium border-0">
          Log in
        </Button>
      </div>
    </div>
  );
}
