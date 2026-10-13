# Solar Home System Design — Progressive Web App

## Implementation Plan

A full-stack **Next.js (App Router) + MongoDB** progressive web app that guides an engineer through the
complete, sequential engineering process for designing an off-grid / hybrid residential solar home system.
It tracks the progress of each project through every design stage, from the first load audit to the
final, printable design report.

---

## 1. Goals

| # | Goal |
|---|------|
| G1 | Turn the sequential sizing method (Load → Inverter → Battery → PV → Charge Controller → Cables/Protection) into a guided, step-by-step workflow with live calculations. |
| G2 | Go beyond the theoretical sizing and cover the full executable design: site assessment, structural check, string sizing with temperature correction, single-line diagram, array layout, code compliance, Bill of Quantities and financial modelling. |
| G3 | Track the **progress** of every project (per step and overall) and its lifecycle status (Draft → Commissioned). |
| G4 | Persist all projects, users and an equipment library in **MongoDB**. |
| G5 | Work as a **Progressive Web App**: installable, with an app shell that works offline and a quick calculator that runs fully offline. |
| G6 | Produce professional outputs: SLD (SVG), roof layout (SVG), BoQ (CSV), and a printable design report (Print → PDF). |

## 2. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router, TypeScript, React 19) | SSR + API routes in one codebase |
| Database | MongoDB with Mongoose 9 | Flexible nested documents suit design data |
| Validation | Zod 4 | One schema gives both runtime validation and TypeScript types |
| Auth | Email + password, bcryptjs hashing, JWT (jose) in an httpOnly cookie | No third-party dependency |
| Styling | Tailwind CSS 4 | Fast, consistent UI |
| Diagrams | Hand-generated SVG (SLD, roof layout, cash-flow chart) | No heavy chart/CAD libs; exportable |
| PWA | Web manifest, a service worker (`public/sw.js`), and generated PNG icons | Installable, offline shell |
| Tests | Vitest for the calculation engine | Formulas are verified against worked examples |

## 3. Engineering Workflow (the 15 design steps)

The left-hand stepper in each project follows this order. Every step depends on the ones before it.

| # | Step | Inputs | Key calculations / outputs |
|---|------|--------|----------------------------|
| 1 | **Project & Site** | Client details, location (Nigerian city presets or custom), latitude, Peak Sun Hours (PSH), record T<sub>min</sub>/T<sub>max</sub> | Recommended tilt (≈ latitude, min 10°) and azimuth (facing the equator) |
| 2 | **Load Audit** | Appliance list: W, qty, hours/day, inductive flag, surge factor (default 3× for motors) | Total connected power (W), total daily energy (Wh), peak surge demand = connected + largest motor's extra starting load |
| 3 | **Inverter** | Margin (default 25 %), system voltage (auto / 12 / 24 / 48 V), inverter type (hybrid or standalone), selected inverter specs | Required continuous W = load × 1.25; required surge W; auto voltage (<1.5 kW → 12 V, ≤3 kW → 24 V, else 48 V); recommended standard size; pass/fail checks |
| 4 | **Battery Bank** | Chemistry (lead-acid / gel / AGM / LiFePO4), DoD, days of autonomy, inverter efficiency, unit V/Ah | **Ah = (Wh × autonomy) / (V × DoD × η<sub>inv</sub>)**; series × parallel layout; usable kWh; discharge and charge C-rate checks |
| 5 | **PV Array** | System efficiency (0.75), shading loss %, panel datasheet (Pmax, Voc, Vmp, Isc, Imp, β, dimensions, weight) | Required generation = Wh / η<sub>sys</sub>; **PV W = generation / PSH**; panel count; expected daily yield; array area |
| 6 | **String Sizing** | PV input device limits (max DC V, MPPT window, max input current), T<sub>min</sub>, T<sub>max</sub>, NOCT | **V<sub>max</sub> = Voc × [1 + β/100 × (T<sub>min</sub> − 25)]**; max series = ⌊V<sub>dc,max</sub> / V<sub>max</sub>⌋; hot-cell Vmp → min series; MPPT-window check; strings in parallel; input current check |
| 7 | **Charge Controller** | Skipped automatically for hybrid inverters with a built-in MPPT | **I = PV W / V<sub>batt</sub> × 1.25**; standard controller size; number of controllers needed |
| 8 | **Cables & Protection** | Segment lengths, allowable voltage drop (3 % DC / 3 % AC) | A = 2·L·I·ρ / ΔV; ampacity check (I<sub>z</sub> ≥ I<sub>n</sub>); breaker/fuse ratings; string fuses (when there are ≥3 strings); DC SPD U<sub>cpv</sub> ≥ 1.2 × string V<sub>max</sub>; AC SPD |
| 9 | **Site Assessment** | Shading obstructions (direction, height, distance), roof type/pitch/azimuth/dimensions, roof load capacity, main panel busbar and breaker | Obstruction elevation angle (flagged if >15°); array dead load (kg/m²) vs. capacity; 120 % busbar rule; spare breaker ways |
| 10 | **Array Layout** | Orientation (portrait/landscape), edge setback, inter-module gap | Modules that fit on the roof; 2D layout SVG coloured by string; mounting rails and clamps |
| 11 | **Single-Line Diagram** | — (generated) | SVG SLD showing every breaker rating, cable size, isolator, SPD and earth bonding; downloadable |
| 12 | **Compliance** | Checklist: IEC 62446-1, IEC 60364-7-712, IEC 61215/61730, IEC 62109, IEC 61643, SON/SONCAP, NEMSA, COREN sign-off, earthing ≤ 10 Ω | Auto-checks from the engine combined with manual sign-offs |
| 13 | **Bill of Quantities** | Unit prices (NGN, editable), contingency %, VAT 7.5 %, extra items | Auto-generated material list down to MC4 connectors, UV cable ties and cable lengths; CSV export |
| 14 | **Financial Model** | Current monthly energy spend (grid + generator), displacement %, tariff escalation, discount rate, O&M, degradation, battery life | Simple payback, NPV, IRR, LCOE, 25-year cumulative cash-flow chart |
| 15 | **Design Report** | — | Printable report of every section, ready for "Save as PDF" |

### Progress tracking

- Each step has one of three statuses: `not_started`, `in_progress` (data entered) or `complete` (marked as reviewed by the engineer).
- Overall progress = completed steps / 15. This is shown on the dashboard, the project overview and the stepper.
- Project lifecycle: `draft → designing → review → approved → installed → commissioned`.
- Warnings from the calculation engine (for example "string voltage exceeds inverter limit") appear on the step, the overview and the report.

## 4. Architecture

```
src/
  app/
    page.tsx                     Landing page
    (auth)/login, register       Auth pages
    dashboard/                   Project list + stats
    projects/[id]/layout.tsx     Loads project → <ProjectProvider> + stepper
    projects/[id]/page.tsx       Overview (progress, KPIs, warnings)
    projects/[id]/[step]/page.tsx  Renders the step component
    projects/[id]/report/        Printable report
    equipment/                   Equipment library (CRUD)
    calculator/                  Offline quick-sizing calculator
    offline/                     Service worker fallback page
    api/auth/{register,login,logout,me}
    api/projects, api/projects/[id], api/projects/[id]/duplicate
    api/equipment, api/equipment/[id]
    manifest.ts, pwa-icon/[size]/route.tsx
  lib/
    calc/                        Pure calculation engine (no I/O), unit-tested
      constants.ts  load.ts  inverter.ts  battery.ts  pv.ts  strings.ts
      controller.ts  cables.ts  site.ts  layout.ts  boq.ts  financial.ts
      index.ts  → computeDesign(project) → DesignResults
    schemas.ts                   Zod schemas, types and defaults for each section
    steps.ts                     Step registry + progress logic
    db.ts  auth.ts  session.ts  format.ts  locations.ts  seed-equipment.ts
  models/  User.ts  Project.ts  Equipment.ts
  components/  ui primitives, stepper, step forms, SLD, layout, charts
public/sw.js
```

**Design decisions**

1. **The calculation engine is pure and shared.** `computeDesign()` runs in the browser for instant feedback while typing, and on the server for the dashboard and report. Results are never stored, so they can never go stale; only inputs are persisted.
2. **One project document holds all section inputs.** Each section is validated by its own Zod schema on `PATCH`, so a step only sends its own section.
3. **Autosave:** the project provider debounces changes (800 ms), PATCHes the changed sections, shows a Saving / Saved / Offline indicator, and retries when the browser comes back online.
4. **The stepper state lives in `projects/[id]/layout.tsx`**, so moving between steps keeps the in-memory state.

## 5. Data Model (MongoDB)

```
users       { _id, name, email (unique), passwordHash, company, createdAt }
projects    { _id, owner → users, name, status, client{}, site{}, loads[], inverter{}, battery{},
              pv{}, strings{}, controller{}, cables{}, assessment{}, layout{}, compliance{},
              boq{}, financial{}, progress{ [step]: status }, createdAt, updatedAt }
equipment   { _id, owner (null = built-in), type: panel|inverter|battery|controller, brand, model, specs{} }
```

Indexes: `users.email` (unique), `projects.owner + updatedAt`, `equipment.type + owner`.

## 6. API

| Method | Route | Purpose |
|--------|-------|---------|
| POST | /api/auth/register · /login · /logout | Session cookie |
| GET | /api/auth/me | Current user |
| GET / POST | /api/projects | List / create (owner-scoped) |
| GET / PATCH / DELETE | /api/projects/:id | Read / partial update by section / delete |
| POST | /api/projects/:id/duplicate | Clone a design |
| GET / POST | /api/equipment | Built-in + own equipment / add |
| PATCH / DELETE | /api/equipment/:id | Own equipment only |

## 7. PWA

- `app/manifest.ts`: name, theme colour, `display: standalone`, 192/512 PNG icons generated with `next/og`.
- `public/sw.js`:
  - pre-caches `/offline`, `/calculator` and the icons;
  - cache-first for `/_next/static/*`;
  - network-first with cache fallback for pages;
  - network-only for `/api/*`.
- The worker is registered only in production builds. The quick calculator runs completely client-side, so it works offline.

## 8. Testing & Verification

- Vitest unit tests reproduce the worked examples:
  - string sizing: Voc 41.5 V, β −0.29 %/°C, T<sub>min</sub> 0 °C → V<sub>max</sub> 44.51 V → **13 panels** on a 600 V inverter;
  - the battery Ah formula, PV count, charge controller current and cable sizing.
- `npm run build` must pass type-checking.
- A smoke test runs the API against an in-memory MongoDB (register → create project → patch → read).

## 9. Milestones

1. Scaffold, configuration, DB connection, auth.
2. Calculation engine + tests.
3. Project CRUD, provider with autosave, stepper and progress.
4. Steps 1–8 (sizing).
5. Steps 9–12 (site, layout, SLD, compliance).
6. Steps 13–15 (BoQ, finance, report).
7. Equipment library, quick calculator, PWA.
8. Build, test and document.

## 10. Disclaimer

The location presets (PSH, temperatures) and the cable ampacity table are typical engineering approximations.
Final designs must be verified against site data (for example PVGIS or NASA POWER), manufacturer datasheets
and the applicable standards, and signed off by a COREN-registered engineer.
