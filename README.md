# TmtechSolar Pro: Solar Home System Design PWA

An idea by [Triple Multipurpose Technology](https://triplemultipurposetechnology.com.ng) · CEO: Engr. Musab Mubaraq Mburaimoh

Contact: musab.buraimoh@gmail.com · support@triplemultipurposetechnology.com.ng · +234 816 255 2901 · +234 904 937 6773

A Next.js + MongoDB progressive web app that guides you through the full engineering design of a residential solar home system and tracks each project's progress. See [PLAN.md](PLAN.md) for the detailed plan and architecture.

## Features

- **15-step workflow with progress tracking:** Project & Site → Load Audit → Inverter → Battery → PV Array → String Sizing → Charge Controller → Cables & Protection → Site Assessment → Array Layout → Single-Line Diagram → Compliance → BoQ → Financials → Report.
- **Live calculations** in the browser as you type, with automatic pass/warn/fail checks on every step.
- **Temperature-corrected string sizing:** `Vmax = Voc × [1 + β/100 × (Tmin − 25)]`, plus the hot-Vmp MPPT window.
- **Generated outputs:** a single-line diagram and roof layout (SVG download), a BoQ (CSV export) and a printable design report (save as PDF).
- **Climate data from two sources:** NASA POWER is fetched automatically (monthly sun hours and record temperatures). Global Solar Atlas values are entered by the engineer: the app links to the site's coordinates, and you paste the 12 monthly GHI values (and optionally PV output). Its terms of use forbid automated access, so the app never contacts it. When both are present, each month is their average and months that differ by > 15 % are flagged. Solargis' PV output cross-checks the design yield. The design basis (worst month off-grid, annual average with backup) is applied automatically and can be switched.
- **Smart auto-sizing:** until a model is chosen, a generic hybrid inverter matched to the load *and* the PV array is assumed, so string and charge checks are always consistent.
- **Design revisions:** issue immutable Rev A/B/… snapshots, restore any of them, and see the current revision on the report.
- **Real equipment datasheets:** search 21,677 certified PV modules (California Energy Commission list via NREL SAM, BSD 3-Clause) from the Equipment library or the PV Array step and apply one in a click. Weight is estimated and some dimensions are derived from area, which is flagged in the UI. Every item you add can carry a link to the manufacturer's datasheet for traceability (files are not uploaded or stored, so no database storage is used).
- **Equipment library:** 39 real products verified against manufacturer datasheets, each linked to its source PDF: 25 PV modules (Jinko Tiger Neo, LONGi Hi-MO 6 / X6, JA Solar JAM54S30, Canadian Solar HiKu6) and 14 inverters, batteries and charge controllers (Deye, Growatt, Victron, Pylontech); generic placeholders (labelled) for gaps such as 12 V systems and lead-acid batteries; plus your own products. Choosing an inverter/charger without MPPT (e.g. MultiPlus-II) switches the design to standalone + charge controller automatically.
- **Accounts:** profile and company name (shown on reports), password change, rate-limited login.
- **Organisations and team design:** create an organisation, invite colleagues by email (they accept after signing in or registering), and share projects and equipment with it. Roles: owner, admin, member.
- **Creator approval:** in a shared project each section belongs to whoever first entered information in it. Teammates can still edit it, but their changes become a proposal with a required comment, and are applied only when the creator (or project owner) approves. Reviewers see a field-by-field diff and must comment to reject. The same applies to shared equipment ("Suggest change"). Everything is enforced by the server.
- **No simultaneous editing:** opening a step for editing locks it for you; teammates see "🔒 Name is editing this step" and a read-only form until you finish or go idle (locks expire automatically). Every save carries the section's revision, so a stale save is refused instead of overwriting newer work, and open projects pick up teammates' approved changes every few seconds, with presence showing who is on which step.
- **Admin console (`/admin`):** administrators add, edit, verify, retire and restore items in the shared equipment library (with datasheet links), promote users and view usage. Admin edits survive future seed updates.
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

## Administrators

Set `ADMIN_EMAILS` in `.env.local` to a comma-separated list of emails. Those users become administrators when they register or sign in, and can then promote others from **Admin → Users**. At least one administrator must always remain.

The admin console has four tabs:

- **Overview**: visitors today / 7 days / 30 days (unique devices, signed-in users, page views), registered users and sign-ups, and a 30-day chart. Each device gets a random id in a cookie; one small record per device per day is kept for about 13 months and then deleted automatically. No IP addresses or page addresses are stored.
- **Equipment library**: add, edit, verify, retire and restore the built-in items every user sees.
- **User equipment**: items users added to their personal libraries. Review an item, correct its values, then add it to the global library, or update the matching library item if the same brand and model already exists. You can also dismiss an item. The user's own copy is never changed, and a dismissed item returns to the queue if its owner edits it.
- **Users**: roles, project counts and when each user was last active.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server (the service worker is active only in production) |
| `npm test` | Unit tests: calculation engine, climate parsing, revisions (Vitest) |
| `npm run start:test` | Start the built app on port 3100 against a **local** test database (ignores `MONGODB_URI` in `.env.local`) |
| `npm run test:e2e` | End-to-end API/page smoke test (needs `npm run db:memory` + `npm run start:test`) |
| `npm run test:collab` | Multi-user test of admin, organisations, approvals, locks and conflicts (same setup as `test:e2e`) |
| `npm run data:cec` | Refresh the bundled CEC module database from NREL SAM |
| `npm run db:memory` | Throwaway in-memory MongoDB on port 27017 |
| `npm run typecheck` | TypeScript check |

## Testing safely

The end-to-end scripts create test accounts, projects and organisations. They refuse to run unless the server was started with `npm run start:test`, which always uses a local test database, so they can never write into your real (e.g. Atlas) database:

```bash
npm run db:memory      # terminal 1: throwaway local MongoDB
npm run build && npm run start:test   # terminal 2
npm run test:e2e && npm run test:collab
```

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

## Credits and attributions

- **NASA POWER**: these data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.
- **Global Solar Atlas 2.0**: a free, web-based application developed and operated by Solargis s.r.o. on behalf of the World Bank Group, utilizing Solargis data, with funding provided by the Energy Sector Management Assistance Program (ESMAP). Data licensed under CC BY 4.0. Values are entered by the engineer; the app does not access the site automatically.
- **PV module database**: California Energy Commission module list as distributed in the NREL System Advisor Model libraries, Copyright © Alliance for Sustainable Energy, LLC, BSD 3-Clause License.
- **Manufacturer datasheets**: product names and trademarks belong to their respective owners.
- **Software**: Next.js, React, Tailwind CSS, Mongoose and Zod (MIT), the MongoDB Node.js driver (Apache-2.0), jose (MIT) and bcrypt.js (BSD-3-Clause).

The in-app **Credits** page (`/credits`, linked from the footer) carries the full attributions and the BSD 3-Clause licence text.
