# TmtechSolar Pro: remaining gaps

Found in a code review after the 10-item engineering upgrade (cable derating, structure & wind, commissioning, distribution board, year-round simulation, fault level & lightning, grid connection, cable schedule, handover pack, readiness checks). Ordered by priority. Not started.

## Engineering: safety and correctness

- [ ] **Per-string battery protection.** When batteries are paralleled, give each string its own fuse/breaker and a common busbar; size the busbar and add both to the SLD and BoQ.
- [ ] **Cumulative voltage drop.** Check inverter output + final circuit together against IEC 60364-5-52 limits from the origin (≈ 3 % lighting, 5 % other), not each segment separately.
- [ ] **Battery ↔ inverter compatibility.** Record the BMS communication protocol (CAN/RS485 brand list) for library batteries and inverters and warn when a lithium battery and inverter can't talk to each other.
- [ ] **Generator sizing.** Size the generator (kVA) from battery charging current plus pass-through load; use the year-round simulation for expected runtime hours and fuel.
- [ ] **Temperature effects.** Monthly PV temperature losses from module γPmax and site temperatures instead of one fixed 75 % efficiency; battery temperature derating and a check on the battery room / enclosure temperature.
- [ ] **Load timing.** Let engineers set when each appliance runs (e.g. pump 10:00–14:00) so the simulation and battery sizing use the real day/night split.
- [ ] **Earth electrode design.** Calculate the number and length of rods from measured soil resistivity to reach the target resistance.

## Engineering: larger systems (separate project)

- [ ] **Three-phase systems.** Three-phase inverters, or single-phase inverters on three phases; phase balancing of loads; three-phase cables, protection and SLD.
- [ ] **Paralleled inverters.** Specify several inverters in parallel when one unit is too small, with shared battery bank and AC combining.

## Platform: before going public

- [ ] **Password reset and email verification.** Needs a transactional email service (Resend or Brevo free tier). Also email notifications for invites and approvals.
- [ ] **Privacy policy and terms of use.** Nigeria Data Protection Act 2023 notice (personal data, visitor cookie), terms limiting liability for designs. Draft for legal review.
- [ ] **Backups, export and monitoring.** Export/import a project as a file, an Atlas backup plan, and production error logging.

## Business

- [ ] **Client proposal / quotation.** Short client-facing document: system summary, price, payment terms, validity, warranties, export to PDF.
- [ ] **Financing in the financial model.** Loan / instalment / pay-as-you-go options with interest, tenor and deposit.
- [ ] **Drawing exports.** PDF drawing set with a title block; DXF for engineers working in AutoCAD.
- [ ] **Site photos.** Only on free-tier storage (e.g. Cloudinary free plan), to keep the no-paid-storage rule.

## Suggested order

1. Per-string battery protection, cumulative voltage drop, compatibility check, generator sizing.
2. Password reset, privacy/terms, project export (before public launch).
3. Client proposal and financing.
4. Three-phase and paralleled inverters as their own project.
