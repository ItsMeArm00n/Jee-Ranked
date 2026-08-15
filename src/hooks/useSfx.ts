import { useCallback, useEffect, useState } from "react";
import { isMuted, playSfx, setMuted, type SfxName } from "@/lib/sfx";

export function useSfx() {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
    const onChange = (e: Event) => setMutedState((e as CustomEvent<boolean>).detail);
    window.addEventListener("jee-sfx-mute", onChange);
    return () => window.removeEventListener("jee-sfx-mute", onChange);
  }, []);

  const play = useCallback((name: SfxName) => playSfx(name), []);
  const toggle = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    if (!next) playSfx("click");
  }, []);

  return { play, muted, toggle };
}
