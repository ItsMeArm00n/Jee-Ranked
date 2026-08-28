import { adminClient } from "./game.server";

export const GUEST_QUESTIONS_PER_MATCH = 10;

export type GuestQuestion = {
  id: string;
  subject: string;
  topic: string;
  stem: string;
  options: { key: string; text: string }[];
  correctOption: string;
};

/** Pick `count` random question rows (with correct answers for client-side scoring). */
export async function pickGuestQuestions(
  count: number,
  subject?: string | null,
): Promise<GuestQuestion[]> {
  const db = adminClient();
  let query = db
    .from("questions")
    .select("id, subject, topic, stem, option_a, option_b, option_c, option_d, correct_option");
  if (subject && subject !== "All") query = query.eq("subject", subject);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const pool = data ?? [];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool.slice(0, count).map((q) => ({
    id: q.id,
    subject: q.subject,
    topic: q.topic,
    stem: q.stem,
    options: [
      { key: "A", text: q.option_a },
      { key: "B", text: q.option_b },
      { key: "C", text: q.option_c },
      { key: "D", text: q.option_d },
    ],
    correctOption: q.correct_option,
  }));
}
