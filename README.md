# CUTROOM

CUTROOM is a documentary editing worktable for turning raw footage into selects, paper edits, and treatments.

## What It Does

- Upload reels and attach them to a project
- Transcribe footage
- Analyze transcripts with Anthropic Claude
- Mark `IN` and `OUT` points
- Save selects to the Selects Bench
- Build a three-act Paper Edit
- Preview Paper Edit clips as a continuous sequence
- Store footage references in an Archive Ledger
- Use Shelby for persistent video storage

## Tech Stack

- Next.js
- React
- TypeScript
- Prisma
- Anthropic SDK
- Shelby SDK
- Redis job status

## Local Setup

Install dependencies:

```powershell
npm install
```

Generate Prisma:

```powershell
npm.cmd run prisma:generate
```

Start the dev server:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

If another port is already in use, Next may start on another port such as `3003`.

## Environment Variables

Create `.env.local` locally. Do not commit it.

```env
DATABASE_URL=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
USE_MOCK_AI=false

SHELBY_NETWORK=shelbynet
SHELBY_API_KEY=
SHELBY_PRIVATE_KEY=

REDIS_URL=
TRANSCRIPTION_API_KEY=
```

## Production Notes

Do not rely on local server uploads in production. Vercel does not provide permanent filesystem storage for uploaded videos.

Use Shelby or another persistent storage provider for production video files.

The app stores video references, not the full video file, in project data.

## Git Safety

Never commit:

- `.env.local`
- API keys
- `node_modules`
- `.next`
- local uploaded videos
- local database files

These are ignored by `.gitignore`.

## Useful Commands

Typecheck:

```powershell
npm.cmd run typecheck
```

Run dev:

```powershell
npm.cmd run dev
```

Regenerate Prisma:

```powershell
npm.cmd run prisma:generate
```
