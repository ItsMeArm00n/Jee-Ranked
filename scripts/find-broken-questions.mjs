/**
 * Detects questions from NEW JEE DATA CSVs that are unanswerable because the
 * figure/diagram/graph they reference was never captured, or because options
 * are placeholders ("Graph 1", "Option 2") or dangling references
 * ("C,D only" with no statements A-E in the stem).
 *
 * Outputs:
 *   supabase/broken-questions-report.csv  (human review)
 *   supabase/remove_broken_questions.sql  (live DB cleanup, regex-based)
 *
 * Usage: node scripts/find-broken-questions.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Minimal RFC-4180 CSV parser ────────────────────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

const DATA_FILES = [
  "NEW JEE DATA/jee_2023.csv",
  "NEW JEE DATA/jee_2024.csv",
  "NEW JEE DATA/jee_2025.csv",
];

function loadQuestions() {
  const all = [];
  for (const file of DATA_FILES) {
    const raw = readFileSync(join(process.cwd(), file), "utf8");
    const rows = parseCsv(raw);
    const header = rows[0];
    const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      all.push({
        file,
        line: r + 1,
        id: cols[idx["question_id"]],
        date: cols[idx["date"]],
        subject: cols[idx["subject_name"]],
        chapter: cols[idx["chapter_name"]],
        topic: cols[idx["topic_name"]],
        stem: cols[idx["question_text"]] ?? "",
        options: cols[idx["options"]] ?? "",
        answer: cols[idx["answer_option_number"]],
        answerType: cols[idx["answer_type"]] ?? "",
        solution: cols[idx["solution"]] ?? "",
      });
    }
  }
  return all;
}

// ── Detection rules ────────────────────────────────────────────────────────
// Each rule: { code, reason, stem?: RegExp[], options?: RegExp[], any?: RegExp[] }

const RULES = [
  {
    code: "PLACEHOLDER_OPTS",
    reason: "Options are placeholders (Graph/Diagram/Table/Figure/Option N)",
    // "(1) Graph 1, (2) Graph 2..." / "Diagram-1" / "(1) Option1" etc.
    options: [
      /\(\s*[1-4]\s*\)\s*(graph|diagram|table|figure|plot|option|image|case|curve)\s*-?\s*[1-4]\b/i,
    ],
  },
  {
    code: "EMPTY_OPTS",
    reason: "MCQ with options missing or empty",
    custom(q) {
      // Numerical-answer questions legitimately have no options — skip them.
      if (/numerical/i.test(q.answerType)) return false;
      const raw = q.options.trim();
      if (raw === "") return true;
      // "(1), (2), (3), (4)" — numbered slots with no content
      if (/^[\s(),.0-9]+$/.test(raw)) return true;
      const parts = raw.split("|").map((s) => s.trim());
      const real = parts.filter((p) => p.replace(/[()]/g, "").length >= 2);
      return real.length === 0;
    },
  },
  {
    code: "FIGURE_REF",
    reason: "Stem references a shown/given figure, diagram, circuit or graph",
    stem: [
      // "as shown", "is shown", "are shown" — but not "shown by" (= exhibited)
      /\bshown\b(?!\s+by)/i,
      // "given/following/above/below figure|diagram|circuit|graph|setup|arrangement|configuration"
      /\b(given|following|above|below|second)\s+(figure|fig|diagram|circuit|graph|setup|arrangement|configuration)\b/i,
      // "figure given/shown/below/above", "graph represents [missing curves]"
      /\b(figure|diagram|arrangement)\s+(given|shown|below|above|represents?)\b/i,
      /\bcircuit\s+diagram\b/i,
      /\b[Pp][\s-]?[Vv]\s+(diagram|graph|plot)\b/i,
      /\b(velocity[- ]time|charge[- ]time|v[- ]t)\s+graph\b/i,
      /\bdefined as given\b/i,
      // "two given AC circuits", "given circuit(s)"
      /\bgiven\b[^.]{0,30}\bcircuits?\b/i,
      /\btube of varying\b/i,
      /\bcyclic\s+(PV|P-V)\s+diagram\b/i,
      /\binputs?\s+shown\b/i,
      // "the compound shown is named as" — but not "compound given experimental data"
      /\b(compound|structure|molecule)\s+(shown|given(?!\s+(experimental|data)))\b/i,
      /\bexperiment shown\b/i,
      /\bas per the (given )?(figure|diagram)\b/i,
      /\bin the (given (figure|diagram|arrangement)|following (circuit|figure|diagram|arrangement))\b/i,
      /\brefer to the\b.{0,40}\b(circuit|figure|diagram|graph)\b/i,
      /\busing the given\b.{0,30}\b(diagram|graph|figure)\b/i,
    ],
  },
  {
    code: "DANGLING_REFS",
    reason: "Options reference statement labels (A-E) that are not defined in the stem",
    custom(q) {
      // All four options are pure letter-set combos like "C,D only" / "(A,B,E)"
      const opts = q.options.split("|").map((s) => s.trim()).filter(Boolean);
      if (opts.length !== 4) return false;
      const letterSet = /^\(?\s*[A-E](?:\s*[,，]\s*[A-E])+\s*\)?\s*(only)?\.?$/i;
      if (!opts.every((o) => letterSet.test(o))) return false;
      // Stem must NOT define those labels anywhere (A. / (A) / A: / A, patterns)
      const definesLabel = /\b[A-E]\s*[).:\]]|\([A-E]\)/.test(q.stem);
      return !definesLabel;
    },
  },
];

// Known false-positive stems to always keep (answerable without any image).
const KEEP_PATTERNS = [
  /ellingham diagram/i, // named concept, not a missing image
  /significant figures?/i,
  /figure of merit/i,
  /given below are two statements/i,
  /assertion/i,
  /type of isomerism shown by/i,
  /hybridization is shown by/i,
  /enol content will be shown by/i,
  /optically active isomers shown by/i,
  /number of compounds which give/i,
];
// Option texts that DESCRIBE the graph in words (answerable, no image needed).
const KEEP_OPTION_PATTERNS = [/graph is a line with (positive|negative) slope/i];

function detect(q) {
  const haystack = `${q.stem}\n${q.options}`;
  for (const keep of KEEP_PATTERNS) {
    if (keep.test(haystack)) return null;
  }
  for (const keep of KEEP_OPTION_PATTERNS) {
    if (keep.test(q.options)) return null;
  }
  const hits = [];
  for (const rule of RULES) {
    if (rule.custom) {
      if (rule.custom(q)) hits.push(rule);
      continue;
    }
    const targets = [];
    if (rule.stem && rule.stem.length) targets.push([q.stem, rule.stem]);
    if (rule.options && rule.options.length) targets.push([q.options, rule.options]);
    const matched = targets.every(([text, patterns]) =>
      patterns.some((p) => p.test(text)),
    );
    if (matched) hits.push(rule);
  }
  return hits.length ? hits : null;
}

// ── Main ───────────────────────────────────────────────────────────────────
const questions = loadQuestions();
const flagged = [];
for (const q of questions) {
  const hits = detect(q);
  if (hits) flagged.push({ q, codes: hits.map((h) => h.code).join("+"), reason: hits.map((h) => h.reason).join("; ") });
}

console.log(`Scanned ${questions.length} questions.`);
console.log(`Flagged ${flagged.length} as broken/unanswerable.\n`);

for (const f of flagged) {
  const stem = f.q.stem.replace(/\s+/g, " ").slice(0, 110);
  console.log(`[${f.codes}] (${f.q.file.split("/").pop()} L${f.q.line} id=${f.q.id}) ${stem}`);
}

// Report CSV for manual review
const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const report = [
  ["file", "line", "question_id", "date", "subject", "chapter", "topic", "codes", "reason", "stem", "options", "answer"].join(","),
  ...flagged.map((f) =>
    [
      f.q.file,
      f.q.line,
      f.q.id,
      f.q.date,
      f.q.subject,
      f.q.chapter,
      f.q.topic,
      f.codes,
      f.reason,
      f.q.stem,
      f.q.options,
      f.q.answer,
    ]
      .map(esc)
      .join(","),
  ),
].join("\n");
writeFileSync("supabase/broken-questions-report.csv", report, "utf8");

// ── SQL generation ─────────────────────────────────────────────────────────
// Postgres regexes mirrored from the JS rules above, applied to stem and the
// concatenated options. Only high-precision patterns go into the DELETE so we
// never remove answerable questions.
const PG_STEM_PATTERNS = [
  // "as shown", "is shown", "are shown" (not "shown by")
  `shown(?!\\s+by)`,
  // "given/following/above/below figure|diagram|circuit|graph|setup|arrangement|configuration"
  `(given|following|above|below|second)\\s+(figure|fig|diagram|circuit|graph|setup|arrangement|configuration)`,
  // "figure/diagram/arrangement given|shown|below|above|represents"
  `(figure|diagram|arrangement)\\s+(given|shown|below|above|represents?)`,
  `circuit\\s+diagram`,
  `[Pp][ -]?[Vv]\\s+(diagram|graph|plot)`,
  `(velocity[ -]time|charge[ -]time|v[ -]t)\\s+graph`,
  `defined as given`,
  `given[^.]{0,30}circuits?`,
  `tube of varying`,
  `cyclic\\s*(PV|P-V)\\s+diagram`,
  `inputs?\\s+shown`,
  `(compound|structure|molecule)\\s+(shown|given(?!\\s+(experimental|data)))`,
  `experiment shown`,
  `as per the (given )?(figure|diagram)`,
  `in the (given (figure|diagram|arrangement)|following (circuit|figure|diagram|arrangement))`,
  `refer to the.{0,40}(circuit|figure|diagram|graph)`,
  `using the given.{0,30}(diagram|graph|figure)`,
];

const PG_OPTION_PATTERNS = [
  // "(1) Graph 1" / "(2) Option2" / "(3) Diagram-4" placeholder options
  `\\(\\s*[1-4]\\s*\\)\\s*(graph|diagram|table|figure|plot|option|image|case|curve)\\s*-?\\s*[1-4]`,
];

const KEEP_SQL =
  `(ellingham diagram|significant figures?|figure of merit|given below are two statements|assertion` +
  `|type of isomerism shown by|hybridization is shown by|enol content will be shown by` +
  `|optically active isomers shown by|number of compounds which give)`;

const pgAny = (patterns) => patterns.map((p) => `'${p}'`).join(" , ");

const DELETE_WHERE = `WHERE
  -- protect known-good phrasings
  stem !~* '${KEEP_SQL}'
  AND (
    -- 1. stem references a missing figure/diagram/circuit/graph
    stem ~* ANY (ARRAY[${pgAny(PG_STEM_PATTERNS)}])
    OR
    -- 2. placeholder options like "(1) Graph 1"
    concat_ws(' ', option_a, option_b, option_c, option_d)
      ~* ANY (ARRAY[${pgAny(PG_OPTION_PATTERNS)}])
    OR
    -- 3. options entirely missing
    (
      coalesce(nullif(trim(option_a), ''), '') = ''
      AND coalesce(nullif(trim(option_b), ''), '') = ''
      AND coalesce(nullif(trim(option_c), ''), '') = ''
      AND coalesce(nullif(trim(option_d), ''), '') = ''
    )
    OR
    -- 4. options are bare numbered slots: "(1)," "(2)," ...
    (
      option_a ~* '^[[:space:](),.]*[0-9][[:space:](),.]*$'
      AND option_b ~* '^[[:space:](),.]*[0-9][[:space:](),.]*$'
      AND option_c ~* '^[[:space:](),.]*[0-9][[:space:](),.]*$'
      AND option_d ~* '^[[:space:](),.]*[0-9][[:space:](),.]*$'
    )
  )`;

const sql = `-- Remove broken/unanswerable questions from the live database.
-- Generated by scripts/find-broken-questions.mjs on ${new Date().toISOString()}
--
-- Targets imported questions that can't be answered because their artwork or
-- transcription was lost:
--   1. FIGURE_REF       — stem references a figure/diagram/circuit/graph that isn't there
--   2. PLACEHOLDER_OPTS — options are literally "Graph 1", "Option2", ...
--   3. EMPTY_OPTS       — no option content at all (MCQs only; numericals excluded)
--
-- High-precision regexes only; common false positives (Ellingham diagram,
-- significant figures, "Given below are two statements...", "shown by") are
-- explicitly protected.
--
-- Run the SELECT first to review the count, then COMMIT or ROLLBACK.

BEGIN;

-- Sanity check: what will be deleted?
SELECT subject, count(*) AS rows_to_delete
FROM public.questions
${DELETE_WHERE}
GROUP BY subject;

DELETE FROM public.questions
${DELETE_WHERE};

COMMIT;
`;

writeFileSync("supabase/remove_broken_questions.sql", sql, "utf8");
console.log("\nWrote supabase/broken-questions-report.csv");
console.log("Wrote supabase/remove_broken_questions.sql");
