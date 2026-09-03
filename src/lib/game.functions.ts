import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/integrations/supabase/admin-middleware";
import { z } from "zod";
import { checkRateLimit } from "./rate-limit";

export const getAllQuestions = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { adminClient } = await import("./game.server");
    const { data, error } = await adminClient()
      .from("questions")
      .select("id, subject, topic, stem, option_a, option_b, option_c, option_d")
      .order("subject")
      .order("topic");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient } = await import("./game.server");
    const { data } = await adminClient()
      .from("admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return !!data;
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient, ensureProfileRow, rankTitle } = await import("./game.server");
    const profile = await ensureProfileRow(
      context.userId,
      (context.claims as { email?: string })?.email,
    );
    const db = adminClient();
    const { data: adminRow } = await db
      .from("admins")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { ...profile, rank: rankTitle(profile.elo), isAdmin: !!adminRow };
  });

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { adminClient, rankTitle, fetchAdminIds } = await import("./game.server");
  const db = adminClient();
  const [admins, { data }] = await Promise.all([
    fetchAdminIds(db),
    db
      .from("profiles")
      .select("id, username, elo, wins, losses, matches_played, avatar_url")
      .eq("is_bot", false)
      .order("elo", { ascending: false })
      .limit(10),
  ]);
  return (data ?? []).map((p) => ({
    ...p,
    rank: rankTitle(p.elo),
    is_admin: admins.has(p.id),
  }));
});

export const getFullLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { adminClient, rankTitle, fetchAdminIds } = await import("./game.server");
  const db = adminClient();
  const [admins, { data }] = await Promise.all([
    fetchAdminIds(db),
    db
      .from("profiles")
      .select("id, username, elo, wins, losses, draws, matches_played, avatar_url")
      .eq("is_bot", false)
      .order("elo", { ascending: false }),
  ]);
  return (data ?? []).map((p, i) => ({
    ...p,
    rank: rankTitle(p.elo),
    position: i + 1,
    is_admin: admins.has(p.id),
  }));
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .regex(
            /^[a-zA-Z0-9_.]+$/,
            "Usernames can only contain letters, numbers, dots and underscores",
          )
          .min(3, "Username must be at least 3 characters")
          .max(20, "Username must be at most 20 characters")
          .optional()
          .or(z.literal("")),
        bio: z
          .string()
          .trim()
          .max(200, "Bio must be at most 200 characters")
          .optional()
          .or(z.literal("")),
        avatar_url: z
          .string()
          .max(150_000, "Avatar file is too large")
          .refine(
            (v) => v === "" || /^data:image\/(png|jpeg|gif|webp);base64,/.test(v),
            "Avatar must be a PNG, JPEG, GIF, or WebP image",
          )
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { adminClient } = await import("./game.server");
    const db = adminClient();
    const updates: { username?: string; bio?: string | null; avatar_url?: string | null } = {};

    if (data.username) updates.username = data.username;
    if (data.bio !== undefined) updates.bio = data.bio ? data.bio : null;
    if (data.avatar_url !== undefined)
      updates.avatar_url = data.avatar_url ? data.avatar_url : null;

    if (updates.username) {
      const { data: taken } = await db
        .from("profiles")
        .select("id")
        .eq("username", updates.username)
        .neq("id", context.userId)
        .maybeSingle();
      if (taken) throw new Error("That username is already taken");
    }

    const { data: profile, error } = await db
      .from("profiles")
      .update(updates)
      .eq("id", context.userId)
      .select("id, username, elo, wins, losses, draws, matches_played, avatar_url, bio")
      .single();
    if (error)
      throw new Error(
        error.message.includes("duplicate") ? "That username is already taken" : error.message,
      );

    const { rankTitle } = await import("./game.server");
    return { ...profile, rank: rankTitle(profile.elo) };
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
    const { adminClient, rankTitle, jeeMarks, fetchAdminIds } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: match } = await db
      .from("matches")
      .select("*")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Error("Match not found");
    if (match.player1_id !== uid && match.player2_id !== uid) throw new Error("Not your match");
    if (match.status !== "finished") throw new Error("Replay is available once the duel is over");

    const isP1 = match.player1_id === uid;
    const opponentId: string | null = isP1 ? match.player2_id : match.player1_id;

    const [admins, { data: profiles }] = await Promise.all([
      fetchAdminIds(db),
      db
        .from("profiles")
        .select("id, username, elo, is_bot, avatar_url")
        .in("id", [match.player1_id, match.player2_id ?? match.player1_id]),
    ]);
    const prof = (id: string | null) => profiles?.find((p) => p.id === id) ?? null;

    const qids: string[] = match.question_ids;
    const { data: qs } = await db
      .from("questions")
      .select("id, subject, topic, stem, option_a, option_b, option_c, option_d, correct_option")
      .in("id", qids);
    const questions = qids.map((id, i) => {
      const q = qs?.find((x) => x.id === id);
      return {
        id,
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

    const myAnswers = events.filter((e) => e.side === "me");
    const oppAnswers = events.filter((e) => e.side === "opponent");
    const myMarks = jeeMarks(myAnswers.map((e) => ({ is_correct: e.isCorrect, choice: e.choice })));
    const oppMarks = jeeMarks(
      oppAnswers.map((e) => ({ is_correct: e.isCorrect, choice: e.choice })),
    );

    return {
      matchId: match.id,
      durationMs: Math.max(1000, Math.min(match.duration_seconds * 1000, endMs - startMs)),
      totalDurationMs: match.duration_seconds * 1000,
      total: qids.length,
      isSolo: !match.player2_id,
      questions,
      events,
      me: {
        username: prof(uid)?.username ?? "You",
        elo: prof(uid)?.elo ?? 1200,
        rank: rankTitle(prof(uid)?.elo ?? 1200),
        avatar_url: prof(uid)?.avatar_url ?? null,
        is_admin: admins.has(uid),
        marks: myMarks,
        correct: myAnswers.filter((e) => e.isCorrect).length,
      },
      opponent: opponentId
        ? {
            username: prof(opponentId)?.username ?? "Opponent",
            elo: prof(opponentId)?.elo ?? 1200,
            rank: rankTitle(prof(opponentId)?.elo ?? 1200),
            isBot: prof(opponentId)?.is_bot ?? false,
            avatar_url: prof(opponentId)?.avatar_url ?? null,
            is_admin: admins.has(opponentId),
            marks: oppMarks,
            correct: oppAnswers.filter((e) => e.isCorrect).length,
          }
        : null,
      outcome: match.winner_id === null ? "draw" : match.winner_id === uid ? "win" : "loss",
      delta: myDelta ?? 0,
    };
  });

export const getGlobalStats = createServerFn({ method: "GET" }).handler(async () => {
  const { adminClient } = await import("./game.server");
  const db = adminClient();
  const players = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("is_bot", false);
  const duels = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "finished");
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
    const { adminClient, ensureProfileRow, QUESTIONS_PER_MATCH, MATCH_DURATION_SECONDS } =
      await import("./game.server");
    const db = adminClient();
    const uid = context.userId;
    await ensureProfileRow(uid, (context.claims as { email?: string })?.email);

    // Already in a live or queued ranked match? Rejoin it.
    const { data: mine } = await db
      .from("matches")
      .select("id, status")
      .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
      .in("status", ["waiting", "active"])
      .or("is_ranked.is.null,is_ranked.eq.true")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mine) return { matchId: mine.id as string, status: mine.status as string };

    // Expire stale ranked queue entries (ranked only — don't touch unranked).
    await db
      .from("matches")
      .update({ status: "cancelled" })
      .eq("status", "waiting")
      .or("is_ranked.is.null,is_ranked.eq.true")
      .lt("created_at", new Date(Date.now() - 3 * 60_000).toISOString());

    // Try to join someone waiting (ranked only, so we never land in an unranked match).
    const { data: open } = await db
      .from("matches")
      .select("id")
      .eq("status", "waiting")
      .or("is_ranked.is.null,is_ranked.eq.true")
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

export const findUnrankedMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.enum(["Physics", "Chemistry", "Mathematics", "All"]),
        mode: z.enum(["solo", "random"]),
        secondsPerQuestion: z.number().int().min(30).max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { adminClient, ensureProfileRow, QUESTIONS_PER_MATCH } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;
    await ensureProfileRow(uid, (context.claims as { email?: string })?.email);

    // Already in a live or queued unranked match? Rejoin it.
    const { data: mine } = await db
      .from("matches")
      .select("id, status")
      .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
      .in("status", ["waiting", "active"])
      .eq("is_ranked", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (mine) return { matchId: mine.id as string, status: mine.status as string };

    // Expire stale unranked queue entries.
    await db
      .from("matches")
      .update({ status: "cancelled" })
      .eq("status", "waiting")
      .eq("is_ranked", false)
      .lt("created_at", new Date(Date.now() - 3 * 60_000).toISOString());

    // For solo mode, create match and start immediately — no opponent.
    if (data.mode === "solo") {
      const subjectFilter = data.subject === "All" ? null : data.subject;
      const secondsPerQ = data.secondsPerQuestion ?? 120;

      // Fetch questions filtered by subject.
      let query = db.from("questions").select("id");
      if (subjectFilter) query = query.eq("subject", subjectFilter);
      const { data: pool } = await query;
      const ids = (pool ?? []).map((q) => q.id as string);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j]!, ids[i]!];
      }
      const picked = ids.slice(0, QUESTIONS_PER_MATCH);
      const totalDuration = picked.length * secondsPerQ;
      const now = Date.now();

      const { data: created, error } = await db
        .from("matches")
        .insert({
          player1_id: uid,
          question_ids: picked,
          duration_seconds: totalDuration,
          is_ranked: false,
          subject_filter: subjectFilter,
          status: "active",
          started_at: new Date(now).toISOString(),
          ends_at: new Date(now + totalDuration * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      return { matchId: created.id as string, status: "active" };
    }

    // Random mode: try to join an existing unranked queue with the same subject filter.
    const subjectFilter = data.subject === "All" ? null : data.subject;
    let joinQuery = db
      .from("matches")
      .select("id")
      .eq("status", "waiting")
      .eq("is_ranked", false)
      .neq("player1_id", uid);
    if (subjectFilter) joinQuery = joinQuery.eq("subject_filter", subjectFilter);
    else joinQuery = joinQuery.is("subject_filter", null);
    joinQuery = joinQuery.order("created_at", { ascending: true }).limit(1);
    const { data: open } = await joinQuery.maybeSingle();

    if (open) {
      const { data: q } = await db
        .from("matches")
        .select("duration_seconds")
        .eq("id", open.id)
        .single();
      const totalDuration = q?.duration_seconds ?? QUESTIONS_PER_MATCH * 120;
      const now = Date.now();
      const { data: joined } = await db
        .from("matches")
        .update({
          player2_id: uid,
          status: "active",
          started_at: new Date(now).toISOString(),
          ends_at: new Date(now + totalDuration * 1000).toISOString(),
        })
        .eq("id", open.id)
        .eq("status", "waiting")
        .select("id")
        .maybeSingle();
      if (joined) return { matchId: joined.id as string, status: "active" };
    }

    // No match found — create a new queue entry.
    let query2 = db.from("questions").select("id");
    if (subjectFilter) query2 = query2.eq("subject", subjectFilter);
    const { data: pool2 } = await query2;
    const ids2 = (pool2 ?? []).map((q) => q.id as string);
    for (let i = ids2.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids2[i], ids2[j]] = [ids2[j]!, ids2[i]!];
    }
    const picked2 = ids2.slice(0, QUESTIONS_PER_MATCH);
    const totalDuration2 = picked2.length * 120;

    const { data: created2, error: err2 } = await db
      .from("matches")
      .insert({
        player1_id: uid,
        question_ids: picked2,
        duration_seconds: totalDuration2,
        is_ranked: false,
        subject_filter: subjectFilter,
      })
      .select("id")
      .single();
    if (err2) throw new Error(err2.message);
    return { matchId: created2.id as string, status: "waiting" };
  });

export const unrankedWithBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { attachBot } = await import("./game.server");
    const match = await attachBot(data.matchId, context.userId);
    return { ok: !!match, matchId: data.matchId };
  });

export const getMatchState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const {
      adminClient,
      advanceMatch,
      finalizeIfDone,
      enforceAfk,
      rankTitle,
      jeeMarks,
      SECONDS_PER_QUESTION,
      AFK_GRACE_SECONDS,
      fetchAdminIds,
    } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: raw } = await db.from("matches").select("*").eq("id", data.matchId).maybeSingle();
    if (!raw) throw new Error("Match not found");
    if (raw.player1_id !== uid && raw.player2_id !== uid) throw new Error("Not your match");

    const round = await advanceMatch(raw);
    const isSolo = !raw.player2_id;
    let match = isSolo ? raw : await enforceAfk(raw, round);
    match = await finalizeIfDone(match);
    const isP1 = match.player1_id === uid;
    const opponentId: string | null = isP1 ? match.player2_id : match.player1_id;
    const total: number = match.question_ids.length;

    const [admins, { data: profiles }] = await Promise.all([
      fetchAdminIds(db),
      db
        .from("profiles")
        .select("id, username, elo, avatar_url")
        .in("id", [match.player1_id, match.player2_id ?? match.player1_id]),
    ]);
    const prof = (id: string | null) => profiles?.find((p) => p.id === id) ?? null;

    const { data: answers } = await db
      .from("match_answers")
      .select("user_id, question_index, choice, is_correct")
      .eq("match_id", match.id);
    const rows = answers ?? [];
    const mine = rows
      .filter((r) => r.user_id === uid)
      .sort((a, b) => a.question_index - b.question_index);
    const theirs = opponentId ? rows.filter((r) => r.user_id === opponentId) : [];

    const currentIndex = round.index;
    let question: null | {
      id: string;
      index: number;
      subject: string;
      topic: string;
      stem: string;
      options: { key: string; text: string }[];
    } = null;
    let waitingForOpponent = false;
    let myChoice: string | null = null;

    if (match.status === "active" && currentIndex < total) {
      const qid = match.question_ids[currentIndex]!;
      const { data: q } = await db
        .from("questions")
        .select("subject, topic, stem, option_a, option_b, option_c, option_d")
        .eq("id", qid)
        .single();
      if (q) {
        question = {
          id: qid,
          index: currentIndex,
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
        waitingForOpponent =
          !isSolo &&
          mine.some((r) => r.question_index === currentIndex) &&
          !theirs.some((r) => r.question_index === currentIndex);
        myChoice = mine.find((r) => r.question_index === currentIndex)?.choice ?? null;
      }
    }

    const myScore = mine.filter((r) => r.is_correct).length;
    const oppScore = theirs.filter((r) => r.is_correct).length;
    const myMarks = jeeMarks(mine.map((r) => ({ is_correct: r.is_correct, choice: r.choice })));
    const oppMarks = jeeMarks(theirs.map((r) => ({ is_correct: r.is_correct, choice: r.choice })));
    const myDelta = isP1 ? match.player1_delta : match.player2_delta;
    const meProfile = prof(uid);

    const afkSince = isP1 ? match.player1_afk_since : match.player2_afk_since;
    const afk = afkSince
      ? {
          flagged: true,
          forfeitAt: new Date(
            new Date(afkSince).getTime() + AFK_GRACE_SECONDS * 1000,
          ).toISOString(),
        }
      : { flagged: false, forfeitAt: null };

    // Result of the round that just closed (the one before the current one).
    let lastResult: {
      id: string | null;
      index: number;
      mine: { choice: string | null; correct: boolean; missed: boolean };
      theirs: { choice: string | null; correct: boolean; missed: boolean } | null;
      correctOption: string | null;
      stem: string | null;
      options: { key: string; text: string }[];
    } | null = null;
    if (match.status === "active" && currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      const myA = mine.find((r) => r.question_index === prevIndex);
      const oppA = opponentId ? theirs.find((r) => r.question_index === prevIndex) : null;
      const { data: prevQ } = await db
        .from("questions")
        .select("stem, option_a, option_b, option_c, option_d, correct_option")
        .eq("id", match.question_ids[prevIndex]!)
        .single();
      lastResult = {
        id: match.question_ids[prevIndex] ?? null,
        index: prevIndex,
        mine: { choice: myA?.choice ?? null, correct: myA ? myA.is_correct : false, missed: !myA },
        theirs: opponentId
          ? { choice: oppA?.choice ?? null, correct: oppA ? oppA.is_correct : false, missed: !oppA }
          : null,
        correctOption: prevQ?.correct_option ?? null,
        stem: prevQ?.stem ?? null,
        options: prevQ
          ? [
              { key: "A", text: prevQ.option_a },
              { key: "B", text: prevQ.option_b },
              { key: "C", text: prevQ.option_c },
              { key: "D", text: prevQ.option_d },
            ]
          : [],
      };
    }

    // Full question review for finished matches.
    let questionReview: {
      id: string;
      index: number;
      subject: string;
      topic: string;
      stem: string;
      options: { key: string; text: string }[];
      correctOption: string;
      myChoice: string | null;
      myCorrect: boolean;
      myMissed: boolean;
      oppChoice: string | null;
      oppCorrect: boolean;
      oppMissed: boolean;
    }[] = [];
    if (match.status === "finished") {
      const qids: string[] = match.question_ids;
      const { data: allQs } = await db
        .from("questions")
        .select("id, subject, topic, stem, option_a, option_b, option_c, option_d, correct_option")
        .in("id", qids);
      questionReview = qids.map((qid, i) => {
        const q = allQs?.find((x) => x.id === qid);
        const myA = mine.find((r) => r.question_index === i);
        const oppA = theirs.find((r) => r.question_index === i);
        return {
          id: q?.id ?? qid,
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
          correctOption: q?.correct_option ?? "",
          myChoice: myA?.choice ?? null,
          myCorrect: myA ? myA.is_correct : false,
          myMissed: !myA,
          oppChoice: oppA?.choice ?? null,
          oppCorrect: oppA ? oppA.is_correct : false,
          oppMissed: !oppA,
        };
      });
    }

    return {
      matchId: match.id,
      status: match.status,
      isRanked: match.is_ranked !== false,
      isSolo,
      total,
      endsAt: match.ends_at,
      secondsPerQuestion: Math.round(match.duration_seconds / total),
      questionEndsAt: question ? round.endsAt : null,
      waitingForOpponent,
      myChoice,
      lastResult,
      afk,
      forfeitedByMe: match.forfeiter_id === uid,
      forfeitReason: match.forfeit_reason ?? null,
      serverNow: new Date().toISOString(),
      me: {
        username: meProfile?.username ?? "You",
        elo: meProfile?.elo ?? 1200,
        rank: rankTitle(meProfile?.elo ?? 1200),
        avatar_url: meProfile?.avatar_url ?? null,
        is_admin: admins.has(uid),
        answered: mine.length,
        correct: myScore,
        marks: myMarks,
      },
      opponent: opponentId
        ? {
            username: prof(opponentId)?.username ?? "Opponent",
            elo: prof(opponentId)?.elo ?? 1200,
            rank: rankTitle(prof(opponentId)?.elo ?? 1200),
            avatar_url: prof(opponentId)?.avatar_url ?? null,
            is_admin: admins.has(opponentId),
            answered: theirs.length,
            correct: match.status === "finished" ? oppScore : null,
            marks: match.status === "finished" ? oppMarks : null,
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
              myMarks,
              oppMarks,
            }
          : null,
      questionReview,
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
    const { adminClient, advanceMatch, finalizeIfDone } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: match } = await db
      .from("matches")
      .select("*")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Error("Match not found");
    if (match.player1_id !== uid && match.player2_id !== uid) throw new Error("Not your match");
    if (match.status !== "active") return { ok: false, reason: "Match is not live" };

    // Lock-step: only the currently open 2-minute round accepts an answer.
    const round = await advanceMatch(match);
    if (round.done) {
      await finalizeIfDone(match);
      return { ok: false, reason: "That question's 2 minutes are up" };
    }
    if (data.index !== round.index) {
      return { ok: false, reason: "Not your turn to answer this question" };
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

    // Answering proves you are present — clear any anti-AFK flag.
    const afkCol = uid === match.player1_id ? "player1_afk_since" : "player2_afk_since";
    const roundCol = uid === match.player1_id ? "player1_afk_round" : "player2_afk_round";
    await db
      .from("matches")
      .update({ [afkCol]: null, [roundCol]: null })
      .eq("id", match.id)
      .eq("status", "active");

    // Round may now advance (both answered) or the bot may answer.
    // Re-fetch the match to avoid stale state (e.g. last question finalisation).
    const { data: freshMatch } = await db
      .from("matches")
      .select("*")
      .eq("id", match.id)
      .maybeSingle();
    const next = await advanceMatch(freshMatch ?? match);
    if (next.done) await finalizeIfDone(freshMatch ?? match);
    return { ok: true, isCorrect };
  });

export const forfeitMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminClient, settleMatch } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: match } = await db
      .from("matches")
      .select("*")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) return { ok: false, reason: "Match not found" };
    if (match.player1_id !== uid && match.player2_id !== uid)
      return { ok: false, reason: "Not your match" };
    if (match.status !== "active") return { ok: false, reason: "Match is already over" };

    const isP1 = match.player1_id === uid;
    const settled = await settleMatch(match, isP1 ? 0 : 1, uid, "manual");
    if (!settled) return { ok: false, reason: "Could not update match — try again" };
    return { ok: true };
  });

export const getUserStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: matches } = await db
      .from("matches")
      .select("status, is_ranked, is_bot_match, player1_id, player2_id, winner_id, subject_filter")
      .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
      .eq("status", "finished");

    const { count: totalAnswers } = await db
      .from("match_answers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);

    const { count: correctAnswers } = await db
      .from("match_answers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("is_correct", true);

    const rows = matches ?? [];

    let ranked = 0,
      rankedW = 0,
      rankedL = 0,
      rankedD = 0;
    let unranked = 0,
      unrankedW = 0,
      unrankedL = 0,
      unrankedD = 0;
    let solo = 0,
      soloW = 0,
      soloL = 0,
      soloD = 0;
    let duo = 0,
      duoW = 0,
      duoL = 0,
      duoD = 0;
    let botMatches = 0,
      botWins = 0;
    const subjects: Record<string, { played: number; wins: number }> = {};

    for (const m of rows) {
      const isRanked = m.is_ranked !== false;
      const isSolo = !m.player2_id;
      const isBot = m.is_bot_match;
      const won = m.winner_id === uid;
      const lost = m.winner_id !== null && m.winner_id !== uid;
      const drawn = m.winner_id === null;

      if (isRanked) {
        ranked++;
        if (won) rankedW++;
        else if (lost) rankedL++;
        else rankedD++;
      } else {
        unranked++;
        if (won) unrankedW++;
        else if (lost) unrankedL++;
        else unrankedD++;
      }

      if (isSolo) {
        solo++;
        if (won) soloW++;
        else if (lost) soloL++;
        else soloD++;
      } else {
        duo++;
        if (won) duoW++;
        else if (lost) duoL++;
        else duoD++;
      }

      if (isBot) {
        botMatches++;
        if (won) botWins++;
      }

      const subj = m.subject_filter ?? "mixed";
      if (!subjects[subj]) subjects[subj] = { played: 0, wins: 0 };
      subjects[subj].played++;
      if (won) subjects[subj].wins++;
    }

    return {
      totalMatches: rows.length,
      ranked: { played: ranked, wins: rankedW, losses: rankedL, draws: rankedD },
      unranked: { played: unranked, wins: unrankedW, losses: unrankedL, draws: unrankedD },
      solo: { played: solo, wins: soloW, losses: soloL, draws: soloD },
      duo: { played: duo, wins: duoW, losses: duoL, draws: duoD },
      bot: { played: botMatches, wins: botWins },
      subjects,
      accuracy: {
        total: totalAnswers ?? 0,
        correct: correctAnswers ?? 0,
        pct: totalAnswers ? Math.round(((correctAnswers ?? 0) / totalAnswers) * 100) : 0,
      },
    };
  });

export const confirmActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { adminClient, advanceMatch } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    const { data: match } = await db
      .from("matches")
      .select("*")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) return { ok: false, reason: "Match not found" };
    if (match.player1_id !== uid && match.player2_id !== uid)
      return { ok: false, reason: "Not your match" };
    if (match.status !== "active") return { ok: true };

    // Record the round this confirmation applies to, so the flag can't re-fire
    // for the same question — the popup must not loop while you're still here.
    const round = await advanceMatch(match);
    const afkCol = uid === match.player1_id ? "player1_afk_since" : "player2_afk_since";
    const roundCol = uid === match.player1_id ? "player1_afk_round" : "player2_afk_round";
    const { error } = await db
      .from("matches")
      .update({ [afkCol]: null, [roundCol]: round.done ? null : round.index })
      .eq("id", match.id)
      .eq("status", "active");
    if (error) return { ok: false, reason: "Could not save confirmation — try again" };
    return { ok: true };
  });

export const getQuestionExplanations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        questions: z.array(
          z.object({
            index: z.number(),
            subject: z.string(),
            topic: z.string(),
            stem: z.string(),
            options: z.array(z.object({ key: z.string(), text: z.string() })),
            correctOption: z.string(),
            myChoice: z.string().nullable(),
            myCorrect: z.boolean(),
          }),
        ),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!checkRateLimit(`explanations:${context.userId}`, 5, 60 * 60 * 1000)) {
      throw new Error("Too many requests — please wait before requesting more explanations");
    }
    const { generateWithFallback } = await import("./gemini.server");

    const questionsForPrompt = data.questions.map((q) => ({
      index: q.index,
      subject: q.subject,
      topic: q.topic,
      stem: q.stem,
      options: q.options.map((o) => `${o.key}. ${o.text}`),
      correctOption: q.correctOption,
    }));

    const prompt = `You are an expert JEE exam tutor. For each question below, provide a detailed solution.

For each question, return a JSON object with these exact keys:
- "index": the question index (number)
- "concepts": array of key concepts/topics needed to solve this question (strings)
- "formulas": array of relevant formulas wrapped in $ delimiters for LaTeX rendering (e.g. ["$F = ma$", "$E = mc^2$"])
- "solution": detailed step-by-step solution explaining how to arrive at the correct answer (string, use \\n for line breaks, wrap math in $ delimiters for LaTeX rendering)
- "whyWrong": object mapping each incorrect option letter to a brief explanation of why it is incorrect (e.g. {"A": " explanation...", "C": " explanation..."})

Questions:
${JSON.stringify(questionsForPrompt, null, 2)}

Return ONLY a valid JSON array containing one object per question. No markdown fences, no extra text, no commentary.`;

    const raw = await generateWithFallback(prompt);

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return {
        explanations: data.questions.map((q) => ({
          index: q.index,
          concepts: [] as string[],
          formulas: [] as string[],
          solution: "Explanation unavailable. Please try again.",
          whyWrong: {} as Record<string, string>,
        })),
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        index: number;
        concepts: string[];
        formulas: string[];
        solution: string;
        whyWrong: Record<string, string>;
      }>;

      return {
        explanations: data.questions.map((q) => {
          const ai = parsed.find((p) => p.index === q.index);
          return {
            index: q.index,
            concepts: ai?.concepts ?? [],
            formulas: ai?.formulas ?? [],
            solution: ai?.solution ?? "Explanation unavailable.",
            whyWrong: ai?.whyWrong ?? {},
          };
        }),
      };
    } catch {
      return {
        explanations: data.questions.map((q) => ({
          index: q.index,
          concepts: [] as string[],
          formulas: [] as string[],
          solution: "Could not parse explanation. Please try again.",
          whyWrong: {} as Record<string, string>,
        })),
      };
    }
  });

export const REPORT_REASONS = [
  "missing_options",
  "incorrect_option",
  "wrong_answer",
  "missing_info",
  "rendering_issue",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const submitQuestionReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        questionId: z.string().uuid(),
        matchId: z.string().uuid().nullable().optional(),
        questionIndex: z.number().int().min(0).max(49).nullable().optional(),
        reason: z.enum(REPORT_REASONS),
        details: z.string().trim().max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { adminClient } = await import("./game.server");
    const db = adminClient();
    const uid = context.userId;

    // The question must actually exist.
    const { data: q } = await db
      .from("questions")
      .select("id")
      .eq("id", data.questionId)
      .maybeSingle();
    if (!q) return { ok: false as const, reason: "Question not found" };

    // If a match is referenced, it must be one of the reporter's own matches.
    let matchId: string | null = null;
    if (data.matchId) {
      const { data: m } = await db
        .from("matches")
        .select("id")
        .eq("id", data.matchId)
        .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
        .maybeSingle();
      matchId = m?.id ?? null;
    }

    // Flood cap: at most 10 reports per user per rolling 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("question_reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_by", uid)
      .gte("created_at", since);
    if ((count ?? 0) >= 10) {
      return {
        ok: false as const,
        reason: "Daily report limit reached — please try again tomorrow",
      };
    }

    const { error } = await db.from("question_reports").insert({
      question_id: data.questionId,
      match_id: matchId,
      question_index: data.questionIndex ?? null,
      reported_by: uid, // always the verified caller — never client-supplied
      reason: data.reason,
      details: data.details ? data.details : null,
    });
    if (error) {
      if (error.code === "23505") {
        return {
          ok: false as const,
          duplicate: true as const,
          reason: "You have already reported this question",
        };
      }
      throw new Error(error.message);
    }
    return { ok: true as const };
  });

export type QuestionReportRow = {
  id: string;
  question_id: string;
  match_id: string | null;
  question_index: number | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  question: {
    subject: string;
    topic: string;
    stem: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
  } | null;
  reporterUsername: string | null;
};

export const getQuestionReports = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { adminClient } = await import("./game.server");
    const db = adminClient();

    const { data: reports, error } = await db
      .from("question_reports")
      .select("*")
      .order("status", { ascending: false }) // open before resolved
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = reports ?? [];

    const qids = Array.from(new Set(rows.map((r) => r.question_id)));
    const uids = Array.from(new Set(rows.map((r) => r.reported_by)));

    const { data: qs } = qids.length
      ? await db
          .from("questions")
          .select(
            "id, subject, topic, stem, option_a, option_b, option_c, option_d, correct_option",
          )
          .in("id", qids)
      : { data: [] };
    const { data: ps } = uids.length
      ? await db.from("profiles").select("id, username").in("id", uids)
      : { data: [] };

    return rows.map((r): QuestionReportRow => ({
      id: r.id,
      question_id: r.question_id,
      match_id: r.match_id,
      question_index: r.question_index,
      reason: r.reason,
      details: r.details,
      status: r.status,
      created_at: r.created_at,
      question: qs?.find((q) => q.id === r.question_id) ?? null,
      reporterUsername: ps?.find((p) => p.id === r.reported_by)?.username ?? null,
    }));
  });

export const setReportStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) =>
    z.object({ reportId: z.string().uuid(), status: z.enum(["open", "resolved"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { adminClient } = await import("./game.server");
    const { error } = await adminClient()
      .from("question_reports")
      .update({ status: data.status })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type AdminStats = {
  dau: number;
  wau: number;
  mau: number;
  duelsMonth: number;
  duelsTotal: number;
  newPlayersMonth: number;
  guestPlaysMonth: number;
  guestPlaysTotal: number;
};

function countDistinctPlayers(
  rows: { player1_id: string; player2_id: string | null }[] | null,
): number {
  const seen = new Set<string>();
  for (const r of rows ?? []) {
    seen.add(r.player1_id);
    if (r.player2_id) seen.add(r.player2_id);
  }
  return seen.size;
}

/** Admin-only traffic + engagement stats computed from our own tables. */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async (): Promise<AdminStats> => {
    const { adminClient } = await import("./game.server");
    const db = adminClient();

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600e3).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 3600e3).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [day, week, month, total, newPlayers, guestMonth, guestTotal] = await Promise.all([
      db.from("matches").select("player1_id,player2_id").gte("created_at", dayAgo),
      db.from("matches").select("player1_id,player2_id").gte("created_at", weekAgo),
      db
        .from("matches")
        .select("player1_id,player2_id", { count: "exact" })
        .gte("created_at", monthStart),
      db.from("matches").select("*", { count: "exact", head: true }),
      db
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_bot", false)
        .gte("created_at", monthStart),
      db
        .from("guest_plays")
        .select("*", { count: "exact", head: true })
        .gte("created_at", monthStart),
      db.from("guest_plays").select("*", { count: "exact", head: true }),
    ]);

    return {
      dau: countDistinctPlayers(day.data),
      wau: countDistinctPlayers(week.data),
      mau: countDistinctPlayers(month.data),
      duelsMonth: month.count ?? month.data?.length ?? 0,
      duelsTotal: total.count ?? 0,
      newPlayersMonth: newPlayers.count ?? 0,
      guestPlaysMonth: guestMonth.count ?? 0,
      guestPlaysTotal: guestTotal.count ?? 0,
    };
  });
