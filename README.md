# ULPA

Ғарыштық техника және технология (ҒТТ · 1 топ) студенттеріне арналған оқу платформасы.

## Stack
React + Vite, react-router, lucide-react. Backend (next stages): Supabase — Postgres, Auth, Storage, RLS.

## Local development
```bash
npm ci
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## Structure
```
src/
  config/      app-wide settings (time zone, groups, photo types)
  data/        course catalog (moves to Supabase in stage 4)
  lib/         pure logic: GPA formula, Almaty time helpers
  features/    feature state (gpa/)
  components/  layout/ (sidebar, bottom nav) and ui/ (shared building blocks)
  pages/       one file per screen
  styles/      tokens.css (design system) → base → layout → components → pages
```

## Deploy
Every push to `main` builds and publishes to GitHub Pages (`.github/workflows/main.yml`).
Repo Settings → Pages → Source must be **GitHub Actions**. Custom domain: `public/CNAME`.

Never commit `.env` files or Supabase service-role keys.

## Automatic tests

`tests/` holds browser checks (Playwright) that open the site in demo mode — made-up data,
every request to the real Supabase project is blocked — on a phone-sized and a desktop screen:
every student page, roll call, QR check-in, CSV export, announcements, and no sideways scrolling
or JavaScript errors. GitHub runs them on every push; if one fails, nothing is deployed.

```bash
npm run build && npm test
```
