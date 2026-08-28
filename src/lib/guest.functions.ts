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
