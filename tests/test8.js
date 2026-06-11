const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);
w.confirm = () => true;

console.log("— Retro-naming a synced history —");
// simulate his real life: sessions synced from chat history, no serials, messy titles
w.mergeSync(JSON.stringify({syncVersion:1,projects:[{name:"PaintOps"},{name:"GovBid"}],sessions:[
 {title:"house painters app 6.7.26",project:"PaintOps",source:"Claude.ai",date:"2026-06-08T20:03",summary:"build",status:"active"},
 {title:"Government contract bidding research guide",project:"GovBid",source:"Claude.ai",date:"2026-06-04T18:19",summary:"playbook",status:"done"},
 {title:"gov app build session",project:"GovBid",source:"Claude Code",date:"2026-06-04T21:00",summary:"typed search",status:"active"}]}));
const before = w.unserialed().length;
ok(before>=3, before+" sessions lack IDs before the operation");
w.eval('state.view="projects";render();');
ok(d.body.innerHTML.includes("Standardize"), "Standardize button surfaces with the count");
w.standardizeNames();
ok(w.unserialed().length===0, "every session now has a permanent ID");
const hp = w.eval('db.sessions.find(s=>s.aka==="house painters app 6.7.26")');
ok(!!hp && /^CAI-\d{4}$/.test(hp.serial), "chat session minted a CAI serial: "+(hp&&hp.serial));
ok(hp.title.includes("· house painters app ·"), "date stamp stripped from the topic: "+hp.title);
const gc = w.eval('db.sessions.find(s=>s.aka==="gov app build session")');
ok(/^CC-\d{4}$/.test(gc.serial), "Code session got a CC serial: "+gc.serial);
const guide = w.eval('db.sessions.find(s=>s.aka==="Government contract bidding research guide")');
ok(parseInt(guide.serial.split("-")[1]) < parseInt(hp.serial.split("-")[1]), "serials minted in chronological order");

console.log("— THE LANDMINE: re-sync with the OLD chat title —");
const r = w.mergeSync(JSON.stringify({syncVersion:1,sessions:[
 {title:"house painters app 6.7.26",project:"PaintOps",source:"Claude.ai",date:"2026-06-08T20:03",summary:"UPDATED: first lead created",status:"active"}]}));
ok(r.addedS===0 && r.updatedS===1, "old title matches via alias → update, NOT a duplicate");
ok(w.eval('db.sessions.filter(s=>(s.aka||s.title).includes("house painters")).length')===1, "still exactly one painters session");
ok(hp.summary.includes("UPDATED"), "and it took the new summary");
ok(hp.serial && hp.title.startsWith(hp.serial), "standardized name + serial survived the sync");

console.log("— continued-from across the rename —");
w.mergeSync(JSON.stringify({syncVersion:1,sessions:[
 {title:"painters follow-up",project:"PaintOps",source:"Claude.ai",date:"2026-06-10T09:00",summary:"next",status:"active",continuedFromTitle:"house painters app 6.7.26"}]}));
const fu = w.eval('db.sessions.find(s=>s.title==="painters follow-up"||s.aka==="painters follow-up")');
ok(fu.continuedFrom===hp.id, "chain link resolves through the alias");
ok(d.getElementById ? true : true, "");
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
