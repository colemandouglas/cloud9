# Be Like Water

Spine recovery that adapts to you. This repo holds the marketing website, the client app and the clinician review queue, built from the original prototype.

| Route | What it is |
| --- | --- |
| `/` | Marketing website: how it works, programs, safety, FAQ |
| `/app` | Client app: start an intake, see your cases and assigned protocol |
| `/app/intake` | Intake form with emergency red-flag checks, symptoms, imaging upload, goals |
| `/clinician` | Password-protected review queue: red flags first, pattern note, imaging, program assignment |

The app is a PWA: on a phone, open `/app` and choose "Add to Home Screen" to install it.

## Stack

- **Frontend:** React 19, React Router, Vite, TypeScript (`src/`)
- **Backend:** Express 5 on Node 22 with built-in SQLite (`node:sqlite`, no native build) and multer for uploads (`server/`)
- Clinical content (templates, red flags, pattern logic) lives in `src/lib/protocol.ts`.

## Run it

```bash
npm install
npm run dev          # site + app on http://localhost:5173, API on :8787
```

In dev, the clinician password is `dev-clinician` unless you set `CLINICIAN_PASSWORD`.

Production:

```bash
npm run build
CLINICIAN_PASSWORD=... SESSION_SECRET=... npm start   # serves everything on :8787
```

See `.env.example` for all settings. Data (SQLite database and uploaded imaging) goes in `DATA_DIR`, which defaults to `./data`.

## How access works

- **Clients** don't have accounts yet. Submitting an intake returns a secret token that's stored on the device, and the client can only view cases whose tokens they hold.
- **Clinicians** sign in with a shared password and get an HttpOnly, signed session cookie that lasts 12 hours.

## Before real patients use this

This is still a prototype. It handles health information, so before launch you'll need:

- [ ] A clinical partner to review the templates, red-flag wording and pattern logic
- [ ] HIPAA-eligible hosting with a BAA, encryption at rest for the database and uploads, and backups
- [ ] Real accounts: client sign-in (e.g. email magic link) and an individual login for each clinician, with an audit log
- [ ] Client notifications when a program is assigned, and clinician alerts for red-flag intakes
- [ ] Privacy policy, terms, and consent records
