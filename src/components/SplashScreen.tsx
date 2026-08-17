import { useEffect, useRef, useState } from "react";
import { useSfx } from "@/hooks/useSfx";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const { play } = useSfx();

  useEffect(() => {
    const drawEnd = setTimeout(() => {
      setVisible(false);
      play("whoosh");
    }, 2000);
    const unmount = setTimeout(() => onDoneRef.current(), 5000);
    return () => {
      clearTimeout(drawEnd);
      clearTimeout(unmount);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-xl ${
        visible
          ? "opacity-100"
          : "opacity-0"
      }`}
      style={{ transition: "opacity 3s cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <div className="flex flex-col items-center">
        <div className="overflow-hidden px-6">
          <div
            className="flex items-baseline splash-rise"
            style={{
              animationDelay: "0.1s",
              transition: "opacity 3s cubic-bezier(0.16, 1, 0.3, 1), transform 3s cubic-bezier(0.16, 1, 0.3, 1)",
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(1.3)",
            }}
          >
            <span className="font-display text-[120px] leading-none italic text-foreground">
              J
            </span>
            <span className="font-display text-[120px] leading-none italic text-primary">
              R
            </span>
          </div>
        </div>
        <div className="splash-loading-bar">
          <div className="splash-loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
