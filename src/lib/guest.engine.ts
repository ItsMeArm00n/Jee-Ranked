export type GuestMode = "solo" | "bot";

export type GuestQuestion = {
  id: string;
  subject: string;
  topic: string;
  stem: string;
  options: { key: string; text: string }[];
  correctOption: string;
};

export type GuestAnswer = {
  choice: string | null;
  isCorrect: boolean;
  atMs: number;
};

export type BotPlan = { index: number; atMs: number; correct: boolean }[];

export type GuestGame = {
  token: string;
  mode: GuestMode;
  name: string;
  subject: string;
  secondsPerQuestion: number;
  questions: GuestQuestion[];
  startedAt: number;
  me: Record<number, GuestAnswer>;
  bot: { name: string; plan: BotPlan; answers: Record<number, GuestAnswer> } | null;
  status: "active" | "finished";
  finishedAt: number | null;
};

const CORRECT_MARKS = 4;
const WRONG_MARKS = -1;
const UNANSWERED_MARKS = 0;

function jeeMarks(answers: { choice: string | null; isCorrect: boolean }[]): number {
  return answers.reduce((sum, a) => {
    if (a.choice === null) return sum + UNANSWERED_MARKS;
    return sum + (a.isCorrect ? CORRECT_MARKS : WRONG_MARKS);
  }, 0);
}

function randomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  const arr = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildBotPlan(total: number, windowMs: number): BotPlan {
  return Array.from({ length: total }, (_, i) => ({
    index: i,
    atMs: Math.round(windowMs * (0.12 + Math.random() * 0.7)),
    correct: Math.random() < 0.6,
  }));
}

function pickWrong(q: GuestQuestion): string {
  const wrong = q.options.filter((o) => o.key !== q.correctOption);
  return wrong[Math.floor(Math.random() * wrong.length)]!.key;
}

export type GuestBundle = {
  token: string;
  mode: GuestMode;
  name: string;
  subject: string;
  secondsPerQuestion: number;
  startedAt: number;
  questions: GuestQuestion[];
  botPlan: BotPlan | null;
};

export function createGuestGame(bundle: GuestBundle): GuestGame {
  return {
    token: bundle.token,
    mode: bundle.mode,
    name: bundle.name,
    subject: bundle.subject,
    secondsPerQuestion: bundle.secondsPerQuestion,
    questions: bundle.questions,
    startedAt: Date.now(),
    me: {},
    bot: bundle.botPlan ? { name: "BOT", plan: bundle.botPlan, answers: {} } : null,
    status: "active",
    finishedAt: null,
  };
}

type RoundStart = { index: number; startMs: number; deadlineMs: number; done: boolean };

/** Compute the current round. Lock-step for bot mode, immediate for solo. */
function computeRound(game: GuestGame): RoundStart {
  const total = game.questions.length;
  const windowMs = game.secondsPerQuestion * 1000;
  const now = Date.now();
  let roundStart = game.startedAt;
  const solo = game.mode === "solo";

  for (let i = 0; i < total; i++) {
    const deadline = roundStart + windowMs;
    const a1 = game.me[i];

    if (!solo && game.bot && !game.bot.answers[i]) {
      const step = game.bot.plan.find((s) => s.index === i);
      const botAt = Math.min(roundStart + (step?.atMs ?? windowMs * 0.6), deadline);
      if (now >= botAt) {
        const q = game.questions[i]!;
        const choice = step?.correct ? q.correctOption : pickWrong(q);
        game.bot.answers[i] = { choice, isCorrect: !!step?.correct, atMs: botAt };
      }
    }

    const a2 = solo ? null : game.bot?.answers[i];

    if (solo) {
      if (a1) {
        roundStart = a1.atMs;
        continue;
      }
      if (now >= deadline) {
        game.me[i] = { choice: null, isCorrect: false, atMs: deadline };
        roundStart = deadline;
        continue;
      }
      return { index: i, startMs: roundStart, deadlineMs: deadline, done: false };
    }

    if (a1 && a2) {
      roundStart = Math.max(a1.atMs, a2.atMs);
      continue;
    }
    if (now >= deadline) {
      if (!a1) game.me[i] = { choice: null, isCorrect: false, atMs: deadline };
      if (!a2 && game.bot) {
        game.bot.answers[i] = {
          choice: pickWrong(game.questions[i]!),
          isCorrect: false,
          atMs: deadline,
        };
      }
      roundStart = deadline;
      continue;
    }
    return { index: i, startMs: roundStart, deadlineMs: deadline, done: false };
  }

  game.status = "finished";
  game.finishedAt = now;
  return { index: total, startMs: roundStart, deadlineMs: roundStart, done: true };
}

export function answerGuestQuestion(
  game: GuestGame,
  index: number,
  choice: string,
): { ok: boolean; isCorrect: boolean; reason?: string } {
  const round = computeRound(game);
  if (game.status !== "active") return { ok: false, isCorrect: false, reason: "Match is over" };
  if (index !== round.index) {
    return { ok: false, isCorrect: false, reason: "Too late — that question has passed" };
  }
  if (game.me[index]) return { ok: false, isCorrect: false, reason: "Already answered" };

  const q = game.questions[index]!;
  const isCorrect = q.correctOption === choice;
  game.me[index] = { choice, isCorrect, atMs: Date.now() };
  computeRound(game);
  return { ok: true, isCorrect };
}

export type GuestSnapshot = {
  token: string;
  mode: GuestMode;
  name: string;
  subject: string;
  secondsPerQuestion: number;
  status: "active" | "finished";
  total: number;
  currentIndex: number;
  now: number;
  roundEndsAt: number | null;
  question: (Omit<GuestQuestion, "correctOption"> & { index: number }) | null;
  myChoice: string | null;
  botChoice: string | null;
  me: { name: string; answered: number; correct: number; marks: number };
  bot: { name: string; answered: number; correct: number; marks: number } | null;
  result: {
    outcome: "win" | "loss" | "draw";
    myCorrect: number;
    botCorrect: number;
    myMarks: number;
    botMarks: number;
  } | null;
};

export function getSnapshot(game: GuestGame): GuestSnapshot {
  const total = game.questions.length;
  const round = computeRound(game);
  const currentIndex = round.done ? total : round.index;
  const question = !round.done ? (game.questions[currentIndex] ?? null) : null;
  const myCorrect = Object.values(game.me).filter((a) => a.isCorrect).length;
  const botCorrect = game.bot
    ? Object.values(game.bot.answers).filter((a) => a.isCorrect).length
    : 0;
  const myChoice = question ? (game.me[currentIndex]?.choice ?? null) : null;
  const botChoice = question ? (game.bot?.answers[currentIndex]?.choice ?? null) : null;
  const myMarks = jeeMarks(Object.values(game.me));
  const botMarks = game.bot ? jeeMarks(Object.values(game.bot.answers)) : null;

  let result: GuestSnapshot["result"] = null;
  if (game.status === "finished") {
    if (game.mode === "solo") {
      result = { outcome: "win", myCorrect, botCorrect: 0, myMarks, botMarks: 0 };
    } else {
      const outcome =
        myMarks > (botMarks ?? 0) ? "win" : myMarks < (botMarks ?? 0) ? "loss" : "draw";
      result = { outcome, myCorrect, botCorrect, myMarks: myMarks, botMarks: botMarks ?? 0 };
    }
  }

  return {
    token: game.token,
    mode: game.mode,
    name: game.name,
    subject: game.subject,
    secondsPerQuestion: game.secondsPerQuestion,
    status: game.status,
    total,
    currentIndex,
    now: Date.now(),
    roundEndsAt: round.done ? null : round.deadlineMs,
    question: question
      ? {
          id: question.id,
          index: currentIndex,
          subject: question.subject,
          topic: question.topic,
          stem: question.stem,
          options: question.options,
        }
      : null,
    myChoice,
    botChoice,
    me: {
      name: game.name,
      answered: Object.keys(game.me).length,
      correct: myCorrect,
      marks: myMarks,
    },
    bot: game.bot
      ? {
          name: game.bot.name,
          answered: Object.keys(game.bot.answers).length,
          correct: botCorrect,
          marks: botMarks ?? 0,
        }
      : null,
    result,
  };
}

export function newGuestBundle(input: {
  mode: GuestMode;
  name: string;
  subject: string;
  secondsPerQuestion: number;
  questions: GuestQuestion[];
}): GuestBundle {
  return {
    token: randomUUID(),
    mode: input.mode,
    name: input.name,
    subject: input.subject,
    secondsPerQuestion: input.secondsPerQuestion,
    startedAt: Date.now(),
    questions: input.questions,
    botPlan:
      input.mode === "bot"
        ? buildBotPlan(input.questions.length, input.secondsPerQuestion * 1000)
        : null,
  };
}
