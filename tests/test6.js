const { JSDOM } = require("jsdom");
const fs = require("fs");
const dom = new JSDOM(fs.readFileSync("../index.html","utf8"), { runScripts:"dangerously", url:"http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);

(async ()=>{
  console.log("— Data file: graceful where unsupported (jsdom = Firefox/Safari case) —");
  ok(w.eval("FS_SUPPORTED")===false, "API absence detected");
  ok(d.getElementById("fsBtn").style.display==="none", "💾 button hides itself — no dead UI");
  let crashed=false; try{ await w.fsBoot(); w.save(); }catch(e){ crashed=true; }
  ok(!crashed, "boot + save run clean with the feature unavailable");
  ok(w.eval("db.meta.savedAt") > 0, "saves are now timestamped (powers newest-wins on reconnect)");

  console.log("— Adopting file data (the multi-PC path) —");
  const fileData = JSON.stringify({meta:{savedAt:Date.now()+99999},projects:[{id:"pf",name:"From Laptop",short:"FL",color:"#fff",desc:"",status:"active"}],sessions:[{id:"sf",title:"laptop session",project:"pf",source:"Claude.ai",date:"2026-06-10T08:00",seq:1,summary:"made on the other PC",brief:"",accomplished:"",status:"active",continuedFrom:null,handoffAt:"",notes:""}],handoffs:[]});
  const adopted = await w.fsAdoptFileData(fileData);
  ok(adopted===true, "valid relay-data.json adopts cleanly");
  ok(w.eval('db.projects.some(p=>p.name==="From Laptop")'), "board now shows the other machine's data");
  ok(await w.fsAdoptFileData("{not json")===false, "corrupt file rejected without nuking local data");

  console.log("— Sync-file import —");
  const sync = new w.File([JSON.stringify({syncVersion:1,sessions:[{title:"cowork task via file",project:"From Laptop",source:"Cowork",date:"2026-06-10T09:00",summary:"imported from relay-sync.json",status:"done"}]})], "relay-sync.json", {type:"application/json"});
  w.openSyncModal();
  await w.syncFromFile({target:{files:[sync], value:""}});
  ok(w.eval('db.sessions.some(s=>s.title==="cowork task via file")'), "relay-sync.json imports through the same merge engine");
  ok(d.getElementById("toast").textContent.includes("relay-sync.json"), "toast names the imported file");
  const bad = new w.File(["garbage"], "x.json");
  let alerted=""; w.alert = m=>alerted=m;
  w.openSyncModal();
  await w.syncFromFile({target:{files:[bad], value:""}});
  ok(alerted.length>0, "garbage file → clear error, no crash");
  w.closeModal();

  console.log("— Prompts offer the file path —");
  ok(w.eval("SYNC_PROMPT_CODE").includes("relay-sync.json"), "Code prompt offers save-to-file");
  ok(w.eval("SYNC_PROMPT_COWORK").includes("relay-sync.json"), "Cowork prompt offers save-to-file");

  console.log("— Repo link configurable —");
  ok(d.getElementById("repolink").href===w.eval("REPO_URL"), "footer link reads from REPO_URL");
  ok(d.getElementById("vfoot").textContent==="v"+w.eval("APP_VERSION"), "footer matches APP_VERSION ("+w.eval("APP_VERSION")+")");

  console.log("\n"+pass+" passed, "+fail+" failed");
  process.exit(fail?1:0);
})();
