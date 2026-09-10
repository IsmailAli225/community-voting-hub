const cfg=window.VOTING_CONFIG,$=s=>document.querySelector(s);let key="";

async function g(path){
 const r=await fetch(cfg.apiBase+path,{headers:{"x-admin-key":key}});
 const d=await r.json();
 if(!r.ok)throw Error(d.message||d.error||"Failed");
 return d;
}
async function p(path,b){
 const r=await fetch(cfg.apiBase+path,{method:"POST",headers:{"x-admin-key":key,"content-type":"application/json"},body:JSON.stringify(b)});
 const d=await r.json();
 if(!r.ok)throw Error(d.message||d.error||"Failed");
 return d;
}
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
function giveToken(name,token,label){
 const ok=confirm(`${label}\n\n${name}\nToken: ${token}\n\nPress OK to copy the token.`);
 if(ok&&navigator.clipboard)navigator.clipboard.writeText(token);
}
async function refresh(){
 const d=await g("/api/admin/dashboard");
 $("#phase").value=d.phase;
 $("#allowNames").checked=d.allowNameSuggestions;
 $("#members").innerHTML=d.members.map(m=>`<tr>
   <td>${esc(m.display_name)}</td>
   <td>${m.nomination_submitted?"✓":""}</td>
   <td>${m.voted?"✓":""}</td>
   <td class="member-actions">
    <button class="change-token-btn" data-member-id="${m.id}" data-member-name="${esc(m.display_name)}">Change token</button>
    <button class="remove-member-btn" data-member-id="${m.id}" data-member-name="${esc(m.display_name)}" data-voted="${m.voted?1:0}" ${m.voted?"disabled title='Cannot permanently remove after voting'":""}>Remove</button>
   </td></tr>`).join("");
 $("#noms").innerHTML=d.nominations.map(n=>`<tr><td>${esc(n.title)}</td><td>${esc(n.display_name)}</td></tr>`).join("")||"<tr><td colspan=2>No confirmed nominations yet</td></tr>";
 await renderResults();
}

// Use event delegation rather than inline onclick attributes.
// This works reliably with Arabic names, spaces, apostrophes, and other characters.
$("#members").addEventListener("click",async(e)=>{
 const change=e.target.closest(".change-token-btn");
 if(change){
  const id=Number(change.dataset.memberId);
  const name=change.dataset.memberName;
  if(!confirm(`Generate a NEW token for ${name}?\n\nThe previous token will stop working immediately.`))return;
  try{
   const d=await p("/api/admin/reset-token",{member_id:id});
   giveToken(d.display_name,d.token,"Token changed successfully.");
  }catch(err){alert(err.message)}
  return;
 }

 const remove=e.target.closest(".remove-member-btn");
 if(remove){
  const id=Number(remove.dataset.memberId);
  const name=remove.dataset.memberName;
  const voted=remove.dataset.voted==="1";
  if(voted)return alert("This member has already voted and cannot be permanently removed because ballots are anonymous.");
  if(!confirm(`Remove ${name} from the election?\n\nTheir token will stop working and any self-nomination will be deleted.`))return;
  try{
   alert((await p("/api/admin/remove-member",{member_id:id})).message);
   await refresh();
  }catch(err){alert(err.message)}
 }
});

$("#adminLogin").onclick=async()=>{
 key=$("#adminKey").value;
 try{await refresh();$("#loginBox").classList.add("hidden");$("#dash").classList.remove("hidden")}
 catch(e){alert(e.message)}
};
$("#savePhase").onclick=async()=>{await p("/api/admin/set-phase",{phase:$("#phase").value});await refresh()};
$("#allowNames").onchange=async()=>{await p("/api/admin/set-name-suggestions",{enabled:$("#allowNames").checked})};
$("#addMemberBtn").onclick=async()=>{
 const name=$("#newMemberName").value.trim();
 if(!name)return alert("Enter the member name.");
 try{
  const d=await p("/api/admin/add-member",{display_name:name});
  $("#newMemberName").value="";
  giveToken(d.display_name,d.token,"Member added successfully.");
  await refresh()
 }catch(e){alert(e.message)}
};
$("#changeAdminPassword").onclick=async()=>{
 const a=$("#newAdminPassword").value,b=$("#confirmAdminPassword").value;
 if(a.length<10)return alert("Use at least 10 characters.");
 if(a!==b)return alert("Passwords do not match.");
 if(!confirm("Change the admin password now?"))return;
 try{
  const d=await p("/api/admin/change-password",{new_password:a});
  key=a;$("#newAdminPassword").value="";$("#confirmAdminPassword").value="";
  alert(d.message)
 }catch(e){alert(e.message)}
};
$("#showResults").onclick=renderResults;

function pct(n,total){return total?Math.round((n/total)*1000)/10:0}
function formatPct(v){return Number(v).toFixed(v%1===0?0:1)+"%"}
function topChoice(obj,total){
 const entries=Object.entries(obj||{});
 if(!entries.length)return {name:"—",votes:0,pct:0};
 const max=Math.max(...entries.map(([,v])=>Number(v)));
 const leaders=entries.filter(([,v])=>Number(v)===max).map(([k])=>k);
 return {name:leaders.length>1?"Tie: "+leaders.join(" / "):leaders[0],votes:max,pct:pct(max,total)};
}
function statsHtml(d){
 return `
  <div class="stat"><span class="stat-label">Eligible members</span><strong>${d.eligible??0}</strong></div>
  <div class="stat"><span class="stat-label">Votes cast</span><strong>${d.voted??0}</strong></div>
  <div class="stat"><span class="stat-label">Remaining</span><strong>${d.remaining??0}</strong></div>
  <div class="stat"><span class="stat-label">Turnout</span><strong>${formatPct(d.turnout_pct??0)}</strong></div>`;
}
function barsHtml(title,obj,total){
 const entries=Object.entries(obj||{}).sort((a,b)=>Number(b[1])-Number(a[1])||a[0].localeCompare(b[0]));
 if(!entries.length)return `<section class="result-section"><h3>${esc(title)}</h3><div class="empty-results">No votes received.</div></section>`;
 const max=Math.max(...entries.map(([,v])=>Number(v)),1);
 return `<section class="result-section"><h3>${esc(title)}</h3>
  <div class="bar-chart">${entries.map(([name,v])=>{
    const share=pct(Number(v),total),width=(Number(v)/max)*100;
    const abstain=name==="Abstain";
    return `<div class="bar-row ${abstain?"abstain":""}">
      <div class="bar-label" title="${esc(name)}">${esc(name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <div class="bar-value"><b>${v}</b> <span>${formatPct(share)}</span></div>
    </div>`;
  }).join("")}</div></section>`;
}
async function renderResults(){
 try{
  const d=await g("/api/admin/results");
  $("#turnoutCards").innerHTML=statsHtml(d);
  if(!d.results_visible){
   $("#detailedResults").classList.add("hidden");
   $("#resultsLocked").classList.remove("hidden");
   $("#resultsLocked").innerHTML=`<div class="lock-icon">🔒</div><div><b>Detailed results are hidden while the election is ${esc(d.phase)}.</b><br><span class="muted small">You can monitor turnout without seeing voting choices. Set the election phase to CLOSED to reveal the final charts and summary table.</span></div>`;
   return;
  }
  $("#resultsLocked").classList.add("hidden");
  $("#detailedResults").classList.remove("hidden");
  const total=Number(d.ballots||0);
  const rows=[];
  const assocTop=topChoice(d.tallies?.association_name,total);
  rows.push({item:"Association name",...assocTop});
  for(const p of d.positions||[]){
   const t=topChoice(d.tallies?.positions?.[p.id]||{},total);
   rows.push({item:p.title,...t});
  }
  $("#summaryBody").innerHTML=rows.map(r=>`<tr><td>${esc(r.item)}</td><td><b>${esc(r.name)}</b></td><td>${r.votes}</td><td>${formatPct(r.pct)}</td></tr>`).join("");
  $("#associationChart").innerHTML=barsHtml("Association name",d.tallies?.association_name||{},total).replace(/^<section class="result-section">|<\/section>$/g,"");
  $("#positionCharts").innerHTML=(d.positions||[]).map(p=>barsHtml(p.title,d.tallies?.positions?.[p.id]||{},total)).join("");
 }catch(e){alert(e.message)}
}
