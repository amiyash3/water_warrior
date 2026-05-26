# Water Warrior

A social hydration tracking app built with React and Vite.

## Setup

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks (via jsconfig)

## Data storage

The app uses a **local-first API** (`src/api/client.js`) backed by `localStorage`. No external backend is required for development. Demo users are seeded automatically for the Discover page.

To reset all local data, clear site storage in your browser dev tools.
