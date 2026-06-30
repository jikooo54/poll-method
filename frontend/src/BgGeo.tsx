import { useEffect, useRef } from "react";

// Crosstab background: a Swiss dot-matrix that breathes/shifts + two sweeping
// diagonal IKB rules and a drifting red square outline. Canvas-2D, rm-safe.
export function BgGeo() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0, raf = 0, t = 0;
    const resize = () => { W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); window.addEventListener("resize", resize);
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const gap = 34; const sh = (t * 6) % gap;
      for (let x = 0; x < W + gap; x += gap) {
        for (let y = 0; y < H + gap; y += gap) {
          const r = 1.3 + Math.sin(t * 0.9 + (x + y) * 0.01) * 0.8;
          ctx.fillStyle = "rgba(17,17,20,0.10)";
          ctx.beginPath(); ctx.arc(x - sh, y - sh, Math.max(0.4, r), 0, Math.PI * 2); ctx.fill();
        }
      }
      // sweeping IKB diagonals
      for (let k = 0; k < 2; k++) {
        const x = ((t * 30 + k * W * 0.6) % (W + 400)) - 200;
        ctx.strokeStyle = "rgba(29,43,219,0.07)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 220, H); ctx.stroke();
      }
      // drifting red square outline
      const sx = W * 0.7 + Math.cos(t * 0.25) * 90, sy = H * 0.4 + Math.sin(t * 0.32) * 70;
      ctx.strokeStyle = "rgba(230,51,42,0.12)"; ctx.lineWidth = 2; ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.1); ctx.strokeRect(-60, -60, 120, 120); ctx.restore();
      if (!reduce) { t += 0.02; raf = requestAnimationFrame(draw); }
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="bg-geo" aria-hidden="true" />;
}
