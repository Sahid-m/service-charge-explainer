# Real Estate GB

Hackathon project for exploring real estate in Great Britain.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000.

## Scripts

- `pnpm dev` - start the dev server
- `pnpm build` - production build
- `pnpm start` - run the production build
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run the TypeScript compiler (no emit)
- `pnpm format` - format the repo with Prettier

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add <name>
```

## Deploy

Deployed on Vercel. Set any env vars from `.env.example` in the Vercel project settings.
