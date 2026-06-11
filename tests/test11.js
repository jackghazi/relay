const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false); w.confirm = ()=>true;

console.log("— v1.6 handoff minter: CAI plan → CC build —");

// Seed a parent planning session on Claude.ai (Jack's real pattern)
w.eval(`
  db.projects.push({id:"pht", name:"HandoffTest", short:"HT", color:"#888", desc:"", status:"active"});
  db.sessions.push({id:"parent1", serial:serialFor("ai", true), seq:1,
    title: serialFor("ai", false).replace(/\\d+$/,"") + " · HT · widget app plan · #1 · 2026-06-11 · active",
    aka:"widget app plan", project:"pht", source:"Claude.ai", date:nowLocal(),
    summary:"planned the widget app", brief:"Plan widget app architecture",
    accomplished:"architecture decided, stack chosen", status:"active",
    continuedFrom:null, handoffAt:"", notes:"hand the build to Claude Code"});
  save(); render();
`);
const parent = w.eval('sessById("parent1")');
ok(/^CAI-\d{4}$/.test(parent.serial), "parent is a CAI session: " + parent.serial);

const beforeCount = w.eval("db.sessions.length");
const ccBefore = w.eval("(db.meta.serials && db.meta.serials.code) || 0");

// Open the chooser from the parent's Start-next button path
w.openHandoff("parent1");
ok(d.getElementById("overlay4").classList.contains("show"), "surface chooser opens");
ok(d.getElementById("ho_from").innerHTML.includes(parent.serial), "chooser names the parent serial");

// Pick Claude Code — the cross-surface handoff
w.handoffMint("code");
const child = w.eval("db.sessions[db.sessions.length-1]");
ok(w.eval("db.sessions.length") === beforeCount + 1, "exactly one successor session created");
ok(/^CC-\d{4}$/.test(child.serial), "successor minted with CC flavor: " + child.serial);
ok(child.source === "Claude Code", "successor source is Claude Code");
ok(child.continuedFrom === "parent1", "chain link set: child.continuedFrom → parent");
ok(child.project === parent.project, "successor inherits the project");
ok(child.status === "active" && child.title.includes(child.serial), "successor active, serial in title");
ok(w.eval("db.meta.serials.code") === ccBefore + 1, "CC serial counter committed (next mint won't collide)");

// The kickoff prompt must teach the new Claude BOTH identities
const prompt = d.getElementById("ho_prompt").value;
ok(prompt.includes(child.serial) && prompt.includes(parent.serial), "kickoff prompt carries BOTH ids (new + parent)");
ok(prompt.includes("ID: " + child.serial), "wrap-up block instructs the NEW id, not the parent's");
ok(prompt.includes(parent.accomplished), "parent's accomplished state travels in the prompt");

// Persistence: minted session survives a save/load cycle
const raw = w.eval("localStorage.getItem(STORE_KEY)");
ok(raw && raw.includes(child.serial), "successor persisted to storage");

// Chooser closes clean
w.closeHandoff();
ok(!d.getElementById("overlay4").classList.contains("show"), "chooser closes");

console.log(`\ntest11: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
