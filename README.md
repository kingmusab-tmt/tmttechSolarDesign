# SolarDesign Pro: Solar Home System Design PWA

A Next.js + MongoDB progressive web app that guides you through the full engineering design of a residential solar home system and tracks each project's progress. See [PLAN.md](PLAN.md) for the detailed plan and architecture.

## Features

- **15-step workflow with progress tracking:** Project & Site → Load Audit → Inverter → Battery → PV Array → String Sizing → Charge Controller → Cables & Protection → Site Assessment → Array Layout → Single-Line Diagram → Compliance → BoQ → Financials → Report.
- **Live calculations** in the browser as you type, with automatic pass/warn/fail checks on every step.
- **Temperature-corrected string sizing:** `Vmax = Voc × [1 + β/100 × (Tmin − 25)]`, plus the hot-Vmp MPPT window.
- **Generated outputs:** a single-line diagram and roof layout (SVG download), a BoQ (CSV export) and a printable design report (save as PDF).
- **Climate data from two sources:** NASA POWER is fetched automatically (monthly sun hours and record temperatures). Global Solar Atlas values are entered by the engineer: the app links to the site's coordinates, and you paste the 12 monthly GHI values (and optionally PV output). Its terms of use forbid automated access, so the app never contacts it. When both are present, each month is their average and months that differ by > 15 % are flagged. Solargis' PV output cross-checks the design yield. The design basis (worst month off-grid, annual average with backup) is applied automatically and can be switched.
- **Smart auto-sizing:** until a model is chosen, a generic hybrid inverter matched to the load *and* the PV array is assumed, so string and charge checks are always consistent.
- **Design revisions:** issue immutable Rev A/B/… snapshots, restore any of them, and see the current revision on the report.
- **Real equipment datasheets:** search 21,677 certified PV modules (California Energy Commission list via NREL SAM, BSD 3-Clause) from the Equipment library or the PV Array step and apply one in a click. Weight is estimated and some dimensions are derived from area, which is flagged in the UI. Every inverter, battery and controller you add can carry the manufacturer's datasheet link and an uploaded PDF (≤ 5 MB) for traceability.
- **Equipment library:** 39 real products verified against manufacturer datasheets, each linked to its source PDF: 25 PV modules (Jinko Tiger Neo, LONGi Hi-MO 6 / X6, JA Solar JAM54S30, Canadian Solar HiKu6) and 14 inverters, batteries and charge controllers (Deye, Growatt, Victron, Pylontech); generic placeholders (labelled) for gaps such as 12 V systems and lead-acid batteries; plus your own products. Choosing an inverter/charger without MPPT (e.g. MultiPlus-II) switches the design to standalone + charge controller automatically.
- **Accounts:** profile and company name (shown on reports), password change, rate-limited login.
- **PWA:** installable; the app shell and quick calculator work offline. Edits made offline are kept on the device (even if the tab is closed) and sync when you reconnect.

## Getting started

```bash
npm install
cp .env.example .env.local   # set MONGODB_URI and JWT_SECRET
npm run dev                  # http://localhost:3000
```

If you don't have MongoDB installed, run a throwaway in-memory database in a second terminal:

```bash
npm run db:memory            # mongodb://127.0.0.1:27017 (data is lost when it stops)
```

Alternatively, use Docker (`docker run -d -p 27017:27017 mongo:7`) or a MongoDB Atlas connection string.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (the service worker is active only in production) |
| `npm test` | Unit tests: calculation engine, climate parsing, revisions (Vitest) |
| `npm run test:e2e` | End-to-end API/page smoke test against a running server (`BASE_URL`, default `http://localhost:3000`) |
| `npm run data:cec` | Refresh the bundled CEC module database from NREL SAM |
| `npm run db:memory` | Throwaway in-memory MongoDB on port 27017 |
| `npm run typecheck` | TypeScript check |

## Project structure

```
src/lib/calc/        Pure calculation engine (sizing, strings, cables, site, BoQ, financials) + tests
src/lib/schemas.ts   Zod schemas: validation, types and defaults for every design section
src/lib/steps.ts     Step registry and progress logic
src/app/api/         REST API (auth, projects, equipment)
src/components/      Step forms, diagrams, charts, UI primitives
public/sw.js         Service worker
```

> Location climate presets, the cable ampacity table and the BoQ prices are indicative. Verify them against site data, datasheets, supplier quotes and the applicable standards. Final designs require sign-off by a COREN-registered engineer.
