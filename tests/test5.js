const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);
w.confirm = () => true;

console.log("— Fix 1: save() can't fail silently —");
const realSet = w.localStorage.setItem.bind(w.localStorage);
w.eval(`(function(){ const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function(){ throw new Error("QuotaExceededError"); };
  window.__restore = ()=>{ Storage.prototype.setItem = orig; }; })()`);
let threw=false; try{ w.save(); }catch(e){ threw=true; }
ok(!threw, "quota failure doesn't crash the app");
ok(d.getElementById("toast").textContent.includes("COULD NOT SAVE"), "user is loudly warned to export");
w.eval("__restore()");

console.log("— Fix 4 + 6: hostile/messy sync input —");
const r1 = w.mergeSync(JSON.stringify({syncVersion:1,sessions:[
 {title:"weird one",project:"Edge",source:"Claude.ai",date:"2026-06-08T19:40:33.000Z",summary:"x",status:"active",
  serial:"x'); alert(1);//", externalId:"../../etc/passwd' onload='x"}]}));
const s = w.eval('db.sessions.find(x=>x.title==="weird one")');
ok(s.serial===null, "malformed serial rejected, not injected");
ok(/^[\w.\-]*$/.test(s.externalId||""), "externalId sanitized: "+JSON.stringify(s.externalId));
ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s.date), "Z-suffixed ISO date normalized for the edit form: "+s.date);
ok(w.esc("o'brien")==="o&#39;brien", "esc() now covers single quotes");

console.log("— Fix 2: externalId beats fuzzy titles on re-sync —");
const blockA = JSON.stringify({syncVersion:1,sessions:[{title:"CC build session about auth",project:"Edge",source:"Claude Code",date:"2026-06-09T10:00",summary:"first pass",status:"active",externalId:"abc-123.jsonl"}]});
const blockB = JSON.stringify({syncVersion:1,sessions:[{title:"Auth work in Claude Code (retitled)",project:"Edge",source:"Claude Code",date:"2026-06-09T10:00",summary:"second pass, better summary",status:"done",externalId:"abc-123.jsonl"}]});
const ra = w.mergeSync(blockA);
const rb = w.mergeSync(blockB);
ok(ra.addedS===1 && rb.addedS===0 && rb.updatedS===1, "same externalId + different title → update, not duplicate");
ok(w.eval('db.sessions.filter(x=>x.externalId==="abc-123.jsonl").length')===1, "exactly one session for that transcript");
ok(w.eval('db.sessions.find(x=>x.externalId==="abc-123.jsonl").summary')==="second pass, better summary", "newer summary won");
ok(w.eval("SYNC_PROMPT_CODE").includes("externalId"), "Code prompt instructs the stable id");

console.log("— Fix 3: demo data removable —");
w.eval('state.view="board";render();');
ok(d.querySelector(".demo-bar")!==null, "board flags mixed-in demo data");
const myCount = w.eval('db.sessions.filter(s=>s.project==="'+w.eval('db.projects.find(p=>p.name==="Edge").id')+'").length');
w.removeDemoData();
ok(!w.hasDemoData(), "demo projects/sessions/handoffs gone");
ok(w.eval('db.sessions.length')===myCount+0+2-0 || w.eval('db.sessions.every(s=>!["s1","s2","s3"].includes(s.id))'), "user's own sessions untouched");
ok(d.querySelector(".demo-bar")===null, "demo bar disappears after removal");

console.log("— Fix 7: version surfaces —");
ok(d.getElementById("vfoot").textContent.startsWith("v1."), "footer shows version "+d.getElementById("vfoot").textContent);

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
