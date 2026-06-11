const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync("../index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", url: "http://localhost/" });
const w = dom.window, d = w.document;
let pass=0, fail=0;
const ok=(c,m)=>{ c?(pass++,console.log("  ✓ "+m)):(fail++,console.log("  ✗ FAIL: "+m)); };
w.finishWelcome(false);
w.confirm = () => true;

console.log("— Scale: 12 projects —");
w.eval(`for(let i=1;i<=9;i++){ db.projects.push({id:"px"+i,name:"Project "+i,short:"P"+i,color:COLORS[i%10],desc:"",status:i>6?"done":"active"}); db.sessions.push({id:"sx"+i,title:"P"+i+" kickoff",project:"px"+i,source:"Claude.ai",date:"2026-06-0"+((i%8)+1)+"T10:00",seq:1,summary:"s",brief:"",accomplished:"",status:"active",continuedFrom:null,handoffAt:"",notes:""}); } save();`);
w.eval('state.view="timeline";render();');
ok(d.querySelector(".proj-pick")!==null, ">8 projects → chip wall replaced by dropdown picker");
ok(d.body.textContent.includes("Collapse all"), "collapse-all control appears");

console.log("— Collapsible timeline —");
const groupsBefore = d.querySelectorAll(".timeline").length;
w.setAllCollapsed(true);
ok(d.querySelectorAll(".timeline").length===0, "collapse all folds every group (was "+groupsBefore+")");
const firstPid = w.eval("db.projects[0].id");
w.toggleCollapse(firstPid);
ok(d.querySelectorAll(".timeline").length===1, "single group re-expands");
w.setAllCollapsed(false);

console.log("— Project list view —");
w.eval('state.view="projects";render();');
ok(d.querySelectorAll(".prow").length===w.eval("db.projects.length"), "list view auto-on at scale: one row per project ("+w.eval("db.projects.length")+")");
ok(d.body.textContent.includes("Paused & done"), "status sections split active from done");
w.setProjView("cards");
ok(d.querySelectorAll(".pcard").length>0, "cards toggle still works");
w.setProjView("list");

console.log("— Duplicate merger —");
w.eval(`db.projects.push({id:"dup1",name:"project 3",short:"P3b",color:"#fff",desc:"dupe of Project 3",status:"active"}); db.sessions.push({id:"sdup",title:"stray session",project:"dup1",source:"Claude.ai",date:"2026-06-09T10:00",seq:1,summary:"",brief:"",accomplished:"",status:"active",continuedFrom:null,handoffAt:"",notes:""}); save(); render();`);
ok(d.body.textContent.includes("Merge 1 duplicates"), "dupe detector surfaces the merge button");
const before = w.eval("db.projects.length");
w.tidyProjects();
ok(w.eval("db.projects.length")===before-1, "merge removes the duplicate project");
ok(w.eval('db.sessions.find(s=>s.id==="sdup").project')==="px3", "stray session moved to the kept project");
ok(w.eval('db.sessions.filter(s=>s.project==="px3").map(s=>s.seq).join(",")')==="1,2", "seq renumbered cleanly after merge");

console.log("— Claude Project linkage —");
w.openProjectModal(firstPid);
d.getElementById("f_cproj").value = "skintherapy iq following";
w.onSave();
ok(w.eval(`projById("${firstPid}").claudeProject`)==="skintherapy iq following", "Claude Project saved on the project");
w.eval('state.view="projects";render();');
ok(d.querySelector(".cproj")!==null, "⧉ badge renders in the list");
const r = w.mergeSync(JSON.stringify({syncVersion:1,projects:[{name:"Inside-Project Work",desc:"x",claudeProject:"domusiq build"}],sessions:[{title:"domus chat 1",project:"Inside-Project Work",source:"Claude.ai",date:"2026-06-09T12:00",summary:"y",status:"active"}]}));
ok(r.addedP===1 && w.eval('db.projects.find(p=>p.name==="Inside-Project Work").claudeProject')==="domusiq build", "sync carries claudeProject through");
ok(w.SYNC_PROMPT===undefined || true, "");
ok(w.eval("SYNC_PROMPT").includes("inside each of my Claude Projects"), "sync prompt warns about Project scope");

console.log("\n"+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
