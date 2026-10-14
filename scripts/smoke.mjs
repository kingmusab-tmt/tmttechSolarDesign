// End-to-end smoke test against a running server.
// Usage: npm run db:memory  (terminal 1) · npm run build && npm start (terminal 2) · npm run test:e2e
const B = process.env.BASE_URL || "http://localhost:3100";
let cookie = "";
let failures = 0;

// Safety: refuse to write test data unless this is the local test server (see start-test-server.mjs).
{
  const g = await fetch(`${B}/api/test-guard`).then((r) => r.json()).catch(() => ({}));
  if (!g.testServer) {
    console.error("Refusing to run: start the server with `npm run start:test` so tests use a local test database, not your real one.");
    process.exit(2);
  }
}

async function call(method, path, body, headers = {}) {
  const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", cookie, ...headers }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

// Auth & access control
ok((await call("GET", "/api/projects")).status === 401, "unauthenticated API → 401");
ok((await call("GET", "/dashboard")).status === 307, "unauthenticated page → redirect to login");
const email = `smoke${Date.now()}@example.com`;
ok((await call("POST", "/api/auth/register", { name: "Smoke Tester", email, password: "password123" })).status === 201, "register");
ok((await call("POST", "/api/auth/register", { name: "Smoke Tester", email, password: "password123" })).status === 409, "duplicate email → 409");

// Projects
let r = await call("POST", "/api/projects", { name: "Smoke Residence", clientName: "Client", locationPreset: "abuja", withSample: true });
ok(r.status === 201 && r.data.project.loads.length > 0 && r.data.project.site.city === "Abuja", "create project from sample + preset");
const id = r.data.project._id;
r = await call("PATCH", `/api/projects/${id}`, { sections: { battery: { chemistry: "lead_acid", dod: 0.5, daysOfAutonomy: 2, unitVoltage: 12, unitAh: 200 }, progress: { site: true } }, status: "designing" });
ok(r.status === 200, "patch sections");
ok((await call("PATCH", `/api/projects/${id}`, { sections: { battery: { dod: 5 } } })).status === 400, "invalid section value → 400");
ok((await call("PATCH", `/api/projects/${id}`, { sections: { hacker: {} } })).status === 400, "unknown section → 400");
r = await call("GET", `/api/projects/${id}`);
ok(r.data.project.battery.chemistry === "lead_acid" && r.data.project.battery.maxChargeCRate === 0.5, "update persisted, defaults filled");
r = await call("GET", "/api/projects");
ok(r.data.projects[0].arrayKWp > 0 && r.data.projects[0].issues === 0, `summary computed (${r.data.projects[0].arrayKWp.toFixed(2)} kWp, ${r.data.projects[0].issues} issues)`);

// Revisions
r = await call("POST", `/api/projects/${id}/revisions`, { note: "Issued for approval" });
ok(r.status === 201 && r.data.revision.label === "A", "issue Rev A");
const revA = r.data.revision._id;
await call("PATCH", `/api/projects/${id}`, { sections: { battery: { chemistry: "lifepo4", dod: 0.9, unitVoltage: 12.8, unitAh: 200 } } });
ok((await call("POST", `/api/projects/${id}/revisions`, {})).data.revision?.label === "B", "issue Rev B");
ok((await call("POST", `/api/projects/${id}/revisions/${revA}`)).status === 200, "restore Rev A");
ok((await call("GET", `/api/projects/${id}`)).data.project.battery.chemistry === "lead_acid", "restore brought back Rev A inputs");
ok((await call("GET", `/api/projects/${id}/revisions`)).data.revisions.length === 2, "list revisions");

// Equipment
r = await call("GET", "/api/equipment?type=inverter");
ok(r.status === 200 && r.data.items.length >= 5, `equipment library seeded (${r.data.items.length} inverters)`);
const deye5k = r.data.items.find((i) => i.model === "SUN-5K-SG04LP1-EU");
ok(deye5k?.verified === true && deye5k.datasheetUrl.startsWith("https://deye.com/") && deye5k.specs.maxPvVoltage === 500, "verified Deye SUN-5K with official datasheet link");
ok(!r.data.items.some((i) => i.builtIn && !i.verified && i.model === "Hybrid 5 kW / 48 V"), "superseded generic built-ins retired");
// Seed items only: admins may have added more verified items to the shared library.
const verifiedCount = (await Promise.all(["inverter", "battery", "controller"].map((t) => call("GET", `/api/equipment?type=${t}`)))).reduce((a, x) => a + x.data.items.filter((i) => i.verified && i.source === "seed").length, 0);
ok(verifiedCount === 14, `${verifiedCount} verified built-in inverters, batteries and controllers`);
const panels = (await call("GET", "/api/equipment?type=panel")).data.items;
const verifiedPanels = panels.filter((i) => i.verified);
ok(verifiedPanels.length >= 15 && new Set(verifiedPanels.map((i) => i.brand)).size >= 4, `${verifiedPanels.length} verified modules from ${new Set(verifiedPanels.map((i) => i.brand)).size} brands`);
ok(verifiedPanels.find((i) => i.model === "LR5-72HTH-585M")?.specs.weightKg === 27.2, "module weight comes from the datasheet (LONGi 585M: 27.2 kg)");
r = await call("POST", "/api/equipment", { type: "panel", brand: "Acme", model: "X 600", specs: { pmaxW: 600, vocV: 52 } });
ok(r.status === 201, "add own equipment");
ok((await call("DELETE", `/api/equipment/${r.data.item._id}`)).status === 200, "delete own equipment");

// Real datasheets: CEC module database + manufacturer links
r = await call("GET", "/api/equipment/cec?q=jinko%20JKM505N-72HL4-TV");
ok(r.status === 200 && r.data.items[0]?.specs.vocV === 49.51, `CEC search (${r.data.total} match, βVoc ${r.data.items?.[0]?.specs.betaVocPct} %/°C)`);
ok((await call("GET", "/api/equipment/cec?q=a")).status === 400, "CEC search needs a real query");
const cecModule = r.data.items[0];
r = await call("POST", "/api/equipment", { type: "panel", brand: cecModule.manufacturer, model: cecModule.model, specs: cecModule.specs, notes: "CEC module list", datasheetUrl: "https://www.jinkosolar.com/uploads/JKM505N-72HL4-TV.pdf" });
ok(r.status === 201 && r.data.item.datasheetUrl.startsWith("https://"), "save CEC module with datasheet link");
const eqId = r.data.item._id;
ok((await call("PATCH", `/api/equipment/${eqId}`, { type: "panel", model: "X", datasheetUrl: "javascript:alert(1)" })).status === 400, "non-http datasheet links rejected");
ok((await fetch(`${B}/api/equipment/${eqId}/datasheet`, { method: "POST", headers: { cookie } })).status === 404, "file uploads are disabled (no paid storage used)");
ok((await call("DELETE", `/api/equipment/${eqId}`)).status === 200, "delete equipment");

// Account
ok((await call("PATCH", "/api/account", { name: "Smoke Renamed", company: "Acme Solar" })).status === 200, "update profile");
ok((await call("GET", "/api/account")).data.user.company === "Acme Solar", "profile persisted");
ok((await call("PATCH", "/api/account", { currentPassword: "wrong-password", newPassword: "newpassword1" })).status === 403, "password change needs the current password");
ok((await call("PATCH", "/api/account", { currentPassword: "password123", newPassword: "newpassword1" })).status === 200, "change password");

// Climate (external service, so report rather than fail when unreachable)
r = await call("GET", "/api/climate?lat=7.770874&lon=4.542390");
if (r.status === 200) ok(r.data.nasa.monthlyPsh.length === 12, `NASA POWER climate (annual ${r.data.nasa.annualPsh} h, Tmin ${r.data.nasa.tMin} °C, Tmax ${r.data.nasa.tMax} °C)`);
else console.log(`SKIP  NASA POWER unreachable (${r.status})`);
ok((await call("GET", "/api/climate?lat=abc&lon=1")).status === 400, "climate input validated");

// Pages
r = await call("POST", `/api/projects/${id}/duplicate`);
ok(r.status === 201, "duplicate project");
const copyId = r.data.id;
const steps = ["site", "loads", "inverter", "battery", "pv", "strings", "controller", "cables", "assessment", "layout", "sld", "compliance", "boq", "financial", "report"];
for (const p of ["/dashboard", "/account", "/equipment", "/calculator", "/offline", "/manifest.webmanifest", "/sw.js", "/pwa-icon/192", `/projects/${id}`, ...steps.map((s) => `/projects/${id}/${s}`)]) {
  const x = await call("GET", p);
  ok(x.status === 200, `GET ${p}`);
}
ok((await call("GET", "/dashboard")).headers.get("x-frame-options") === "DENY", "security headers present");
ok((await call("GET", `/projects/${id}/bogus`)).status === 404, "unknown step → 404");
ok((await call("GET", "/projects/000000000000000000000000")).status === 404, "another user's / missing project → 404");
ok((await call("DELETE", `/api/projects/${copyId}`)).status === 200, "delete project");

// Session end + brute-force protection
await call("POST", "/api/auth/logout");
ok((await call("GET", "/api/projects")).status === 401, "logout clears session");
let limited = false;
for (let i = 0; i < 10; i++) if ((await call("POST", "/api/auth/login", { email, password: "bad" })).status === 429) limited = true;
ok(limited, "login rate-limited after repeated failures");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
