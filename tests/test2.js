const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync("../index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
const w = dom.window, d = w.document;
const $ = id => d.getElementById(id);
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };

console.log("— Welcome flow —");
ok($("overlayWelcome").classList.contains("show"), "first-run welcome appears");
w.finishWelcome(false);
ok(!$("overlayWelcome").classList.contains("show") && w.eval("db.meta.welcomed")===true, "welcome dismissed + remembered (demo kept)");

console.log("— Board (default view) —");
ok(w.eval("state.view")==="board", "board is the home view");
ok(d.querySelectorAll(".stat").length===5, "5 stat tiles render");
ok(d.querySelector(".jump")!==null, "jump-back-in cards for live lines");
ok(d.querySelector(".panel-card svg rect")!==null, "activity sparkline renders");
// make a session stale + an orphan handoff, re-render
w.eval(`db.sessions[2].date="2026-05-20T09:15"; db.handoffs.push({id:"hX",name:"HANDOFF_TEST.md",writtenBy:"s2",usedBy:[],note:""}); render();`);
ok(d.body.textContent.includes("has been quiet for"), "stale line warning shows");
ok(d.body.textContent.includes("no session has picked it up") , "orphan handoff warning shows");

console.log("— Status report —");
w.eval('window.__copied=""; copyText=function(s){window.__copied=s;return true;};');
w.copyStatusReport();
const rep = w.__copied;
ok(rep.startsWith("# Session board"), "report is markdown");
const seedProj = w.eval("db.projects[0].name"); // seed-agnostic: whatever the app seeded first
ok(rep.includes("## " + seedProj) && rep.includes("Handoff not yet picked up: HANDOFF_TEST.md"), "report covers projects + orphan handoffs");

console.log("— Theme toggle —");
ok(d.documentElement.getAttribute("data-theme")==="dark", "boots in dark");
w.toggleTheme();
ok(d.documentElement.getAttribute("data-theme")==="light" && w.eval("db.meta.theme")==="light", "switches to light + persists");
w.toggleTheme();

console.log("— Command palette —");
w.openPalette();
ok($("overlayPal").classList.contains("show"), "Ctrl+K palette opens");
const frag = seedProj.slice(0,4).toLowerCase();
w.renderPalette(frag);
ok($("palList").textContent.includes(seedProj), "fuzzy finds '" + frag + "' → " + seedProj);
w.renderPalette("sync");
ok($("palList").textContent.includes("Sync from Claude"), "actions searchable");
w.palRun(0);
ok(!$("overlayPal").classList.contains("show"), "Enter runs item + closes");
d.querySelector(".overlay.show") && d.querySelector(".overlay.show").classList.remove("show");

console.log("— Shortcuts —");
w.closeModal(); d.activeElement && d.activeElement.blur();
const key=(k,o={})=>d.dispatchEvent(new w.KeyboardEvent("keydown",{key:k,bubbles:true,...o}));
key("3"); ok(w.eval("state.view")==="timeline", "press 3 → timeline");
key("1"); ok(w.eval("state.view")==="board", "press 1 → board");
key("k",{ctrlKey:true}); ok($("overlayPal").classList.contains("show"), "Ctrl+K via keyboard");
key("Escape"); ok(!$("overlayPal").classList.contains("show"), "Esc closes palette");

console.log("— Regression: core still intact —");
w.eval('state.view="timeline";render();state.view="chain";render();state.view="handoffs";render();state.view="projects";render();state.view="board";render();');
ok(true, "all five views render without throwing");
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
