import { useState } from "react";

export function Avatar({
  url,
  name,
  size = 40,
  className = "",
}: {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";

  if (!url || err) {
    return (
      <div
        aria-label={name}
        className={`flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-mono font-bold text-primary-foreground ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setErr(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
