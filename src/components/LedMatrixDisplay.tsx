import React, { useEffect, useRef } from 'react';
import { drawTextInto, normalizeForLed, textWidth } from '../services/ledFont';
import './LedMatrixDisplay.css';

/** Panelgrösse wie die echte Matrix am Pi (32×32) */
const SIZE = 32;
/** Canvas-Pixel pro LED */
const CELL = 14;
/** Scroll-Takt wie rgbtext.py (time.sleep(0.03)) */
const STEP_MS = 30;

/** Zeilenfarben wie in rgbtext.py: gelb / violett / weiss */
const LINES = [
  { yTop: 2, core: '#ffff00', glow: 'rgba(255, 255, 0, 0.30)' },
  { yTop: 13, core: '#c026d4', glow: 'rgba(170, 20, 184, 0.35)' },
  { yTop: 24, core: '#ffffff', glow: 'rgba(255, 255, 255, 0.28)' },
];

interface LedMatrixDisplayProps {
  top: string;
  center: string;
  bottom: string;
  /** Animation nur laufen lassen, wenn die Seite sichtbar ist */
  active: boolean;
}

const LedMatrixDisplay: React.FC<LedMatrixDisplayProps> = ({ top, center, bottom, active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textsRef = useRef<{ lines: string[]; maxWidth: number }>({ lines: ['', '', ''], maxWidth: 0 });
  const posRef = useRef(SIZE);
  const gridRef = useRef(new Uint8Array(SIZE * SIZE));

  useEffect(() => {
    const lines = [top, center, bottom].map(normalizeForLed);
    textsRef.current = {
      lines,
      maxWidth: Math.max(...lines.map(textWidth)),
    };
    // Neuer Text läuft rechts wieder herein
    posRef.current = SIZE;
  }, [top, center, bottom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawFrame = () => {
      const grid = gridRef.current;
      grid.fill(0);
      const pos = Math.round(posRef.current);
      textsRef.current.lines.forEach((text, i) => {
        drawTextInto(grid, SIZE, pos, LINES[i].yTop, text, i + 1);
      });

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, SIZE * CELL, SIZE * CELL);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const v = grid[y * SIZE + x];
          const cx = (x + 0.5) * CELL;
          const cy = (y + 0.5) * CELL;
          if (v === 0) {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath();
            ctx.arc(cx, cy, CELL * 0.28, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const line = LINES[v - 1];
            ctx.fillStyle = line.glow;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL * 0.52, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = line.core;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL * 0.34, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      while (now - last >= STEP_MS) {
        last += STEP_MS;
        posRef.current -= 1;
        // Reset wie rgbtext.py: if (pos + len < 0): pos = width - 16
        if (posRef.current + textsRef.current.maxWidth < 0) {
          posRef.current = SIZE - 16;
        }
      }
      drawFrame();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="led-bezel">
      <canvas
        ref={canvasRef}
        className="led-canvas"
        width={SIZE * CELL}
        height={SIZE * CELL}
        aria-label={`LED-Anzeige: ${top} – ${center} – ${bottom}`}
      />
    </div>
  );
};

export default LedMatrixDisplay;
