# FocusRoom v2

FocusRoom is a customizable deep-work environment that combines focused work sessions, meaningful productivity tracking, high-quality sound, music, and interactive spaces.

This repository is a ground-up rebuild of my original FocusRoom prototype.

## Why rebuild it?

The first version was useful as a prototype, but revisiting it months later exposed several architectural problems:

- audio engines were instantiated from multiple components instead of being owned centrally;
- ambient sound was mostly procedural noise and did not sound convincing;
- browser state and server state could disagree;
- identity was represented by client-generated IDs rather than a real authentication boundary;
- API routes trusted user IDs supplied by the client;
- timer logic depended on one-second interval ticks and could drift;
- rooms tightly coupled visual environments and sound choices;
- deployment configuration became part of the application architecture;
- secrets were committed during early development.

Rather than patch those decisions, v2 starts from first principles with explicit domain boundaries and a cleaner security model.

## Architecture

```text
apps/web
React + TypeScript + Vite
        |
        | Supabase Auth session
        v
apps/api
Hono + TypeScript
        |
        | Prisma
        v
Supabase PostgreSQL
```

Supabase is responsible for authentication and PostgreSQL hosting. The Hono API remains the application boundary for FocusRoom business logic.

## Current foundation

- npm workspaces monorepo
- React 19 + Vite frontend
- Hono API
- Prisma 7
- Supabase PostgreSQL
- Supabase Auth
- authenticated `/me` API boundary
- environment-variable validation
- database migrations
- generated Prisma client excluded from Git

## Repository structure

```text
focusroom-v2/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   └── src/
│   │       ├── config/
│   │       ├── lib/
│   │       ├── middleware/
│   │       └── routes/
│   └── web/
│       └── src/
│           ├── features/
│           └── lib/
├── packages/
└── package.json
```

The `packages/` workspace is reserved for genuinely shared code once the web and API applications have stable shared domain types.

## Local development

Install dependencies:

```bash
npm install
```

Create local environment files from the committed examples:

```text
apps/api/.env.example  -> apps/api/.env
apps/web/.env.example  -> apps/web/.env.local
```

Run the API:

```bash
npm run dev:api
```

Run the frontend in another terminal:

```bash
npm run dev:web
```

The local defaults are:

- web: `http://localhost:5173`
- API: `http://localhost:3001`

## Security

Real environment files are ignored by Git. Only empty/example configuration files are committed.

Never commit database URLs, passwords, service-role keys, OAuth client secrets, or other privileged credentials. Browser-exposed Supabase configuration is limited to the project URL and publishable key.

## Product direction

The rebuild will grow around three systems:

1. **Focus** — sessions, projects, tasks, goals, streaks, and useful analytics.
2. **Sound** — real ambience recordings, music sources, a proper mixer, and an interactive electronic sound lab.
3. **Space** — carefully art-directed environments using React Three Fiber / Three.js where 3D adds meaningful atmosphere.

The first experience milestone will be a single highly polished **Rainy Library** space rather than many shallow room variants.

## Roadmap

- [x] clean repository and secrets strategy
- [x] frontend / API workspace foundation
- [x] Supabase database connection
- [x] Prisma migrations
- [ ] complete authentication UX
- [ ] define the Focus Session domain
- [ ] timestamp-based focus timer
- [ ] central audio engine
- [ ] real ambience mixer
- [ ] local playlist support
- [ ] Rainy Library environment
- [ ] projects, tasks, goals, streaks, and analytics
- [ ] optional Spotify / YouTube integrations
- [ ] offline-first session support

## Status

FocusRoom v2 is under active development. The current code intentionally prioritizes architecture and security before visual/product feature work.
