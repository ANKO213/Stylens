"use client";

import React from 'react';

const baseImages = [
  "https://images.unsplash.com/photo-1634910440823-193b061d28a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjeWJlcnB1bmslMjBuZW9uJTIwcG9ydHJhaXQlMjB3b21hbnxlbnwxfHx8fDE3NjY4MzQ4NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1761428961720-38db3883826b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwZmFzaGlvbiUyMGZhY2V8ZW58MXx8fHwxNzY2ODM0ODUyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1764336312138-14a5368a6cd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwYXJ0JTIwcG9ydHJhaXQlMjBnbG93aW5nfGVufDF8fHx8MTc2NjgzNDg1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1740508905761-9c2b61ae691e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGZhY2V8ZW58MXx8fHwxNzY2ODM0ODUyfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHwzZCUyMHJlbmRlciUyMGNoYXJhY3RlciUyMHBvcnRyYWl0fGVufDF8fHx8MTc2NjgzNDg1Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  "https://images.unsplash.com/photo-1760595955091-fb86f40bc5be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZW9uJTIwbGlnaHRpbmclMjBmYWNlJTIwYXJ0aXN0aWN8ZW58MXx8fHwxNzY2ODM0ODUzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
];

// Triple the images to get more density and a larger circle
const images = [...baseImages, ...baseImages, ...baseImages];

export function CurvedCarousel() {
  return (
    <div className="wrapper w-full h-[1000px] flex items-center justify-center bg-transparent relative pointer-events-none">

      <div
        className="inner"
        style={{
          '--quantity': images.length,
          '--w': '440px',
          '--h': '700px',
        } as React.CSSProperties}
      >
        {images.map((src, index) => (
          <div
            key={index}
            className="card"
            style={{ '--index': index } as React.CSSProperties}
          >
            <div className="w-full h-full relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} className="img" alt={`Slide ${index + 1}`} />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .wrapper {
          perspective: 1200px;
        }

        .inner {
          position: absolute;
          width: var(--w);
          height: var(--h);
          top: 35%;
          margin-top: -400px;
          left: 50%;
          margin-left: calc(var(--w) / -2); 
          z-index: 2;
          transform-style: preserve-3d;
          animation: rotating 80s linear infinite;
          pointer-events: none;
          
          /* 
             Radius Calculation:
             To add a small gap, we effectively pretend each card is wider (width + gap)
             Radius = ((Width + Gap) * Quantity) / (2 * PI)
             Adding 20px gap between cards.
          */
          --translateZ: calc(((var(--w) + 20px) * var(--quantity)) / 3.14159 / 2);
          
          --rotateX: -5deg;
        }

        @keyframes rotating {
          from {
            transform: perspective(1200px) rotateX(var(--rotateX)) rotateY(0deg);
          }
          to {
            transform: perspective(1200px) rotateX(var(--rotateX)) rotateY(360deg);
          }
        }

        .card {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1); /* Neutral border */
          border-radius: 12px;
          overflow: hidden;
          background-color: #000;
          
          /* 
             Position the card in the ring:
             1. Rotate it around Y axis by its angle
             2. Push it outwards by radius (translateZ)
          */
          transform: rotateY(calc((360deg / var(--quantity)) * var(--index))) translateZ(var(--translateZ));
        }

        .img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
