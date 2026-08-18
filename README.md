# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Diario Nemis.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `App tracciamento nutrizionale gamificata` project files (HTML prototypes, assets, components)

## Implementation

The `Diario Nemis.dc.html` design has been implemented as a real app:

- `server/` — Express + TypeScript API (`node:sqlite` persistence). Owns the food-matching engine
  (`src/match.ts`, ported from the prototype's `CONSIGLIATI`/`SCONSIGLIATI`/`score()`), meal logging,
  fasting timer, report frequency, and the nutritionist patient list/detail endpoints.
- `app/` — React + TypeScript (Vite) frontend, styled with the **official Nemis Nutrition brand
  tokens** (`app/src/theme.css`, from the `nemis-design` skill — teal/gold/Poppins) rather than the
  prototype's reverse-engineered green/tan placeholder palette. Layout, spacing, radii and
  interactions match the `.dc.html` spec.

Real integrations (per product decision): audio transcription uses the browser's Web Speech API,
PDF export uses jsPDF (client-side, no external service), and "Invia su WhatsApp" opens a `wa.me`
deep link with the report pre-filled. Photo food-recognition remains mocked (no vision API key
configured) — swap in a real vision model in `app/src/components/sheet/LogSheet.tsx` when one is
available.

Streak, the weekly chart and the badges (Premi tab) are computed server-side from the real meal
history in `server/src/stats.ts` — not hardcoded demo numbers.

**Run it:**
```
npm run install:all   # installs server/ and app/ dependencies
npm run dev           # runs both together — API on :4001, UI on :5173
npm test               # runs the server's unit tests (matching engine + stats)
```
Or run each side separately: `cd server && npm run dev` / `cd app && npm run dev`.
