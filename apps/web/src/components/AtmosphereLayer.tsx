import { useEffect, useMemo, useRef } from "react";

export type Room = "rain-city" | "night-train" | "orbital-lab" | "cozy-cafe";

export function FocusMark({ className = "" }: { className?: string }) {
  return (
    <svg className={`focus-mark ${className}`} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 18V8h10M30 8h10v10M40 30v10H30M18 40H8V30" />
      <circle cx="24" cy="24" r="2.4" />
    </svg>
  );
}

function RainCanvas({ intensity }: { intensity: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let width = 0;
    let height = 0;
    let lastFrame = 0;
    const frameInterval = 1000 / 24;

    type Drop = {
      x: number;
      y: number;
      length: number;
      speed: number;
      alpha: number;
      width: number;
      depth: number;
    };

    let drops: Drop[] = [];

    const buildDrops = () => {
      const baseCount = window.innerWidth < 760 ? 22 : 38;
      const count = Math.round(baseCount * (0.45 + intensity * 0.7));

      drops = Array.from({ length: count }, (_, i) => {
        const depth = ((i * 7) % 11) / 10;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          length: 10 + depth * 44 + Math.random() * 16,
          speed: reduced ? 0 : 9 + depth * 17 + Math.random() * 5,
          alpha: 0.06 + depth * 0.24,
          width: 0.45 + depth * 0.9,
          depth,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildDrops();
    };

    const draw = (time: number) => {
      if (!reduced && time - lastFrame < frameInterval) {
        raf = requestAnimationFrame(draw);
        return;
      }

      lastFrame = time;
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";

      for (const drop of drops) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(188,226,244,${drop.alpha})`;
        ctx.lineWidth = drop.width;
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + drop.length * 0.09, drop.y + drop.length);
        ctx.stroke();

        if (!reduced) {
          drop.y += drop.speed;
          drop.x += drop.speed * 0.09;

          if (drop.y > height + 80) {
            drop.y = -drop.length - Math.random() * 140;
            drop.x = Math.random() * width;
          }
        }
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw(0);
    window.addEventListener("resize", resize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [intensity]);

  return <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />;
}

export function AtmosphereLayer({
  room = "rain-city",
  rainIntensity = 0.72,
}: {
  room?: Room;
  rainIntensity?: number;
}) {
  const signalLines = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);
  const particles = useMemo(() => Array.from({ length: 8 }, (_, index) => index), []);

  return (
    <div className={`ambient-world ambient-world--${room}`} aria-hidden="true">
      <div className="ambient-orb ambient-orb--one" />
      <div className="ambient-orb ambient-orb--two" />
      <div className="ambient-orb ambient-orb--three" />

      <div className="depth-plane depth-plane--back" />
      <div className="depth-plane depth-plane--middle" />
      <div className="depth-plane depth-plane--front" />

      <div className="signal-lines">
        {signalLines.map((line) => (
          <span
            className="signal-line"
            key={line}
            style={{ "--line": line } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="particle-field">
        {particles.map((particle) => (
          <i
            key={particle}
            style={{ "--particle": particle } as React.CSSProperties}
          />
        ))}
      </div>

      {room === "rain-city" ? <RainCanvas intensity={rainIntensity} /> : null}

      <div className="room-motion room-motion--train">
        <span className="night-horizon" />
      </div>

      <div className="room-motion room-motion--orbit" />
      <div className="room-motion room-motion--cafe">
        <span className="cafe-lamp cafe-lamp--one" />
        <span className="cafe-lamp cafe-lamp--two" />
        <span className="cafe-lamp cafe-lamp--three" />
        <span className="cafe-table" />
        <span className="cafe-cup" />
        <span className="cafe-steam cafe-steam--one" />
        <span className="cafe-steam cafe-steam--two" />
      </div>
      <div className="noise-field" />
      <div className="edge-vignette" />
    </div>
  );
}
