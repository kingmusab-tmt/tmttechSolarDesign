// Multi-user end-to-end test for admin, organisations, approvals, locks and concurrency.
// Start the server with ADMIN_EMAILS including admin@e2e.test, then: npm run test:collab
const B = process.env.BASE_URL || "http://localhost:3100";
const RUN = Date.now();
let failures = 0;

// Safety: refuse to write test data unless this is the local test server (see start-test-server.mjs).
{
  const g = await fetch(`${B}/api/test-guard`).then((r) => r.json()).catch(() => ({}));
  if (!g.testServer) {
    console.error("Refusing to run: start the server with `npm run start:test` so tests use a local test database, not your real one.");
    process.exit(2);
  }
}

function client(label) {
  const jar = new Map(); // cookie name -> "name=value" (session and visitor id)
  const req = async (method, path, body) => {
    const cookie = [...jar.values()].join("; ");
    const res = await fetch(B + path, { method, headers: { "Content-Type": "application/json", cookie }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const sc of res.headers.getSetCookie()) {
      const pair = sc.split(";")[0];
      jar.set(pair.split("=")[0], pair);
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
  return { label, req };
}
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};
async function signUp(c, name, email) {
  let r = await c.req("POST", "/api/auth/register", { name, email, password: "password123" });
  if (r.status === 409) r = await c.req("POST", "/api/auth/login", { email, password: "password123" });
  return r;
}

const admin = client("admin");
const ada = client("ada");
const bob = client("bob");
const carol = client("carol");
const bobEmail = `bob${RUN}@e2e.test`;

/* ---------------- Admin ---------------- */
await signUp(admin, "Admin User", "admin@e2e.test");
await signUp(ada, "Ada Lovelace", `ada${RUN}@e2e.test`);
ok((await admin.req("GET", "/api/admin/stats")).status === 200, "admin (ADMIN_EMAILS) can open the admin API");
ok((await ada.req("GET", "/api/admin/stats")).status === 403, "regular user is refused by the admin API");

let r = await admin.req("POST", "/api/admin/equipment", { type: "battery", brand: "E2E", model: `Test LFP ${RUN}`, specs: { chemistry: "lifepo4", unitVoltage: 51.2, unitAh: 280, dod: 0.9 }, verified: true, datasheetUrl: "https://example.com/ds.pdf" });
ok(r.status === 201, "admin adds a verified item to the shared library");
const libId = r.data.item?._id;
let lib = (await ada.req("GET", "/api/equipment?type=battery")).data.items;
ok(lib.some((i) => i._id === libId && i.verified && i.builtIn), "every user sees the new library item immediately");
ok((await ada.req("PATCH", `/api/equipment/${libId}`, { type: "battery", model: "hack" })).status === 403, "users cannot edit built-in items");
ok((await admin.req("DELETE", `/api/admin/equipment/${libId}`)).status === 200, "admin retires the item");
lib = (await ada.req("GET", "/api/equipment?type=battery")).data.items;
ok(!lib.some((i) => i._id === libId), "retired items disappear for users");
ok((await admin.req("PATCH", `/api/admin/equipment/${libId}`, { retired: false })).status === 200, "admin restores it");
const restored = (await ada.req("GET", "/api/equipment?type=battery")).data.items.find((i) => i._id === libId);
ok(restored?.brand === "E2E" && restored.specs.unitAh === 280 && restored.datasheetUrl === "https://example.com/ds.pdf", "restoring keeps the item's brand, specs and datasheet link");
const users = (await admin.req("GET", "/api/admin/users")).data.users;
const adaId = users.find((u) => u.email === `ada${RUN}@e2e.test`)._id;
ok((await admin.req("PATCH", `/api/admin/users/${adaId}`, { role: "admin" })).status === 200 && (await ada.req("GET", "/api/admin/stats")).status === 200, "admin promotes a user, who gains admin access");
await admin.req("PATCH", `/api/admin/users/${adaId}`, { role: "user" });

/* ---------------- Organisation ---------------- */
r = await ada.req("POST", "/api/orgs", { name: `Sunrise ${RUN}` });
ok(r.status === 201, "Ada creates an organisation");
const orgId = r.data.org._id;
ok((await ada.req("POST", `/api/orgs/${orgId}/invites`, { email: bobEmail })).status === 201, "Ada invites Bob by email before he has an account");
await signUp(bob, "Bob Builder", bobEmail);
await signUp(carol, "Carol Outsider", `carol${RUN}@e2e.test`);
const inv = (await bob.req("GET", "/api/orgs")).data.myInvites;
ok(inv.length === 1, "Bob sees the invitation after registering");
ok((await bob.req("POST", `/api/invites/${inv[0]._id}`, { action: "accept" })).status === 200, "Bob accepts and joins");

/* ---------------- Shared project ---------------- */
r = await ada.req("POST", "/api/projects", { name: "Shared Clinic", withSample: true });
const pid = r.data.project._id;
ok((await bob.req("GET", `/api/projects/${pid}`)).status === 404, "unshared project is private to its owner");
ok((await ada.req("POST", `/api/projects/${pid}/share`, { orgId })).status === 200, "Ada shares the project with the organisation");
let bp = await bob.req("GET", `/api/projects/${pid}`);
ok(bp.status === 200 && bp.data.collab.sectionOwners.loads?.id && bp.data.collab.shared, "Bob can open it; Ada owns the loads she entered");
ok((await carol.req("GET", `/api/projects/${pid}`)).status === 404, "non-members cannot open it");
ok((await bob.req("PATCH", `/api/projects/${pid}`, { name: "Renamed by Bob" })).status === 403, "members cannot rename (owner/org admin only)");

const loads = bp.data.project.loads;
let res = await bob.req("PATCH", `/api/projects/${pid}`, { sections: { loads: [...loads, { id: "x1", name: "Freezer", category: "Refrigeration", watts: 200, qty: 1, hoursPerDay: 10, inductive: true, surgeFactor: 3 }] } });
ok(res.status === 403 && res.data.code === "approval_required", "Bob's direct edit to Ada's loads is refused: approval required");

const battery = { ...bp.data.project.battery, daysOfAutonomy: 2 };
res = await bob.req("PATCH", `/api/projects/${pid}`, { sections: { battery }, baseRevs: { battery: 0 } });
ok(res.status === 200 && res.data.sectionOwners.battery, "Bob adds information to an untouched section directly and becomes its creator");
res = await ada.req("PATCH", `/api/projects/${pid}`, { sections: { battery: { ...battery, daysOfAutonomy: 3 } } });
ok(res.status === 403 && res.data.code === "approval_required", "even the project owner needs Bob's approval to change Bob's section");

/* ---------------- Change requests ---------------- */
const proposed = [...loads, { id: "x1", name: "Freezer", category: "Refrigeration", watts: 200, qty: 1, hoursPerDay: 10, inductive: true, surgeFactor: 3 }];
ok((await bob.req("POST", `/api/projects/${pid}/changes`, { section: "loads", value: proposed, comment: "", baseRev: 0 })).status === 400, "a proposal without a comment is refused");
res = await bob.req("POST", `/api/projects/${pid}/changes`, { section: "loads", value: proposed, comment: "Client confirmed a chest freezer for the clinic", baseRev: bp.data.collab.sectionRev.loads ?? 0 });
ok(res.status === 201 && res.data.change.diff.some((d) => d.kind === "added"), "Bob proposes the change with a comment; the diff shows the added freezer");
const cid = res.data.change._id;
ok((await bob.req("POST", `/api/changes/${cid}`, { action: "approve" })).status === 403, "the proposer cannot approve their own change");
// The proposer is typically still on the step (holding its lock) when the creator reviews.
await bob.req("POST", `/api/projects/${pid}/locks`, { action: "acquire", sections: ["inverter", "loads"], step: "loads" });
ok((await carol.req("POST", `/api/changes/${cid}`, { action: "approve" })).status === 403, "outsiders cannot approve");
const inbox = (await ada.req("GET", "/api/changes?scope=inbox")).data.changes;
ok(inbox.some((c) => c._id === cid && c.canReview), "the change appears in Ada's approval inbox");
ok((await ada.req("POST", `/api/changes/${cid}`, { action: "reject", comment: "" })).status === 400, "rejecting requires a reviewer comment");
res = await ada.req("POST", `/api/changes/${cid}`, { action: "approve", comment: "Good catch" });
ok(res.status === 200 && res.data.change.status === "approved", "Ada approves, even while Bob (who can only propose) still has the step open");
await bob.req("POST", `/api/projects/${pid}/locks`, { action: "release", sections: [] });
bp = await bob.req("GET", `/api/projects/${pid}`);
ok(bp.data.project.loads.some((l) => l.name === "Freezer") && bp.data.collab.sectionOwners.loads.id !== bp.data.collab.me.id, "the approved change is applied; Ada still owns the section");

res = await ada.req("POST", `/api/projects/${pid}/changes`, { section: "battery", value: { ...battery, daysOfAutonomy: 3 }, comment: "3 days for the vaccine fridge", baseRev: bp.data.collab.sectionRev.battery });
const cid2 = res.data.change._id;
res = await bob.req("POST", `/api/changes/${cid2}`, { action: "reject", comment: "Battery budget is fixed at 2 days" });
ok(res.status === 200 && res.data.change.status === "rejected", "Bob rejects Ada's proposal with a comment");

/* ---------------- Locks and concurrency ---------------- */
res = await ada.req("POST", `/api/projects/${pid}/locks`, { action: "acquire", sections: ["inverter", "loads"], step: "loads" });
ok(res.status === 200, "Ada locks the Load Audit step while editing");
res = await bob.req("POST", `/api/projects/${pid}/locks`, { action: "acquire", sections: ["inverter", "loads"], step: "loads" });
ok(res.status === 423 && res.data.lockedBy === "Ada Lovelace", "Bob cannot take the same step: it reports Ada is editing");
const sync = (await bob.req("GET", `/api/projects/${pid}/sync?step=loads`)).data;
ok(sync.locks.some((l) => l.userName === "Ada Lovelace" && l.step === "loads"), "Bob's live sync shows Ada's lock");
ok((await bob.req("GET", `/api/projects/${pid}/sync?step=battery`)).status === 200 && (await ada.req("GET", `/api/projects/${pid}/sync`)).data.presence.some((p) => p.userName === "Bob Builder"), "presence shows who is online");
await ada.req("POST", `/api/projects/${pid}/locks`, { action: "release", sections: [] });
ok((await bob.req("POST", `/api/projects/${pid}/locks`, { action: "acquire", sections: ["inverter", "loads"], step: "loads" })).status === 200, "after Ada leaves, Bob can take the step");
res = await ada.req("PATCH", `/api/projects/${pid}`, { sections: { progress: { loads: true } } });
ok(res.status === 200, "progress ticks are not blocked by edit locks on other sections");
await bob.req("POST", `/api/projects/${pid}/locks`, { action: "release", sections: [] });

bp = await bob.req("GET", `/api/projects/${pid}`);
const rev = bp.data.collab.sectionRev.battery;
ok((await bob.req("PATCH", `/api/projects/${pid}`, { sections: { battery: { ...battery, unitAh: 280 } }, baseRevs: { battery: rev } })).status === 200, "Bob saves with the current revision");
res = await bob.req("PATCH", `/api/projects/${pid}`, { sections: { battery: { ...battery, unitAh: 300 } }, baseRevs: { battery: rev } });
ok(res.status === 409 && res.data.code === "conflict" && res.data.current.battery.unitAh === 280, "a stale save (old revision) is refused with the current values instead of overwriting");

/* ---------------- Shared equipment ---------------- */
r = await ada.req("POST", "/api/equipment", { type: "panel", brand: "Ada Co", model: `AC-${RUN}`, specs: { pmaxW: 450 } });
const eid = r.data.item._id;
ok((await bob.req("GET", "/api/equipment?type=panel")).data.items.every((i) => i._id !== eid), "personal equipment is private");
ok((await ada.req("POST", `/api/equipment/${eid}/share`, { orgId })).status === 200, "Ada shares her module with the organisation");
const shared = (await bob.req("GET", "/api/equipment?type=panel")).data.items.find((i) => i._id === eid);
ok(shared && !shared.mine && shared.ownerName === "Ada Lovelace", "Bob sees it, credited to Ada");
ok((await bob.req("PATCH", `/api/equipment/${eid}`, { type: "panel", model: `AC-${RUN}`, specs: { pmaxW: 455 } })).status === 403, "Bob cannot edit Ada's shared item directly");
res = await bob.req("POST", `/api/equipment/${eid}/changes`, { value: { type: "panel", brand: "Ada Co", model: `AC-${RUN}`, specs: { pmaxW: 455 } }, comment: "Datasheet rev B lists 455 W" });
ok(res.status === 201, "Bob suggests a correction with a comment");
res = await ada.req("POST", `/api/changes/${res.data.change._id}`, { action: "approve" });
ok(res.status === 200 && (await bob.req("GET", "/api/equipment?type=panel")).data.items.find((i) => i._id === eid).specs.pmaxW === 455, "Ada approves; the shared item is updated for everyone");

/* ---------------- Visitors ---------------- */
ok((await carol.req("POST", "/api/visit")).status === 204 && (await ada.req("POST", "/api/visit")).status === 204, "page views are recorded for visitors and signed-in users");
ok((await ada.req("GET", "/api/admin/analytics")).status === 403, "regular users cannot see visitor figures");
res = await admin.req("GET", "/api/admin/analytics?days=30");
const today = res.data.series?.at(-1);
ok(res.status === 200 && res.data.today.visitors >= 2 && res.data.today.users >= 1 && today?.visitors >= 2 && res.data.series.length === 30, "admin sees today's visitors, signed-in users and a 30-day series");
ok((await admin.req("GET", "/api/admin/users")).data.users.find((u) => u.email === `ada${RUN}@e2e.test`)?.lastSeen, "admin sees when each user was last active");

/* ---------------- User equipment → global library ---------------- */
ok((await ada.req("GET", "/api/admin/submissions")).status === 403, "regular users cannot open the review queue");
let subs = (await admin.req("GET", "/api/admin/submissions?status=pending&type=panel")).data;
ok(subs.items.some((i) => i._id === eid && i.ownerName === "Ada Lovelace" && i.match === null), "admin sees Ada's module in the review queue, marked as a new model");
res = await admin.req("POST", `/api/admin/submissions/${eid}`, { action: "add", item: { brand: "Ada Co", model: `AC-${RUN}`, specs: { pmaxW: 460 }, verified: true, datasheetUrl: "https://example.com/ac.pdf", notes: "Checked" } });
ok(res.status === 200, "admin corrects a value and adds the module to the global library");
const globalId = res.data.libraryItem;
let carolPanels = (await carol.req("GET", "/api/equipment?type=panel")).data.items;
const promoted = carolPanels.find((i) => i._id === globalId);
ok(promoted?.builtIn && promoted.verified && promoted.specs.pmaxW === 460 && !promoted.contributedByName, "every user now sees it as a verified library item (contributor not revealed)");
const adaOwn = (await ada.req("GET", "/api/equipment?type=panel")).data.items.find((i) => i._id === eid);
ok(adaOwn?.specs.pmaxW === 455 && adaOwn.libraryStatus === "added", "Ada's own copy is unchanged and shows it was added to the library");
ok((await admin.req("GET", "/api/admin/equipment?type=panel")).data.items.find((i) => i._id === globalId)?.contributedByName === "Ada Lovelace", "admin library view credits the contributor");

r = await ada.req("POST", "/api/equipment", { type: "panel", brand: "ada co", model: `ac-${RUN}`, specs: { pmaxW: 470 } });
const dupId = r.data.item._id;
subs = (await admin.req("GET", "/api/admin/submissions?status=pending&type=panel")).data;
ok(subs.items.find((i) => i._id === dupId)?.match?._id === globalId, "a submission of a model already in the library is flagged with the match");
res = await admin.req("POST", `/api/admin/submissions/${dupId}`, { action: "add", item: { brand: "ada co", model: `ac-${RUN}`, specs: { pmaxW: 470 } } });
ok(res.status === 409 && res.data.code === "duplicate" && res.data.matchId === globalId, "adding a duplicate as new is refused with the matching item");
res = await admin.req("POST", `/api/admin/submissions/${dupId}`, { action: "add", targetId: globalId, item: { brand: "Ada Co", model: `AC-${RUN}`, specs: { pmaxW: 470 }, verified: true, datasheetUrl: "https://example.com/ac.pdf" } });
carolPanels = (await carol.req("GET", "/api/equipment?type=panel")).data.items;
ok(res.status === 200 && carolPanels.find((i) => i._id === globalId)?.specs.pmaxW === 470 && carolPanels.filter((i) => i.model.toLowerCase() === `ac-${RUN}`).length === 1, "admin updates the existing library item instead of duplicating it");

r = await ada.req("POST", "/api/equipment", { type: "controller", brand: "Ada Co", model: `CC-${RUN}`, specs: { ratedCurrentA: 60 } });
const ccId = r.data.item._id;
ok((await admin.req("POST", `/api/admin/submissions/${ccId}`, { action: "dismiss", comment: "Missing datasheet" })).status === 200, "admin dismisses an item with a note");
subs = (await admin.req("GET", "/api/admin/submissions?status=dismissed")).data;
ok(subs.items.find((i) => i._id === ccId)?.review?.comment === "Missing datasheet" && !(await carol.req("GET", "/api/equipment?type=controller")).data.items.some((i) => i.model === `CC-${RUN}`), "dismissed items stay private");
await ada.req("PATCH", `/api/equipment/${ccId}`, { type: "controller", brand: "Ada Co", model: `CC-${RUN}`, specs: { ratedCurrentA: 60 }, datasheetUrl: "https://example.com/cc.pdf" });
ok((await admin.req("GET", "/api/admin/submissions?status=pending")).data.items.some((i) => i._id === ccId), "when the user edits a dismissed item it returns to the queue");
ok(typeof (await admin.req("GET", "/api/admin/stats")).data.submissions === "number", "the overview counts equipment waiting for review");

/* ---------------- Unshare ---------------- */
ok((await bob.req("POST", `/api/projects/${pid}/share`, { orgId: null })).status === 403, "only the owner can change sharing");
ok((await ada.req("POST", `/api/projects/${pid}/share`, { orgId: null })).status === 200 && (await bob.req("GET", `/api/projects/${pid}`)).status === 404, "unsharing removes Bob's access");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll collaboration checks passed");
process.exit(failures ? 1 : 0);
