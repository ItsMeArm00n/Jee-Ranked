import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const QUESTIONS_PER_MATCH = 10;
/** Each question gets its own shared 2-minute window. */
export const SECONDS_PER_QUESTION = 120;
export const MATCH_DURATION_SECONDS = QUESTIONS_PER_MATCH * SECONDS_PER_QUESTION;

export function adminClient(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function expectedScore(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function eloDelta(rating: number, opponent: number, score: number, k = 32) {
  return Math.round(k * (score - expectedScore(rating, opponent)));
}

export function rankTitle(elo: number) {
  if (elo >= 2400) return "GRANDMASTER";
  if (elo >= 2100) return "ELITE I";
  if (elo >= 1800) return "ELITE II";
  if (elo >= 1600) return "TOPPER";
  if (elo >= 1400) return "CONTENDER";
  if (elo >= 1200) return "ASPIRANT";
  return "ROOKIE";
}

export async function ensureProfileRow(userId: string, email?: string | null) {
  const db = adminClient();
  const { data: existing } = await db
    .from("profiles")
    .select("id, username, elo, wins, losses, draws, matches_played")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return existing;

  const base = (email?.split("@")[0] ?? "ranker").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 14) || "ranker";
  let username = base;
  for (let i = 0; i < 8; i++) {
    const { data, error } = await db
      .from("profiles")
      .insert({ id: userId, username })
      .select("id, username, elo, wins, losses, draws, matches_played")
      .single();
    if (!error && data) return data;
    username = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
  }
  throw new Error("Could not create profile");
}

type MatchRow = {
  id: string;
  status: string;
  player1_id: string;
  player2_id: string | null;
  question_ids: string[];
  duration_seconds: number;
  started_at: string | null;
  ends_at: string | null;
  winner_id: string | null;
  player1_delta: number | null;
  player2_delta: number | null;
  is_bot_match?: boolean;
  bot_schedule?: BotStep[] | null;
};

export type BotStep = { index: number; atMs: number; correct: boolean };

/** Attach a bot opponent to a waiting match and pre-compute its answer schedule. */
export async function attachBot(matchId: string, userId: string): Promise<MatchRow | null> {
  const db = adminClient();
  const { data: match } = await db
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("status", "waiting")
    .eq("player1_id", userId)
    .maybeSingle();
  if (!match) return null;

  const { data: me } = await db.from("profiles").select("elo").eq("id", userId).maybeSingle();
  const myElo = me?.elo ?? 1200;

  const { data: bots } = await db.from("profiles").select("id, elo").eq("is_bot", true);
  if (!bots?.length) return null;
  const bot = bots.slice().sort((a, b) => Math.abs(a.elo - myElo) - Math.abs(b.elo - myElo))[0]!;

  const accuracy = Math.min(0.9, Math.max(0.35, 0.35 + (bot.elo - 1000) / 2000));
  const total: number = match.question_ids.length;
  const windowMs = SECONDS_PER_QUESTION * 1000;
  const schedule: BotStep[] = [];
  for (let i = 0; i < total; i++) {
    // atMs is the bot's delay INSIDE that question's own 2-minute round.
    const atMs = Math.round(windowMs * (0.12 + Math.random() * 0.75));
    schedule.push({ index: i, atMs, correct: Math.random() < accuracy });
  }

  const now = Date.now();
  const { data: updated } = await db
    .from("matches")
    .update({
      player2_id: bot.id,
      status: "active",
      is_bot_match: true,
      bot_schedule: schedule,
      started_at: new Date(now).toISOString(),
      ends_at: new Date(now + match.duration_seconds * 1000).toISOString(),
    })
    .eq("id", matchId)
    .eq("status", "waiting")
    .select("*")
    .maybeSingle();

  return (updated as MatchRow) ?? null;
}

export type RoundState = {
  /** Question index currently in play (equals total when the paper is done). */
  index: number;
  /** Deadline of the current round, ISO. */
  endsAt: string | null;
  done: boolean;
};

type AnswerRow = { user_id: string; question_index: number; answered_at: string };

/**
 * Lock-step rounds: every question gets its own fresh 2-minute shared window.
 * A round ends as soon as BOTH players have answered (no time carries over) or
 * when the 2 minutes run out — whoever didn't answer gets it marked wrong.
 * Also drives the bot, whose schedule is a delay inside each round.
 */
export async function advanceMatch(match: MatchRow): Promise<RoundState> {
  const total = match.question_ids.length;
  if (match.status !== "active" || !match.player2_id || !match.started_at) {
    return { index: 0, endsAt: null, done: match.status === "finished" };
  }

  const db = adminClient();
  const { data } = await db
    .from("match_answers")
    .select("user_id, question_index, answered_at")
    .eq("match_id", match.id);
  const answers = (data ?? []) as AnswerRow[];

  const p1 = match.player1_id;
  const p2 = match.player2_id;
  const botId = match.is_bot_match ? p2 : null;
  const schedule = (match.bot_schedule ?? []) as BotStep[];

  const at = (uid: string, i: number) => {
    const row = answers.find((r) => r.user_id === uid && r.question_index === i);
    return row ? new Date(row.answered_at).getTime() : null;
  };

  const windowMs = SECONDS_PER_QUESTION * 1000;
  const now = Date.now();
  const inserts: {
    match_id: string;
    user_id: string;
    question_index: number;
    choice: null;
    is_correct: boolean;
    answered_at: string;
  }[] = [];
  const push = (uid: string, i: number, correct: boolean, whenMs: number) => {
    inserts.push({
      match_id: match.id,
      user_id: uid,
      question_index: i,
      choice: null,
      is_correct: correct,
      answered_at: new Date(whenMs).toISOString(),
    });
    answers.push({ user_id: uid, question_index: i, answered_at: new Date(whenMs).toISOString() });
  };

  let roundStart = new Date(match.started_at).getTime();
  let state: RoundState = { index: total, endsAt: null, done: true };

  for (let i = 0; i < total; i++) {
    const deadline = roundStart + windowMs;

    // Bot answers somewhere inside this round.
    if (botId && at(botId, i) === null) {
      const step = schedule.find((s) => s.index === i);
      const botAt = Math.min(roundStart + (step?.atMs ?? windowMs * 0.6), deadline);
      if (now >= botAt) push(botId, i, step?.correct ?? false, botAt);
    }

    const a1 = at(p1, i);
    const a2 = at(p2, i);

    if (a1 !== null && a2 !== null) {
      // Both answered — the next question starts right away, no time carried over.
      roundStart = Math.max(a1, a2);
      continue;
    }

    if (now >= deadline) {
      // Window closed — anyone who didn't answer loses the question.
      if (a1 === null) push(p1, i, false, deadline);
      if (a2 === null) push(p2, i, false, deadline);
      roundStart = deadline;
      continue;
    }

    state = { index: i, endsAt: new Date(deadline).toISOString(), done: false };
    break;
  }

  if (inserts.length) await db.from("match_answers").insert(inserts);
  return state;
}


export async function finalizeIfDone(match: MatchRow): Promise<MatchRow> {
  if (match.status !== "active" || !match.player2_id) return match;
  const db = adminClient();

  const { data: answers } = await db
    .from("match_answers")
    .select("user_id, is_correct, answered_at")
    .eq("match_id", match.id);
  const rows = answers ?? [];

  const total = match.question_ids.length;
  const of = (uid: string) => rows.filter((r) => r.user_id === uid);
  const p1 = of(match.player1_id);
  const p2 = of(match.player2_id);
  const timeUp = match.ends_at ? new Date(match.ends_at).getTime() <= Date.now() : false;
  const bothDone = p1.length >= total && p2.length >= total;
  if (!timeUp && !bothDone) return match;

  const s1 = p1.filter((r) => r.is_correct).length;
  const s2 = p2.filter((r) => r.is_correct).length;
  const last = (arr: typeof rows) =>
    arr.length ? Math.max(...arr.map((r) => new Date(r.answered_at).getTime())) : Infinity;

  let result1: number; // 1 win, 0.5 draw, 0 loss
  if (s1 > s2) result1 = 1;
  else if (s2 > s1) result1 = 0;
  else {
    const t1 = p1.length >= total ? last(p1) : Infinity;
    const t2 = p2.length >= total ? last(p2) : Infinity;
    result1 = t1 === t2 ? 0.5 : t1 < t2 ? 1 : 0;
  }

  const { data: profiles } = await db
    .from("profiles")
    .select("id, elo, wins, losses, draws, matches_played")
    .in("id", [match.player1_id, match.player2_id]);
  const pr1 = profiles?.find((p) => p.id === match.player1_id);
  const pr2 = profiles?.find((p) => p.id === match.player2_id);
  if (!pr1 || !pr2) return match;

  const d1 = eloDelta(pr1.elo, pr2.elo, result1);
  const d2 = eloDelta(pr2.elo, pr1.elo, 1 - result1);

  const { data: updated } = await db
    .from("matches")
    .update({
      status: "finished",
      finished_at: new Date().toISOString(),
      winner_id: result1 === 1 ? match.player1_id : result1 === 0 ? match.player2_id : null,
      player1_elo_before: pr1.elo,
      player2_elo_before: pr2.elo,
      player1_delta: d1,
      player2_delta: d2,
    })
    .eq("id", match.id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();

  // Another request already finalized this match — do not double-apply ELO.
  if (!updated) {
    const { data: fresh } = await db.from("matches").select("*").eq("id", match.id).single();
    return fresh as MatchRow;
  }

  await db
    .from("profiles")
    .update({
      elo: pr1.elo + d1,
      wins: pr1.wins + (result1 === 1 ? 1 : 0),
      losses: pr1.losses + (result1 === 0 ? 1 : 0),
      draws: pr1.draws + (result1 === 0.5 ? 1 : 0),
      matches_played: pr1.matches_played + 1,
    })
    .eq("id", pr1.id);
  await db
    .from("profiles")
    .update({
      elo: pr2.elo + d2,
      wins: pr2.wins + (result1 === 0 ? 1 : 0),
      losses: pr2.losses + (result1 === 1 ? 1 : 0),
      draws: pr2.draws + (result1 === 0.5 ? 1 : 0),
      matches_played: pr2.matches_played + 1,
    })
    .eq("id", pr2.id);

  return updated as MatchRow;
}
