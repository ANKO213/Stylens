import React from "react";
import { Navbar } from "./components/layout/Navbar";
import { Hero } from "./components/landing/Hero";

function App() {
  return (
    <div className="bg-black min-h-screen text-white font-sans antialiased selection:bg-green-500/30">
      <Navbar />
      <Hero />
    </div>
  );
}

export default App;
