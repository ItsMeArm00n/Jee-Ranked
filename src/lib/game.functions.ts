import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureProfileRow, rankTitle } = await import("./game.server");
    const profile = await ensureProfileRow(context.userId, (context.claims as { email?: string })?.email);
    return { ...profile, rank: rankTitle(profile.elo) };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { adminClient, rankTitle } = await import("./game.server");
  const { data } = await adminClient()
    .from("profiles")
    .select("id, username, elo, wins, losses, matches_played")
    .eq("is_bot", false)
    .order("elo", { ascending: false })
    .limit(10);
  return (data ?? []).map((p) => ({ ...p, rank: rankTitle(p.elo) }));
});

export const matchWithBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { attachBot } = await import("./game.server");
    const match = await attachBot(data.matchId, context.userId);
    return { ok: !!match, matchId: data.matchId };
  });

export const getMatchReplay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminClient, rankTitle } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: match } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    if (!match) throw new Error("Match not found");
    if (match.player1_id !== uid && match.player2_id !== uid) throw new Error("Not your match");
    if (match.status !== "finished") throw new Error("Replay is available once the duel is over");

    const isP1 = match.player1_id === uid;
    const opponentId: string | null = isP1 ? match.player2_id : match.player1_id;

    const { data: profiles } = await db
      .from("profiles")
      .select("id, username, elo, is_bot")
      .in("id", [match.player1_id, match.player2_id ?? match.player1_id]);
    const prof = (id: string | null) => profiles?.find((p) => p.id === id) ?? null;

    const qids: string[] = match.question_ids;
    const { data: qs } = await db
      .from("questions")
      .select("id, subject, topic, stem, option_a, option_b, option_c, option_d, correct_option")
      .in("id", qids);
    const questions = qids.map((id, i) => {
      const q = qs?.find((x) => x.id === id);
      return {
        index: i,
        subject: q?.subject ?? "—",
        topic: q?.topic ?? "—",
        stem: q?.stem ?? "Question unavailable",
        options: [
          { key: "A", text: q?.option_a ?? "" },
          { key: "B", text: q?.option_b ?? "" },
          { key: "C", text: q?.option_c ?? "" },
          { key: "D", text: q?.option_d ?? "" },
        ],
        correct: q?.correct_option ?? "",
      };
    });

    const { data: answers } = await db
      .from("match_answers")
      .select("user_id, question_index, choice, is_correct, answered_at")
      .eq("match_id", match.id)
      .order("answered_at", { ascending: true });

    const startMs = new Date(match.started_at ?? match.created_at).getTime();
    const endMs = new Date(match.finished_at ?? match.ends_at ?? match.created_at).getTime();
    const events = (answers ?? []).map((a) => ({
      side: (a.user_id === uid ? "me" : "opponent") as "me" | "opponent",
      index: a.question_index as number,
      choice: (a.choice as string | null) ?? null,
      isCorrect: a.is_correct as boolean,
      atMs: Math.max(0, new Date(a.answered_at).getTime() - startMs),
    }));

    const myDelta = isP1 ? match.player1_delta : match.player2_delta;

    return {
      matchId: match.id,
      durationMs: Math.max(1000, Math.min(match.duration_seconds * 1000, endMs - startMs)),
      totalDurationMs: match.duration_seconds * 1000,
      total: qids.length,
      questions,
      events,
      me: {
        username: prof(uid)?.username ?? "You",
        elo: prof(uid)?.elo ?? 1200,
        rank: rankTitle(prof(uid)?.elo ?? 1200),
      },
      opponent: {
        username: prof(opponentId)?.username ?? "Opponent",
        elo: prof(opponentId)?.elo ?? 1200,
        isBot: prof(opponentId)?.is_bot ?? false,
      },
      outcome: match.winner_id === null ? "draw" : match.winner_id === uid ? "win" : "loss",
      delta: myDelta ?? 0,
    };
  });


export const getGlobalStats = createServerFn({ method: "GET" }).handler(async () => {
  const { adminClient } = await import("./game.server");
  const db = adminClient();
  const players = await db.from("profiles").select("id", { count: "exact", head: true }).eq("is_bot", false);
  const duels = await db.from("matches").select("id", { count: "exact", head: true }).eq("status", "finished");
  const questions = await db.from("questions").select("id", { count: "exact", head: true });
  return {
    players: players.count ?? 0,
    duels: duels.count ?? 0,
    questions: questions.count ?? 0,
  };
});

export const findMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient, ensureProfileRow, QUESTIONS_PER_MATCH, MATCH_DURATION_SECONDS } = await import(
      "./game.server"
    );
    const db = adminClient();
    const uid = context.userId;
    await ensureProfileRow(uid, (context.claims as { email?: string })?.email);

    // Already in a live or queued match? Rejoin it.
    const { data: mine } = await db
      .from("matches")
      .select("id, status")
      .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mine) return { matchId: mine.id as string, status: mine.status as string };

    // Expire stale queue entries.
    await db
      .from("matches")
      .update({ status: "cancelled" })
      .eq("status", "waiting")
      .lt("created_at", new Date(Date.now() - 3 * 60_000).toISOString());

    // Try to join someone waiting.
    const { data: open } = await db
      .from("matches")
      .select("id")
      .eq("status", "waiting")
      .neq("player1_id", uid)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (open) {
      const now = Date.now();
      const { data: joined } = await db
        .from("matches")
        .update({
          player2_id: uid,
          status: "active",
          started_at: new Date(now).toISOString(),
          ends_at: new Date(now + MATCH_DURATION_SECONDS * 1000).toISOString(),
        })
        .eq("id", open.id)
        .eq("status", "waiting")
        .select("id")
        .maybeSingle();
      if (joined) return { matchId: joined.id as string, status: "active" };
    }

    // Otherwise open a new queue entry with a fresh question set.
    const { data: pool } = await db.from("questions").select("id");
    const ids = (pool ?? []).map((q) => q.id as string);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    const { data: created, error } = await db
      .from("matches")
      .insert({
        player1_id: uid,
        question_ids: ids.slice(0, QUESTIONS_PER_MATCH),
        duration_seconds: MATCH_DURATION_SECONDS,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { matchId: created.id as string, status: "waiting" };
  });

export const leaveQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminClient } = await import("./game.server");
    await adminClient()
      .from("matches")
      .update({ status: "cancelled" })
      .eq("id", data.matchId)
      .eq("status", "waiting")
      .eq("player1_id", context.userId);
    return { ok: true };
  });

export const getMatchState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminClient, finalizeIfDone, runBotTicks, rankTitle, autoSkipExpired, questionDeadline, SECONDS_PER_QUESTION } =
      await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: raw } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    if (!raw) throw new Error("Match not found");
    if (raw.player1_id !== uid && raw.player2_id !== uid) throw new Error("Not your match");

    await runBotTicks(raw);
    await autoSkipExpired(raw);
    const match = await finalizeIfDone(raw);
    const isP1 = match.player1_id === uid;
    const opponentId: string | null = isP1 ? match.player2_id : match.player1_id;
    const total: number = match.question_ids.length;

    const { data: profiles } = await db
      .from("profiles")
      .select("id, username, elo")
      .in("id", [match.player1_id, match.player2_id ?? match.player1_id]);
    const prof = (id: string | null) => profiles?.find((p) => p.id === id) ?? null;

    const { data: answers } = await db
      .from("match_answers")
      .select("user_id, question_index, choice, is_correct")
      .eq("match_id", match.id);
    const rows = answers ?? [];
    const mine = rows.filter((r) => r.user_id === uid).sort((a, b) => a.question_index - b.question_index);
    const theirs = opponentId ? rows.filter((r) => r.user_id === opponentId) : [];

    const index = mine.length;
    let question: null | {
      index: number;
      subject: string;
      topic: string;
      stem: string;
      options: { key: string; text: string }[];
    } = null;

    if (match.status === "active" && index < total) {
      const qid = match.question_ids[index]!;
      const { data: q } = await db
        .from("questions")
        .select("subject, topic, stem, option_a, option_b, option_c, option_d")
        .eq("id", qid)
        .single();
      if (q) {
        question = {
          index,
          subject: q.subject,
          topic: q.topic,
          stem: q.stem,
          options: [
            { key: "A", text: q.option_a },
            { key: "B", text: q.option_b },
            { key: "C", text: q.option_c },
            { key: "D", text: q.option_d },
          ],
        };
      }
    }

    const myScore = mine.filter((r) => r.is_correct).length;
    const oppScore = theirs.filter((r) => r.is_correct).length;
    const myDelta = isP1 ? match.player1_delta : match.player2_delta;
    const meProfile = prof(uid);

    return {
      matchId: match.id,
      status: match.status,
      total,
      endsAt: match.ends_at,
      secondsPerQuestion: SECONDS_PER_QUESTION,
      questionEndsAt: question ? questionDeadline(match, question.index) : null,
      serverNow: new Date().toISOString(),
      me: {
        username: meProfile?.username ?? "You",
        elo: meProfile?.elo ?? 1200,
        rank: rankTitle(meProfile?.elo ?? 1200),
        answered: mine.length,
        correct: myScore,
      },
      opponent: opponentId
        ? {
            username: prof(opponentId)?.username ?? "Opponent",
            elo: prof(opponentId)?.elo ?? 1200,
            rank: rankTitle(prof(opponentId)?.elo ?? 1200),
            answered: theirs.length,
            correct: match.status === "finished" ? oppScore : null,
          }
        : null,
      question,
      result:
        match.status === "finished"
          ? {
              outcome: match.winner_id === null ? "draw" : match.winner_id === uid ? "win" : "loss",
              delta: myDelta ?? 0,
              newElo: meProfile?.elo ?? 1200,
              myScore,
              oppScore,
            }
          : null,
    };
  });

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        matchId: z.string().uuid(),
        index: z.number().int().min(0).max(49),
        choice: z.enum(["A", "B", "C", "D"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { adminClient, finalizeIfDone, runBotTicks, autoSkipExpired, currentSlot } = await import(
      "./game.server"
    );
    const db = adminClient();
    const uid = context.userId;

    const { data: match } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    if (!match) throw new Error("Match not found");
    if (match.player1_id !== uid && match.player2_id !== uid) throw new Error("Not your match");
    if (match.status !== "active") return { ok: false, reason: "Match is not live" };
    if (match.ends_at && new Date(match.ends_at).getTime() <= Date.now()) {
      await finalizeIfDone(match);
      return { ok: false, reason: "Time is up" };
    }

    // Each question only accepts answers inside its own shared 2-minute window.
    if (data.index < currentSlot(match)) {
      await autoSkipExpired(match);
      await finalizeIfDone(match);
      return { ok: false, reason: "That question's 2 minutes are up" };
    }

    const qid = match.question_ids[data.index];
    if (!qid) return { ok: false, reason: "Invalid question" };

    const { data: q } = await db.from("questions").select("correct_option").eq("id", qid).single();
    const isCorrect = q?.correct_option === data.choice;

    const { error } = await db.from("match_answers").insert({
      match_id: match.id,
      user_id: uid,
      question_index: data.index,
      choice: data.choice,
      is_correct: isCorrect,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    await runBotTicks(match);
    await finalizeIfDone(match);
    return { ok: true, isCorrect };
  });
