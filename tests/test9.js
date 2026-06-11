const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);
w.confirm = () => true;

console.log("— Undo: bad sync, one keystroke back —");
const sessionsBefore = w.eval("db.sessions.length");
w.mergeSync(JSON.stringify({syncVersion:1,projects:[{name:"Oops Inc"}],sessions:[
 {title:"junk 1",project:"Oops Inc",source:"Claude.ai",date:"2026-06-10T10:00",summary:"x",status:"active"},
 {title:"junk 2",project:"Oops Inc",source:"Claude.ai",date:"2026-06-10T11:00",summary:"x",status:"active"}]}));
ok(w.eval("db.sessions.length")===sessionsBefore+2, "bad sync landed 2 junk sessions");
w.undoLast();
ok(w.eval("db.sessions.length")===sessionsBefore, "undo wiped the sync cleanly");
ok(!w.eval('db.projects.some(p=>p.name==="Oops Inc")'), "junk project gone too");

console.log("— Undo: standardize + remove-demo + delete —");
// Seed-agnostic: guarantee standardizeNames() has work to do by importing a
// serial-less session through the app's own merge path.
const pname = w.eval("db.projects[0].name");
w.mergeSync(JSON.stringify({syncVersion:1,projects:[{name:pname}],sessions:[
 {title:"imported without a serial yet",project:pname,source:"Claude.ai",date:"2026-06-10T12:00",summary:"x",status:"active"}]}));
ok(w.eval("db.sessions.some(s=>!s.serial)"), "merge path landed a serial-less session to standardize");
w.standardizeNames();
const serialed = w.eval("db.sessions.filter(s=>s.serial).length");
w.undoLast();
ok(w.eval("db.sessions.filter(s=>s.serial).length") < serialed, "standardize names is reversible");
w.removeDemoData();
ok(!w.hasDemoData(), "demo removed");
w.undoLast();
ok(w.hasDemoData(), "…and restored by undo");
// delete a session through the modal path
const sid = w.eval("db.sessions[0].id");
w.openSessionModal(sid);
const cnt = w.eval("db.sessions.length");
w.onDelete();
ok(w.eval("db.sessions.length")===cnt-1, "session deleted");
w.undoLast();
ok(w.eval("db.sessions.length")===cnt && w.eval(`db.sessions.some(s=>s.id==="${sid}")`), "deleted session resurrected");

console.log("— Undo mechanics —");
ok(w.eval("undoStack.length")<=5, "stack capped at 5");
const key=(k,o={})=>d.dispatchEvent(new w.KeyboardEvent("keydown",{key:k,bubbles:true,...o}));
w.removeDemoData();
key("z",{ctrlKey:true});
ok(w.hasDemoData(), "Ctrl+Z works from the keyboard");
for(let i=0;i<9;i++) w.undoLast();
ok(d.getElementById("toast").textContent.includes("Nothing to undo"), "empty stack says so instead of crashing");
ok(d.getElementById("vfoot").textContent==="v"+w.eval("APP_VERSION"), "version "+w.eval("APP_VERSION"));
console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
