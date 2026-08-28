import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pickGuestQuestions } from "./guest.server";
import { newGuestBundle, type GuestMode } from "./guest.engine";

const subjectEnum = z.enum(["Physics", "Chemistry", "Mathematics", "All"]);

const nameSchema = z
  .string()
  .trim()
  .min(3, "Name must be at least 3 characters")
  .max(20, "Name must be at most 20 characters");

export const guestStart = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum<GuestMode, [GuestMode, ...GuestMode[]]>(["solo", "bot"]),
        name: nameSchema,
        subject: subjectEnum,
        secondsPerQuestion: z.number().int().min(30).max(300).default(120),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const count = 10;
    const questions = await pickGuestQuestions(count, data.subject === "All" ? null : data.subject);
    if (questions.length === 0) throw new Error("No questions available for this subject yet");
    return newGuestBundle({
      mode: data.mode,
      name: data.name,
      subject: data.subject,
      secondsPerQuestion: data.secondsPerQuestion,
      questions,
    });
  });

const guestPlaySchema = z.object({
  token: z.string().min(8).max(64),
  mode: z.enum<GuestMode, [GuestMode, ...GuestMode[]]>(["solo", "bot"]),
  subject: subjectEnum,
  correct: z.number().int().min(0).max(300),
  total: z.number().int().min(1).max(300),
});

/**
 * Public, unauthenticated analytics write: records one anonymous row per
 * finished guest game (no personal data — just mode, subject and score) so we
 * can report guest play counts in the admin dashboard. Best-effort: any failure
 * is swallowed so a metrics hiccup never breaks the guest experience.
 */
export const recordGuestPlay = createServerFn({ method: "POST" })
  .inputValidator((d) => guestPlaySchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { adminClient } = await import("./game.server");
      await adminClient().from("guest_plays").insert({
        mode: data.mode,
        subject: data.subject,
        correct: data.correct,
        total: data.total,
      });
    } catch {
      // ignore — anonymous analytics are best-effort
    }
    return { ok: true as const };
  });
