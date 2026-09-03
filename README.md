# JEE RANKED

**1v1 JEE question duels with ELO ranking.** Same paper, same clock, most correct answers takes the rating.

JEE Ranked is a competitive head-to-head quiz platform built for JEE aspirants. Challenge a live opponent to a real-time duel of Physics, Chemistry, and Mathematics questions, climb the ranked leaderboard, or go unranked in solo/bot guest mode to sharpen your speed and accuracy.

## Features

- **1v1 ranked duels** — real-time head-to-head matches with a shared clock; the player who answers most correctly takes the rating.
- **ELO rating system** — every ranked match adjusts your rating, with bots excluded from ranking to keep the leaderboard fair.
- **Live leaderboard** — compete for the top of the global rankings.
- **Guest mode** — play unranked practice, solo or vs a bot, with no account required and nothing saved. No ELO, no leaderboard, no match history.
- **All three subjects** — Physics, Chemistry, and Mathematics, or a mixed "All Subjects" deck.
- **Customizable pace** — set your own time per question (30s to 5:00) in guest mode.
- **Math rendering** — questions render properly formatted LaTeX math via KaTeX with DOMPurify sanitization.
- **Accounts & avatars** — sign in with Supabase Auth, set a display name, and upload a sanitized avatar (PNG/JPEG/GIF/WebP only).
- **Live global stats** — players, duels, and questions served live in the footer.

## Tech Stack

- **[TanStack Start](https://tanstack.com/start)** — full-stack React framework with server functions
- **[TanStack Router](https://tanstack.com/router)** — type-safe, file-based routing
- **[React 19](https://react.dev)** + **[TypeScript](https://www.typescriptlang.org)**
- **[Supabase](https://supabase.com)** — Postgres database, authentication, and service-role access
- **[Tailwind CSS v4](https://tailwindcss.com)** + **[shadcn/ui](https://ui.shadcn.com)** (Radix UI primitives)
- **[KaTeX](https://katex.org)** + **[DOMPurify](https://github.com/cure53/DOMPurify)** — math rendering and sanitization
- **[Vite](https://vitejs.dev)** — build tooling
- **[Vercel Analytics](https://vercel.com/docs/analytics)** — traffic analytics
- **Google Gemini** (`@google/genai`) — server-side content generation

## Getting Started

Requirements: **Node.js 18+** and **npm**. No package manager other than npm is supported.

```sh
# 1. Clone the repository
git clone https://github.com/ItsMeArm00n/Jee-Ranked.git
cd "Jee Ranked"

# 2. Install dependencies
npm install

# 3. Copy the environment template and fill in your values
cp .env.example .env.local

# 4. Start the dev server
npm run dev
```

The dev server runs on `http://localhost:3000` (or the port printed by Vite).

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials. The `VITE_*` prefixed variables are exposed to the browser and must use the **publishable** Supabase key only — never the service-role key. Server-only variables (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) are used only in server functions and must never be exposed client-side.

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Your Supabase project URL, e.g. `https://<project-id>.supabase.co` |
| `SUPABASE_PROJECT_ID` | Yes | Your Supabase project reference ID |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Public Supabase anon/publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server-only.** Service-role key (`sb_secret_...`) — used for privileged DB access, never exposed to the client |
| `GEMINI_API_KEY` | Yes | **Server-only.** Google Gemini API key for server-side generation |
| `VITE_SUPABASE_URL` | Yes | Supabase URL exposed to the client |
| `VITE_SUPABASE_PROJECT_ID` | Yes | Project reference exposed to the client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Publishable key exposed to the client |
| `VITE_SHOW_SERVICE_NOTICE` | No | Toggles a service notice banner (`"true"`/`"false"`) |

### Key security notes

- Use **Supabase publishable/secret keys** (new `sb_publishable_...` / `sb_secret_...` format). The server functions auto-detect both legacy and new key formats.
- Never commit real values in `.env` — they are gitignored (`.env*`). Only commit `.env.example` with placeholders.
- The service-role key and Gemini key live exclusively in server-only modules (`src/integrations/supabase/client.server.ts`, `src/lib/game.server.ts`, `src/lib/gemini.server.ts`).

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build (regenerates `src/routeTree.gen.ts`) |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview the production build locally |
| `npm run format` | Format the codebase with Prettier |

For type checking, run `npx tsc --noEmit`. For linting a specific file or set of files, use `npx eslint <files>`.

## Deployment

JEE Ranked is built for deployment on **Vercel** with Supabase as the backend. Set all server and client environment variables from the table above in your hosting provider's environment settings, then deploy the `main` branch.

## Security

This project is actively hardened:

- **CSP, `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`** security headers set on every response.
- **Rate limiting** (in-memory, auto-cleaning) on guest start, guest play recording, and question explanations.
- **DOMPurify sanitization** of all rendered math/content before it touches the DOM.
- **Avatar uploads restricted** to `data:image/(png|jpeg|gif|webp);base64` — no SVG, no external URLs.
- **ELO exempts bots** — bot matches never affect real ratings.
- **Guest tokens** generated with a cryptographically secure random source.

## Links

- Instagram: [@jeeranked](https://www.instagram.com/jeeranked/)
- YouTube: [@jeeranked](https://www.youtube.com/@jeeranked)
- Email: [info@jeeranked.com](mailto:info@jeeranked.com)

---

© JEE Ranked. All rights reserved.
