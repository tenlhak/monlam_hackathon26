# Web

Vite + React + TypeScript starter with:

- **TanStack React Query** — server state
- **shadcn/ui + Tailwind CSS v4** — UI components
- **Axios** — HTTP client

## Setup

```bash
npm install
npm run dev
```

Optional: copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Lint with oxlint |

## Project layout

```
src/
  components/ui/   # shadcn components
  hooks/           # React Query hooks
  lib/             # api (axios), query-client, utils
  providers/       # AppProviders (React Query)
```

## Add shadcn components

```bash
npx shadcn@latest add card input
```
