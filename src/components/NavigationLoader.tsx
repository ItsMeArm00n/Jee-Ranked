import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

export function NavigationLoader() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(0);
      const t1 = setTimeout(() => setProgress(60), 50);
      const t2 = setTimeout(() => setProgress(85), 400);
      const t3 = setTimeout(() => setProgress(90), 1200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (visible) {
      setProgress(100);
      const t = setTimeout(() => setVisible(false), 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isLoading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] h-[3px]">
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition: progress === 100
            ? "width 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            : "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
      <div
        className="absolute top-0 h-full w-24 bg-primary/60 blur-sm"
        style={{
          left: `calc(${progress}% - 48px)`,
          transition: progress === 100
            ? "left 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
            : "left 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}
