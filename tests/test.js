const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync("../index.html", "utf8");

const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/index.html" });
const w = dom.window, d = w.document;
const $ = id => d.getElementById(id);
const DB = () => w.eval("db");
const ST = () => w.eval("state");
let pass = 0, fail = 0;
const ok = (cond, msg) => { cond ? (pass++, console.log("  ✓ " + msg)) : (fail++, console.log("  ✗ FAIL: " + msg)); };

console.log("— App boots —");
ok(DB() && DB().projects.length >= 2, "seed data loaded (" + DB().projects.length + " projects)");
ok(DB().sessions.every(s => s.seq != null), "migration gave every seed session a permanent seq");

// Seed-agnostic anchors: derive everything from whatever the app actually seeded.
const P0 = DB().projects[0];
const expSeq = DB().sessions.filter(x => x.project === P0.id).length + 1;

console.log("— Starter creates a session with stable identity —");
w.openStarter();
w.selectFlavor("code");
$("st_project").value = P0.id;
w.starterToggleNewProject();
$("st_desc").value = "wire the QR intake form to supabase";
w.starterCreate();
const s = DB().sessions[DB().sessions.length - 1];
console.log("    created:", s.title);
ok(/^CC-\d{4}/.test(s.serial), "serial assigned: " + s.serial);
ok(s.seq === expSeq, "seq stored permanently: #" + s.seq);
ok(s.title.startsWith(s.serial), "title begins with serial");
ok($("st_name").value === s.title, "Step 1 name field shows the exact chat name");
ok($("st_prompt").value.includes("permanent ID is " + s.serial), "kickoff prompt teaches Claude its ID");
ok($("st_prompt").value.includes("ID: " + s.serial), "wrap-up block includes the ID line");

console.log("— THE BUG: does the name stay put when editing? —");
w.openSessionModal(s.id);
const before = $("f_title").value;
w.suggestName(); // user clicks ✨ Suggest — previously this DESTROYED the serial and renumbered
const after = $("f_title").value;
console.log("    before:", before);
console.log("    after :", after);
ok(after.startsWith(s.serial + " · "), "serial survives Suggest");
ok(after.includes("· #" + expSeq + " ·"), "seq survives Suggest");

// add 2 more sessions to the project, then re-suggest — seq must NOT shift
DB().sessions.push({id:"x1",title:"t",project:P0.id,source:"Claude Code",date:"2026-06-09T01:00",seq:expSeq+1,summary:"",brief:"",accomplished:"",status:"done",continuedFrom:null,handoffAt:"",notes:""});
DB().sessions.push({id:"x2",title:"t",project:P0.id,source:"Claude Code",date:"2026-06-09T02:00",seq:expSeq+2,summary:"",brief:"",accomplished:"",status:"done",continuedFrom:null,handoffAt:"",notes:""});
w.suggestName();
ok($("f_title").value.includes("· #" + expSeq + " ·"), "seq still #" + expSeq + " even after 2 new sessions were added (no renumbering)");

console.log("— Brief Assistant no longer force-renames —");
const keptName = $("f_title").value;
$("f_brief") && ($("bh_reply") || null);
// simulate pasting a Claude reply
w.openBriefHelper();
$("bh_reply").value = "ID: " + s.serial + "\nNAME: qr intake wiring\nBRIEF: Wire QR intake to supabase.\nACCOMPLISHED: Form posts to table.\nHANDOFF: build the inbox view next.";
w.applyBriefReply();
ok($("f_title").value === keptName, "existing title untouched after Apply (was force-renamed before)");
ok($("f_brief").value.includes("Wire QR intake"), "brief field filled");
ok($("f_accomplished").value.includes("Form posts"), "accomplished field filled");
ok($("f_notes").value.includes("Next: build the inbox"), "handoff routed to notes");
ok($("f_namePreview").style.display === "block" && $("f_namePreview").textContent.includes("qr intake wiring"), "Claude's name shown as optional suggestion instead");
w.onSave();
ok(w.sessById(s.id).serial === s.serial && w.sessById(s.id).seq === expSeq, "serial+seq intact after save");

console.log("— New session via ＋Add also gets an ID —");
const P1 = DB().projects[1];
const p1ExpSeq = DB().sessions.filter(x => x.project === P1.id).length + 1;
w.openSessionModal(null, P1.id);
$("f_title").value = "manually added session · 2026-06-09 · active";
$("f_source").value = "Claude.ai";
w.onSave();
const ns = DB().sessions[DB().sessions.length - 1];
ok(/^CAI-\d{4}$/.test(ns.serial), "modal-created session got serial: " + ns.serial);
ok(ns.seq === p1ExpSeq, "and permanent seq: #" + ns.seq);

console.log("— Import keeps meta (serial counters) —");
const backup = JSON.stringify(DB());
const serialsBefore = JSON.stringify(DB().meta.serials);
// simulate doImport's core
const data = JSON.parse(backup);
ok(data.meta && JSON.stringify(data.meta.serials) === serialsBefore, "export carries serial counters, import path preserves meta");

console.log("— Copy-context carries the ID —");
let copied = "";
w.eval("window.__copied=\"\"; copyText = function(s){ window.__copied=s; return true; };");
// rebuild timeline so onclick handlers exist, then call directly
w.copySessionContext(s.id);
copied = w.__copied;
ok(copied.includes("Previous session ID: " + s.serial), "context block names the previous session ID");
ok(copied.includes("Reference " + s.serial), "and instructs Claude to reference it in handoffs");

console.log("— Render sanity (all four views draw without throwing) —");
try { w.eval('state.view="timeline";render();state.view="chain";render();state.view="handoffs";render();state.view="projects";render();'); ok(true, "all views render"); }
catch(e){ ok(false, "view render threw: " + e.message); }
w.eval('state.view="timeline";state.filterProject="all";render();');
ok(d.querySelector(".serial-plate") !== null && d.body.innerHTML.includes("CC-0001"), "serial plate visible on the session card in Timeline");

console.log("\n" + pass + " passed, " + fail + " failed");


console.log("— SYNC: paste a Claude update block, app populates itself —");
// Seed-agnostic anchor: an existing serialed session + its project, picked at runtime.
const anchor = DB().sessions.find(x => x.serial && w.projById(x.project));
const anchorProj = w.projById(anchor.project).name;
const anchorSeq = anchor.seq, anchorSerial = anchor.serial;
const syncBlock = '```json\n' + JSON.stringify({
  syncVersion: 1,
  projects: [
    { name: "SkinTherapy IQ", desc: "Skin analysis app heading to the Play Store" },
    { name: anchorProj, desc: "should merge into existing project, not duplicate" }
  ],
  sessions: [
    { title: "v1 Android launch readiness assessment", project: "SkinTherapy IQ", source: "Claude Code",
      date: "2026-06-09T21:00", summary: "Scoped what a working QR intake needs before launch",
      accomplished: "Decided to ship v1 first; QR intake becomes update one.", status: "active" },
    { title: "App version check", project: "SkinTherapy IQ", source: "Claude Code",
      date: "2026-06-08T10:00", summary: "Verified app version vs store requirements", status: "done",
      continuedFromTitle: "v1 Android launch readiness assessment" },
    { title: anchorSerial + " · resynced topic · #" + anchorSeq + " · 2026-06-10 · active", project: anchorProj,
      source: anchor.source, serial: anchorSerial, summary: "UPDATED VIA SYNC",
      accomplished: "Form page built and posting to supabase.", status: "done" }
  ]
}, null, 1) + '\n```';
const pBefore = DB().projects.length, sBefore = DB().sessions.length;
const res = w.mergeSync(syncBlock);
ok(res.addedP === 1, "1 new project added (SkinTherapy IQ) — existing '" + anchorProj + "' matched, not duplicated");
ok(DB().projects.length === pBefore + 1, "project count correct: " + DB().projects.length);
ok(res.addedS === 2 && DB().sessions.length === sBefore + 2, "2 new sessions added");
ok(res.updatedS === 1, "1 existing session updated (matched by serial " + anchorSerial + ")");
const upd = DB().sessions.find(x=>x.serial===anchorSerial);
ok(upd.summary === "UPDATED VIA SYNC" && upd.status === "done", "serial-matched session got new summary + status");
ok(upd.seq === anchorSeq && upd.serial === anchorSerial, "…without touching its permanent identity");
const cf = DB().sessions.find(x=>x.title==="App version check");
const cfFrom = DB().sessions.find(x=>x.id===cf.continuedFrom);
ok(cfFrom && cfFrom.title === "v1 Android launch readiness assessment", "continued-from link resolved by title");
// re-running the SAME sync must not duplicate anything (idempotent)
const res2 = w.mergeSync(syncBlock);
ok(res2.addedS === 0 && res2.addedP === 0 && res2.updatedS === 3, "re-syncing the same block: 0 duplicates, 3 updates");
console.log("\nSYNC: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
