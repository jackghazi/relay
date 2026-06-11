const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);

console.log("— Clickable surfaces —");
ok(d.querySelectorAll(".brand a.srf").length===3, "all three surface names are clickable");
w.openSurfaceModal("code");
let t = d.getElementById("mBody").textContent;
ok(t.includes(".claude\\projects") || t.includes(".claude/projects"), "Code hub shows where transcript files live (incl. Windows path)");
ok(/\d+ sessions? tracked/.test(t), "session count from that surface shown");
w.eval('window.__c="";copyText=s=>{window.__c=s;return true;}');
d.querySelector("#mBody .btn.primary").click();
ok(w.__c.includes("~/.claude/projects/"), "one click copies the Code sync prompt");

console.log("— Source filter —");
w.closeModal();
w.setSourceFilter("Claude Code");
ok(w.eval("state.view")==="timeline" && w.eval("state.filterSource")==="Claude Code", "View its sessions → timeline filtered by source");
const shown = [...d.querySelectorAll(".scard .src-tag")].map(x=>x.textContent.trim());
ok(shown.length>0 && shown.every(x=>x.includes("Claude Code")), "only Code sessions visible ("+shown.length+")");
ok(d.getElementById("filterbar").textContent.includes("Claude Code only ✕"), "active filter chip shows with a clear ✕");
w.setSourceFilter("all");
ok(!d.getElementById("filterbar").textContent.includes("only ✕"), "chip clears");

console.log("— Cowork hub honesty + ai scope note —");
w.openSurfaceModal("cowork");
ok(d.getElementById("mBody").textContent.includes("No transcript files"), "Cowork hub states the honest limit");
w.openSurfaceModal("ai");
ok(d.getElementById("mBody").textContent.includes("INSIDE each Project"), "Claude.ai hub explains the Projects scope");
w.closeModal();
ok(d.getElementById("vfoot").textContent==="v"+w.eval("APP_VERSION"), "footer matches APP_VERSION");

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
