# MeMyMate by ARCT

Turn your notes into **Knights** and make memory stick — speaking-and-tapping
flashcard duels with a retro-cinematic launch, a live synthesized sound engine,
guest/cloud account modes, and one-tap JSON backups.

## The ARCT upgrade

### 1 · The Great Liberal Ads
- Drop creatives into **`ARCT_Liberal_Ads/`**: `1.png`, `2.png` … for images,
  `1.mp4`, `2.mp4` … for videos.
- **No files → no ads.** The experience stays fully premium and ad-free.
- Files present → elegant, non-disturbing billboards appear on the dashboard,
  guide and shared-link pages.
- **Perfectly synced**: the rotation is derived from a shared global clock, so
  every visitor sees the same creative at the same moment.
- Image ads display for exactly **5 seconds**; video ads for exactly **13 seconds**.
- Creatives are discovered at **build time** (`npm run build`).

### 2 · Cinematic splash screen
A retro, cinematic **“MeMyMate by ARCT”** boot screen: CRT scanlines, vignette,
a glowing transparent ARCT logo, a boot progress bar, and synthesized retro
chime chords (C — F — G — C). Any key or tap skips it.

### 3 · Live Web Audio sound engine (`src/lib/sounds.ts`)
Zero audio files — every effect is synthesized live with the Web Audio API:
card **flips**, **clicks**, **correct** answers, **errors**, countdown **ticks**,
a triumphant **fanfare**, and **level-up** arpeggios. The Settings page has a
sound toggle plus a master volume control (persisted in localStorage).

### 4 · Firebase authentication & cloud gating
- Email/password **sign-up & sign-in modal** with **guest mode** support.
- **Guests** keep every deck on-device in `localStorage` — zero Firestore I/O.
- Only **signed-in** users sync decks to Firestore.
- Tapping **Share** as a guest opens the sign-up dialog.
- Shared flashcard links are **public, read-only** study pages (`/share/:id`).
- `firestore.rules` enforces non-anonymous writes.

### 5 · 30-day account policy & backup
- Dashboard banner reminds you of the 30-day lifecycle with a **1-tap JSON
  backup** button that downloads every deck.
- Settings shows the account creation date, a days-active counter, the
  lifecycle position (day X of 30), and JSON export.

## Develop

```bash
npm install
npm run dev        # vite dev server
npm run typecheck  # tsc --noEmit
npm run build      # production build → dist/public
npm run serve      # preview the build
```

### Firebase (optional)
Create a `.env` file (see `.env.example`) with your Firebase web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Without Firebase config the app runs fully in guest mode. Enable
**Email/Password** sign-in in Firebase Authentication and deploy
`firestore.rules` (`firebase deploy --only firestore:rules`).

## Deploy

The Vite build outputs to **`dist/public`** (not `dist`). All hosting configs
are wired for that:

| Host | Config | Notes |
| --- | --- | --- |
| Vercel | `vercel.json` | `buildCommand: npm run build`, `outputDirectory: dist/public`, SPA rewrites |
| Netlify | `netlify.toml` | `npm run build`, publishes `dist/public`, SPA redirect |
| Firebase Hosting | `firebase.json` | serves `dist/public` with SPA rewrites — run `npm run build` first |

If you ever override the output directory in the host dashboard, make sure it
points at `dist/public` (or change `build.outDir` in `vite.config.ts` to match).

