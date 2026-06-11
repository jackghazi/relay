const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);

console.log("— Three-surface sync modal —");
w.openSyncModal();
ok(d.querySelectorAll("#syncTabs .tab").length===3, "three surface tabs render");
ok(d.getElementById("f_syncPrompt").value.includes("Relay session board") || d.getElementById("f_syncPrompt").value.includes("Session Tracker app"), "chats prompt loads by default");
w.pickSyncSurface("code");
const cp = d.getElementById("f_syncPrompt").value;
ok(cp.includes("~/.claude/projects/") && cp.includes("READ-ONLY"), "Code prompt mines the transcript folder, read-only");
ok(cp.includes('"source": "Claude.ai" | "Claude Code"'), "Code prompt carries the shared schema");
ok(d.getElementById("syncHint").textContent.includes("inside a Claude Code session"), "hint explains where to run it");
w.pickSyncSurface("cowork");
ok(d.getElementById("f_syncPrompt").value.includes("end every Cowork task"), "Cowork prompt has the wrap-up fallback");
w.pickSyncSurface("ai");
ok(d.getElementById("syncHint").textContent.includes("inside each Project"), "chats hint covers the Claude Projects scope");

console.log("— Code-style sync block merges (groups → projects) —");
const block = JSON.stringify({syncVersion:1,projects:[{name:"bjc",desc:"Boston Jack's Catering"}],sessions:[
 {title:"Boston Jack's Catering public website rebuild",project:"bjc",source:"Claude Code",date:"2026-06-08T15:00",summary:"Rebuilt the public site",accomplished:"Deployed.",status:"done"},
 {title:"Boston Jack's Catering deployment",project:"bjc",source:"Claude Code",date:"2026-06-09T10:00",summary:"Deployment pipeline",status:"active",continuedFromTitle:"Boston Jack's Catering public website rebuild"}]});
const r = w.mergeSync(block);
ok(r.addedP===1 && r.addedS===2, "Code group imported as a project with its sessions");
const s2 = w.eval("db.sessions.find(s=>s.title.includes('Catering deployment'))");
ok(!!s2.continuedFrom, "chain link resolved between the Code sessions");
w.eval('document.getElementById("f_syncIn") && closeModal()');
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
