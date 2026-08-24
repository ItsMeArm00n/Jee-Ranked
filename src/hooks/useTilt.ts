import { useCallback, useRef } from "react";

/**
 * 3D tilt that follows the cursor. Attach the returned handlers to a card.
 * Respects prefers-reduced-motion.
 */
export function useTilt<T extends HTMLElement = HTMLDivElement>(maxDeg = 7) {
  const ref = useRef<T>(null);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;

      el.style.transform = `perspective(900px) rotateX(${(0.5 - py) * maxDeg}deg) rotateY(${
        (px - 0.5) * maxDeg
      }deg) translateY(-3px)`;

      // Feed spotlight coordinates at the same time so cards with
      // `spotlight-card` glow under the cursor without extra handlers.
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    },
    [maxDeg],
  );

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
  }, []);

  const onMouseEnter = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 0.12s ease-out";
    window.setTimeout(() => {
      if (ref.current) ref.current.style.transition = "transform 0.4s var(--ease-out-expo)";
    }, 120);
  }, []);

  return { ref, onMouseMove, onMouseLeave, onMouseEnter };
}
