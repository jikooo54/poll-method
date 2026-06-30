import { useEffect, useRef } from "react";
import Zdog from "zdog";

// A 3D bar chart: five methodology dimensions as rising columns, Swiss IKB blue
// with one red outlier. Rotates on a turntable. Bleeds out of the hero, no box.
const IKB = "#1d2bdb";
const RED = "#e6332a";
const INK = "#111114";
const PALE = "#c9cdf7";

export function Hero3D() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const illo = new Zdog.Illustration({ element: el, zoom: 1, resize: true });
    const turn = new Zdog.Anchor({ addTo: illo, rotate: { x: -0.62 } });
    const heights = [70, 120, 50, 150, 95];
    const cols = [IKB, IKB, RED, IKB, IKB];
    heights.forEach((h, i) => {
      const x = (i - 2) * 38;
      new Zdog.Box({ addTo: turn, width: 26, height: h, depth: 26, stroke: 2, color: cols[i], leftFace: INK, rightFace: INK, topFace: cols[i] === RED ? "#ff6b5e" : PALE, translate: { x, y: 80 - h / 2 } });
    });
    // baseline grid plate
    new Zdog.Rect({ addTo: turn, width: 230, height: 100, stroke: 2, color: "#3a44e8", translate: { y: 82 }, rotate: { x: Zdog.TAU / 4 } });

    let raf = 0; let t = 0;
    const tick = () => { t += 0.016; illo.rotate.y = Math.sin(t) * 0.6 + 0.5; illo.updateRenderGraph(); if (!reduce) raf = requestAnimationFrame(tick); };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="hero3d" aria-hidden="true" />;
}
