const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false); w.confirm = ()=>true;
console.log("(TZ: "+Intl.DateTimeFormat().resolvedOptions().timeZone+")");

console.log("— Gemini #1 (refutation receipts): no timestamp drift —");
const sid = w.eval("db.sessions[0].id");
const before = w.eval(`sessById("${sid}").date`);
w.openSessionModal(sid); d.getElementById("f_summary").value += " tweak"; w.onSave();
ok(w.eval(`sessById("${sid}").date`)===before, "edit-resave leaves the timestamp byte-identical");
ok(w.normDate("2026-06-10T20:38")==="2026-06-10T20:38", "local-naive datetime round-trips unchanged (no double offset)");
const z = w.normDate("2026-06-11T00:38:00.000Z");
const expected = (()=>{ const t=new Date("2026-06-11T00:38:00.000Z"); const l=new Date(t.getTime()-t.getTimezoneOffset()*60000); return l.toISOString().slice(0,16); })();
ok(z===expected, "explicit-Z converts to correct local wall time: "+z);

console.log("— Gemini #2 (fixed): lineage survives bridge deletion —");
w.mergeSync(JSON.stringify({syncVersion:1,projects:[{name:"ChainTest"}],sessions:[
 {title:"A",project:"ChainTest",source:"Claude.ai",date:"2026-06-09T10:00",summary:"a",status:"done"},
 {title:"B",project:"ChainTest",source:"Claude.ai",date:"2026-06-09T10:05",summary:"b",status:"done",continuedFromTitle:"A"},
 {title:"C",project:"ChainTest",source:"Claude.ai",date:"2026-06-09T10:10",summary:"c",status:"active",continuedFromTitle:"B"}]}));
const A = w.eval('db.sessions.find(s=>s.title==="A")');
const B = w.eval('db.sessions.find(s=>s.title==="B")');
w.openSessionModal(B.id); w.onDelete();
const C = w.eval('db.sessions.find(s=>s.title==="C")');
ok(C.continuedFrom===A.id, "C spliced to grandparent A — lineage preserved, not nulled");
w.eval(`state.view="chain"; state.chainProject=db.projects.find(p=>p.name==="ChainTest").id; render();`);
ok(d.getElementById("content").innerHTML.includes("carrow ") === d.getElementById("content").innerHTML.includes("carrow"), "");
ok(!d.querySelector(".carrow.nolink") && !d.querySelector(".carrow.broken"), "A→C drawn as a genuine solid link after splice");
// dangling parent (e.g. arrived via import): marker, not silence
w.eval('db.sessions.find(s=>s.title==="C").continuedFrom="ghost-id"; save(); state.view="timeline"; state.filterSource="all"; state.filterProject=db.projects.find(p=>p.name==="ChainTest").id; render();');
ok(d.getElementById("content").textContent.includes("no longer on the board"), "timeline flags a missing parent instead of hiding it");
w.eval('state.view="chain"; render();');
ok(d.querySelector(".carrow.broken")!==null && d.getElementById("content").textContent.includes("parent missing"), "chain shows ⚠ parent missing");
// unlinked neighbors get an honest dotted arrow
w.eval('db.sessions.find(s=>s.title==="C").continuedFrom=null; save(); render();');
ok(d.querySelector(".carrow.nolink")!==null, "date-neighbors without a link get a dotted no-link arrow, not a fake solid one");

console.log("— Gemini #3 (fixed): same title ≠ same session when dates disagree —");
w.eval('state.filterProject="all";');
w.mergeSync(JSON.stringify({syncVersion:1,projects:[{name:"AuthWork"}],sessions:[
 {title:"Auth Refactor",project:"AuthWork",source:"Claude.ai",date:"2026-06-01T10:00",summary:"day one",accomplished:"Completed JWT storage configuration",status:"done"}]}));
const r2 = w.mergeSync(JSON.stringify({syncVersion:1,sessions:[
 {title:"Auth Refactor",project:"AuthWork",source:"Claude.ai",date:"2026-06-09T15:00",summary:"different chat, same name",accomplished:"Investigated cookie expiration bugs",status:"active"}]}));
ok(r2.addedS===1 && r2.updatedS===0, "8 days apart → treated as a NEW session");
const auth = w.eval('db.sessions.filter(s=>s.title==="Auth Refactor")');
ok(auth.length===2, "both sessions exist");
ok(auth.some(s=>s.accomplished.includes("JWT")) && auth.some(s=>s.accomplished.includes("cookie")), "ORIGINAL NOTES PRESERVED — Gemini's data-erasure scenario neutralized");
const r3 = w.mergeSync(JSON.stringify({syncVersion:1,sessions:[
 {title:"Auth Refactor",project:"AuthWork",source:"Claude.ai",date:"2026-06-09T16:30",summary:"same chat, re-synced 90min later",accomplished:"Investigated cookie expiration bugs; fixed",status:"done"}]}));
ok(r3.addedS===0 && r3.updatedS===1, "90 minutes apart → same session, updates (dedupe intact)");
ok(w.eval('db.sessions.filter(s=>s.title==="Auth Refactor").length')===2, "still exactly two — no dupe explosion");

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
