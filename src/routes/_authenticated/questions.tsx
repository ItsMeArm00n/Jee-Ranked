import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllQuestions, isAdmin } from "@/lib/game.functions";
import { renderLatex } from "@/lib/latex";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/questions")({
  beforeLoad: async () => {
    // Admin-only page. The data server function enforces this too —
    // this redirect is just a friendlier UX for non-admins.
    const admin = await isAdmin();
    if (!admin) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [{ title: "Question Bank — JEE Ranked" }],
  }),
  component: QuestionsPage,
});

const SUBJECT_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Physics: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/25",
    dot: "bg-blue-400",
  },
  Chemistry: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400",
  },
  Mathematics: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/25",
    dot: "bg-violet-400",
  },
};
const DEFAULT_STYLE = {
  bg: "bg-muted",
  text: "text-muted-foreground",
  border: "border-border",
  dot: "bg-muted-foreground",
};

type BankQuestion = {
  id: string;
  subject: string;
  topic: string;
  stem: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

function render(text: string): string {
  if (!text) return "";
  return renderLatex(text);
}

function QuestionsPage() {
  const fetchQuestions = useServerFn(getAllQuestions);
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["all-questions"],
    queryFn: () => fetchQuestions({}),
  });

  const [subjectFilter, setSubjectFilter] = useState("All");
  const [topicFilter, setTopicFilter] = useState("All");
  const [search, setSearch] = useState("");

  const topics = useMemo(() => {
    const set = new Set(questions.map((q) => q.topic));
    return ["All", ...Array.from(set).sort()];
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (subjectFilter !== "All" && q.subject !== subjectFilter) return false;
      if (topicFilter !== "All" && q.topic !== topicFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return q.stem.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s);
      }
      return true;
    });
  }, [questions, subjectFilter, topicFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, BankQuestion[]>>();
    for (const q of filtered) {
      if (!map.has(q.subject)) map.set(q.subject, new Map());
      const topicMap = map.get(q.subject)!;
      if (!topicMap.has(q.topic)) topicMap.set(q.topic, []);
      topicMap.get(q.topic)!.push(q);
    }
    return map;
  }, [filtered]);

  const OPTION_LETTERS = ["A", "B", "C", "D"];
  const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d"] as const;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Question Bank</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading..."
              : `${filtered.length} question${filtered.length !== 1 ? "s" : ""} across ${grouped.size} subject${grouped.size !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
            {(["All", "Physics", "Chemistry", "Mathematics"] as const).map((s) => {
              const active = subjectFilter === s;
              const style = SUBJECT_STYLES[s];
              return (
                <button
                  key={s}
                  onClick={() => {
                    setSubjectFilter(s);
                    setTopicFilter("All");
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                    active
                      ? style
                        ? `${style.bg} ${style.text} ${style.border} border`
                        : "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "All" ? "All" : s === "Mathematics" ? "Maths" : s.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs bg-muted text-foreground border border-border/50 w-56 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-24 text-muted-foreground text-sm">
            Loading questions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground text-sm">
            No questions match your filters.
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(grouped.entries()).map(([subject, topicMap]) => {
              const style = SUBJECT_STYLES[subject] ?? DEFAULT_STYLE;
              let runningIndex = 0;
              const prevSubjects = Array.from(grouped.entries()).filter(([s]) => s < subject);
              const offset = prevSubjects.reduce((sum, [, tm]) => {
                return sum + Array.from(tm.values()).reduce((s, qs) => s + qs.length, 0);
              }, 0);

              return (
                <section key={subject}>
                  <div className={`flex items-center gap-3 mb-5 pb-3 border-b ${style.border}`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                    <h2 className={`text-lg font-bold ${style.text}`}>{subject}</h2>
                    <span className="text-xs text-muted-foreground font-mono">
                      {Array.from(topicMap.values()).reduce((s, qs) => s + qs.length, 0)} questions
                    </span>
                  </div>

                  {Array.from(topicMap.entries()).map(([topic, qs]) => (
                    <div key={topic} className="mb-6">
                      <div className="flex items-center gap-2 mb-3 ml-1">
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full ${style.dot} opacity-50`}
                        />
                        <h3 className="text-sm font-semibold text-foreground/80">{topic}</h3>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({qs.length})
                        </span>
                      </div>

                      <div className="space-y-3 ml-4">
                        {qs.map((q) => {
                          const num = offset + runningIndex + 1;
                          runningIndex++;
                          return (
                            <div
                              key={q.id}
                              className="rounded-lg border border-border/60 bg-card/50 hover:bg-card transition-colors"
                            >
                              <div className="p-4">
                                <div className="flex gap-3">
                                  <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                    {num}
                                  </span>
                                  <div
                                    className="text-sm leading-relaxed text-foreground/90 flex-1 min-w-0 [&_.katex]:text-sm"
                                    dangerouslySetInnerHTML={{ __html: render(q.stem) }}
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 ml-9">
                                  {OPTION_KEYS.map((key, j) => (
                                    <div
                                      key={key}
                                      className="flex items-start gap-2.5 rounded-md bg-muted/40 border border-border/30 px-3 py-2"
                                    >
                                      <span
                                        className={`shrink-0 w-5 h-5 rounded-full ${style.bg} ${style.border} border flex items-center justify-center text-[10px] font-bold ${style.text}`}
                                      >
                                        {OPTION_LETTERS[j]}
                                      </span>
                                      <span
                                        className="text-sm text-foreground/80 leading-relaxed pt-0.5 min-w-0 [&_.katex]:text-sm"
                                        dangerouslySetInnerHTML={{ __html: render(q[key] ?? "") }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
