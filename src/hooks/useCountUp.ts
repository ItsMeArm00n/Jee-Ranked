import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once `active` turns true.
 * Uses rAF with ease-out-expo; renders integers by default.
 */
export function useCountUp(target: number, active: boolean, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current || target === 0) {
      if (target === 0) setValue(0);
      return;
    }
    startedRef.current = true;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, durationMs]);

  return value;
}

/** Convenience wrapper: counts up when the element scrolls into view. */
export function useCountUpOnView<T extends HTMLElement = HTMLDivElement>(
  target: number,
  durationMs?: number,
) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const value = useCountUp(target, visible, durationMs);
  return { ref, value };
}
