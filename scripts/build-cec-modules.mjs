// Builds src/data/cec-modules.json from the CEC module list published in NREL's System Advisor
// Model (SAM) libraries (BSD 3-Clause). Re-run to refresh: npm run data:cec
import { writeFile, mkdir } from "node:fs/promises";

const SRC = "https://raw.githubusercontent.com/NREL/SAM/develop/deploy/libraries/CEC%20Modules.csv";
const OUT = new URL("../src/data/cec-modules.json", import.meta.url);

/** Minimal RFC 4180 CSV parser (handles quoted fields with commas and escaped quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

const r3 = (v) => Math.round(v * 1000) / 1000;

const res = await fetch(SRC);
if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
const [header, , , ...data] = parseCsv(await res.text()); // rows 2–3 are units and SAM variable names
const col = (name) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Column ${name} missing: the CEC file format changed`);
  return i;
};
const C = Object.fromEntries(["Name", "Manufacturer", "Technology", "Bifacial", "STC", "A_c", "Length", "Width", "I_sc_ref", "V_oc_ref", "I_mp_ref", "V_mp_ref", "beta_oc", "T_NOCT", "gamma_pmp", "BIPV", "Date"].map((n) => [n, col(n)]));

const rows = [];
let skipped = 0;
let estimatedDims = 0;
for (const r of data) {
  const num = (k) => Number(r[C[k]]);
  const pmax = num("STC"), voc = num("V_oc_ref"), vmp = num("V_mp_ref"), isc = num("I_sc_ref"), imp = num("I_mp_ref"), area = num("A_c");
  const betaVk = num("beta_oc"), gamma = num("gamma_pmp"), noct = num("T_NOCT");
  if (!r[C.Name] || ![pmax, voc, vmp, isc, imp, area, betaVk, gamma, noct].every(Number.isFinite) || pmax <= 0 || voc <= 0 || area <= 0) {
    skipped++;
    continue;
  }
  let length = num("Length");
  let width = num("Width");
  let dimsEstimated = 0;
  if (!(length > 0 && width > 0)) {
    // Not published for most entries: derive from the area at the typical 2:1 module aspect ratio.
    width = Math.sqrt(area / 2);
    length = area / width;
    dimsEstimated = 1;
    estimatedDims++;
  }
  const manufacturer = r[C.Manufacturer].trim();
  const model = r[C.Name].startsWith(manufacturer) ? r[C.Name].slice(manufacturer.length).trim() : r[C.Name].trim();
  rows.push([
    manufacturer,
    model,
    r[C.Technology].trim(),
    r[C.Bifacial] === "1" ? 1 : 0,
    pmax,
    r3(voc),
    r3(vmp),
    r3(isc),
    r3(imp),
    r3((betaVk / voc) * 100), // V/K → %/°C
    r3(gamma),
    r3(noct),
    r3(length),
    r3(width),
    dimsEstimated,
  ]);
}

const out = {
  source: "California Energy Commission module list via NREL System Advisor Model (SAM) libraries, BSD 3-Clause",
  sourceUrl: SRC,
  builtAt: new Date().toISOString(),
  fields: ["manufacturer", "model", "technology", "bifacial", "pmaxW", "vocV", "vmpV", "iscA", "impA", "betaVocPct", "gammaPmaxPct", "noctC", "lengthM", "widthM", "dimsEstimated"],
  rows,
};
await mkdir(new URL("../src/data/", import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify(out));
console.log(`Wrote ${rows.length} modules (${skipped} skipped, ${estimatedDims} with dimensions estimated from area)`);
