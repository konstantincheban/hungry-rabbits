# Hungry Rabbits

Hungry Rabbits is a mobile-first PixiJS mini-game demo built with TypeScript and Firebase.

## What Is Included

- Side-view turret shooter loop:
  - drag to aim
  - release to shoot carrot projectile with gravity
  - hit normal/golden rabbits
  - combo scoring
  - ammo-limited round with game-over condition
- Polished demo UX:
  - SFX (shot, hit, golden hit, miss, combo, UI click, game-over, network states)
  - scene fade transitions
  - improved particles and hit/combo visual feedback
  - responsive small-screen layout tuning
- Firebase leaderboard:
  - submit score from game-over screen
  - fetch top 10 leaderboard entries
  - basic username/score validation
  - graceful fallback messaging for network/config errors
- QR page:
  - large generated QR code for game URL

## Stack

- TypeScript
- PixiJS v8
- Firebase Hosting
- Cloud Firestore
- No custom backend server

## Quick Start

1. Install dependencies:

```bash
npm install
```

1. Copy environment template and fill Firebase values:

```bash
cp .env.example .env
```

1. Run locally:

```bash
npm run dev
```

1. Build production bundle:

```bash
npm run build
```

## Environment Variables

See `.env.example`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GAME_URL=
```

Notes:

- Leaderboard works only when Firebase variables are configured.
- `VITE_GAME_URL` is optional. If omitted, QR page uses current site origin.

## Firebase Setup

1. Create Firebase project.
2. Add Web App and copy SDK config values into `.env`.
3. Enable Firestore Database.
4. Deploy Firestore rules from this repo:

```bash
npx firebase-tools deploy --only firestore:rules
```

Collection used:

- `leaderboard`

Document shape:

- `username: string`
- `score: number`
- `createdAt: string` (ISO timestamp)

## Public Demo Deployment

Repository includes:

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `.firebaserc.example`

Setup once:

```bash
npx firebase-tools login
cp .firebaserc.example .firebaserc
# edit .firebaserc with your project id
```

Deploy hosting + firestore:

```bash
npm run deploy
```

Deploy hosting only:

```bash
npm run deploy:hosting
```

## CI/CD (GitHub Actions)

This repository now includes:

- `.github/workflows/ci.yml`
  - runs on every `push` and `pull_request`
  - executes `npm ci`, `npm run typecheck`, `npm run build`
- `.github/workflows/deploy.yml`
  - runs on `push` to `main` and on manual trigger (`workflow_dispatch`)
  - builds app and deploys to Firebase Hosting + Firestore config

### Required GitHub Secrets

Add these repository secrets in `Settings -> Secrets and variables -> Actions`:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_GAME_URL` (optional)

Create service account key JSON once (Firebase Console -> Project settings -> Service accounts -> Generate new private key), then store the full JSON content in `FIREBASE_SERVICE_ACCOUNT_KEY`.

Grant this service account permissions needed for deploy (for example Firebase Hosting Admin + Cloud Datastore/Firebase Rules related permissions used by your deploy scope).

## Controls

- Drag from turret area to adjust angle/power.
- Release pointer to fire.
- Preserve combo by avoiding misses.

## Error/Fallback Behavior

- Missing Firebase config: submission/read disabled with clear on-screen hints.
- Network failures: friendly messages shown; leaderboard screen uses cached data when available.
- Audio unavailable or blocked: gameplay continues normally.

## Project Layout

```text
src/
  app/
  core/
  assets/
  scenes/
  entities/
  systems/
  ui/
  services/
  state/
  types/
```
