interface CurvedCarouselProps {
  images?: string[];
}

export function CurvedCarousel({ images = [] }: CurvedCarouselProps) {
  const displayImages = images;

  if (displayImages.length === 0) {
    return null; // Don't render anything if no images
  }
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
              <img src={src} className="img" alt={`Slide ${index + 1}`} />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          </div>
        ))}
      </div>

      <style>{`
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
