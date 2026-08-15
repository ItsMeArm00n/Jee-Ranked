import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateProfile } from "@/lib/game.functions";
import { useSfx } from "@/hooks/useSfx";
import { SiteHeader } from "@/components/SiteHeader";
import { Avatar } from "@/components/Avatar";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not prepare the image"));
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not decode that image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateProfile);
  const qc = useQueryClient();
  const { play } = useSfx();
  const fileRef = useRef<HTMLInputElement>(null);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn({}) });
  const p = profile.data;

  const savedUsername = p?.username;
  const savedBio = p?.bio;
  const savedAvatar = p?.avatar_url;

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (savedUsername === undefined) return;
    setUsername(savedUsername);
    setBio(savedBio ?? "");
    setAvatar(savedAvatar ?? null);
  }, [savedUsername, savedBio, savedAvatar]);

  async function save() {
    setSaving(true);
    try {
      const next = await saveFn({ data: { username, bio, avatar_url: avatar ?? "" } });
      qc.setQueryData(["profile"], next);
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      play("final");
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function pick(file?: File | null) {
    if (!file) return;
    try {
      const url = await fileToAvatar(file);
      setAvatar(url);
      play("click");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that image");
    }
  }

  async function changePassword() {
    if (pw.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      play("final");
      toast.success("Password updated");
      setPw("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setPwBusy(false);
    }
  }

  const field =
    "w-full border border-border bg-surface px-4 py-4 font-mono text-sm outline-none transition-all duration-300 placeholder:text-muted-foreground focus:border-primary focus:bg-primary/5";
  const label = "mb-2 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="animate-enter">
          <h1 className="mask-reveal font-display text-6xl uppercase italic leading-none tracking-tighter">
            Your <span className="text-primary">profile</span>
          </h1>
          <p className="ticker-enter mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground [animation-delay:300ms]">
            Identity, rank and account settings
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* IDENTITY */}
          <section className="wipe-enter border border-border bg-surface/40 p-8 lg:col-span-7">
            <h2 className="font-display text-2xl uppercase italic tracking-tighter">Identity</h2>

            <div className="mt-8 flex items-center gap-6">
              <Avatar url={avatar} name={username || "You"} size={96} />
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0])}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="border border-border px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                >
                  Upload photo
                </button>
                {avatar ? (
                  <button
                    onClick={() => {
                      setAvatar(null);
                      play("click");
                    }}
                    className="block font-mono text-[10px] uppercase tracking-widest text-destructive transition-opacity hover:opacity-70"
                  >
                    Remove photo
                  </button>
                ) : null}
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Square image · shown at 128px
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <label className={label} htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={20}
                  placeholder="3-20 chars · letters, numbers, _ ."
                  className={field}
                />
              </div>
              <div>
                <label className={label} htmlFor="bio">
                  Bio <span className="text-muted-foreground/60">· {bio.length}/200</span>
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="One line for the arena."
                  className={`${field} resize-none`}
                />
              </div>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="cta-sweep mt-8 w-full bg-primary py-4 font-display text-xl uppercase italic tracking-tighter text-primary-foreground disabled:opacity-50 sm:w-auto sm:px-10"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </section>

          {/* STATS + ACCOUNT */}
          <div className="space-y-8 lg:col-span-5">
            <section className="wipe-enter border-l-4 border-primary bg-surface/40 p-8 [animation-delay:150ms]">
              <h2 className="font-display text-2xl uppercase italic tracking-tighter">Rating</h2>
              <div className="mt-6 flex items-end justify-between">
                <div>
                  <div className="font-display text-6xl leading-none tabular-nums">
                    {p?.elo.toLocaleString() ?? "—"}
                  </div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {p?.elo.toLocaleString() ?? "1,200"} ELO
                  </div>
                </div>
                <div className="font-mono text-xs uppercase tracking-widest text-primary">
                  {p?.rank ?? "—"}
                </div>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-2 border-t border-border pt-6 text-center font-mono text-xs">
                <div>
                  <div className="font-display text-3xl tabular-nums">{p?.wins ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Wins
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl tabular-nums">{p?.losses ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Losses
                  </div>
                </div>
                <div>
                  <div className="font-display text-3xl tabular-nums">{p?.draws ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Draws
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Duels fought</span>
                <span className="tabular-nums text-foreground">{p?.matches_played ?? 0}</span>
              </div>
            </section>

            <section className="wipe-enter border border-border bg-surface/40 p-8 [animation-delay:250ms]">
              <h2 className="font-display text-2xl uppercase italic tracking-tighter">Account</h2>
              <div className="mt-6 space-y-4">
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="NEW PASSWORD (8+ chars)"
                  className={field}
                />
                <button
                  onClick={changePassword}
                  disabled={pwBusy}
                  className="w-full border border-border px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {pwBusy ? "Updating..." : "Change password"}
                </button>
              </div>
              <Link
                to="/"
                className="mt-6 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                ← Back to lobby
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
