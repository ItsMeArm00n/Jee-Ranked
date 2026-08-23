# JEE Ranked

Standalone TanStack Start + Supabase project (originally built in Lovable, now self-managed).

## Commands
- `npm run dev` — dev server
- `npm run build` — production build (also regenerates `src/routeTree.gen.ts`)
- `npx tsc --noEmit` — typecheck (no typecheck script exists)
- Full `npm run lint` hangs in this environment; use targeted `npx eslint <files>` instead

## Notes
- Backend is Supabase; all privileged DB access goes through server functions with the service-role key (`src/lib/game.server.ts`). Never expose it client-side.
- Admin model is the locked `admins` table (service-role only). `/questions` and `/admin/reports` are admin-only.
- PowerShell eats `$matchId` in double quotes — single-quote route file paths.
