const cfg=window.VOTING_CONFIG,$=s=>document.querySelector(s);let key="",dash=null;
async function g(path){const r=await fetch(cfg.apiBase+path,{headers:{"x-admin-key":key}}),d=await r.json();if(!r.ok)throw Error(d.message||d.error||"Failed");return d}
async function p(path,b){const r=await fetch(cfg.apiBase+path,{method:"POST",headers:{"x-admin-key":key,"content-type":"application/json"},body:JSON.stringify(b)}),d=await r.json();if(!r.ok)throw Error(d.message||d.error||"Failed");return d}
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const pct=(n,t)=>t?Math.round((n/t)*1000)/10:0;
const fmt=v=>Number(v||0).toFixed(Number(v||0)%1===0?0:1)+"%";
function giveToken(name,token,label){const ok=confirm(`${label}\n\n${name}\nToken: ${token}\n\nPress OK to copy the token.`);if(ok&&navigator.clipboard)navigator.clipboard.writeText(token)}
function stats(eligible,voted,remaining,turnout){return `<div class="stat"><span class="stat-label">Eligible</span><strong>${eligible}</strong></div><div class="stat"><span class="stat-label">Votes cast</span><strong>${voted}</strong></div><div class="stat"><span class="stat-label">Remaining</span><strong>${remaining}</strong></div><div class="stat"><span class="stat-label">Turnout</span><strong>${fmt(turnout)}</strong></div>`}
function bars(title,obj,total){
 const e=Object.entries(obj||{}).sort((a,b)=>Number(b[1])-Number(a[1])||a[0].localeCompare(b[0]));
 if(!e.length)return `<section class="result-section"><h3>${esc(title)}</h3><div class="empty-results">No votes received.</div></section>`;
 const max=Math.max(...e.map(([,v])=>Number(v)),1);
 return `<section class="result-section"><h3>${esc(title)}</h3><div class="bar-chart">${e.map(([n,v])=>`<div class="bar-row ${n==="Abstain"?"abstain":""}"><div class="bar-label">${esc(n)}</div><div class="bar-track"><div class="bar-fill" style="width:${Number(v)/max*100}%"></div></div><div class="bar-value"><b>${v}</b> <span>${fmt(pct(Number(v),total))}</span></div></div>`).join("")}</div></section>`;
}
function topChoice(obj,total){
 const e=Object.entries(obj||{});if(!e.length)return{name:"—",votes:0,share:0};
 const max=Math.max(...e.map(([,v])=>Number(v))),leaders=e.filter(([,v])=>Number(v)===max).map(([k])=>k);
 return{name:leaders.length>1?"Tie: "+leaders.join(" / "):leaders[0],votes:max,share:pct(max,total)};
}

async function refresh(){
 dash=await g("/api/admin/dashboard");
 $("#phase").value=dash.phase;$("#allowNames").checked=dash.allowNameSuggestions;
 $("#nameRoundStatus").innerHTML=`Round <b>${dash.nameRound}</b> — ${dash.nameRoundOpen?"OPEN":"CLOSED"}`;
 $("#closeNameRound").disabled=dash.phase!=="NAME_VOTING"||!dash.nameRoundOpen;
 $("#startRunoff").disabled=dash.phase!=="NAME_VOTING"||dash.nameRoundOpen;

 $("#members").innerHTML=dash.members.map(m=>`<tr>
  <td>${esc(m.display_name)}</td>
  <td>${Number(m.name_voted_round||0)===Number(dash.nameRound)?"✓":""}</td>
  <td>${m.nomination_submitted?"✓":""}</td>
  <td>${m.voted?"✓":""}</td>
  <td class="member-actions">
   <button class="change-token-btn" data-id="${m.id}" data-name="${esc(m.display_name)}">Change token</button>
   <button class="remove-member-btn" data-id="${m.id}" data-name="${esc(m.display_name)}" data-voted="${m.voted?1:0}" ${m.voted?"disabled":""}>Remove</button>
  </td></tr>`).join("");

 $("#noms").innerHTML=dash.nominations.map(n=>`<tr><td>${esc(n.title)}</td><td>${esc(n.display_name)}</td></tr>`).join("")||"<tr><td colspan=2>No confirmed nominations yet</td></tr>";
 await renderResults();
}

$("#members").addEventListener("click",async e=>{
 const c=e.target.closest(".change-token-btn");
 if(c){if(!confirm(`Generate a NEW token for ${c.dataset.name}? The old token will stop working.`))return;try{const d=await p("/api/admin/reset-token",{member_id:Number(c.dataset.id)});giveToken(d.display_name,d.token,"Token changed successfully.")}catch(err){alert(err.message)}return}
 const r=e.target.closest(".remove-member-btn");
 if(r){if(r.dataset.voted==="1")return alert("This member has already cast an anonymous executive ballot and cannot be permanently removed.");if(!confirm(`Remove ${r.dataset.name}? Their token and self-nominations will be removed.`))return;try{alert((await p("/api/admin/remove-member",{member_id:Number(r.dataset.id)})).message);await refresh()}catch(err){alert(err.message)}}
});

$("#adminLogin").onclick=async()=>{key=$("#adminKey").value;try{await refresh();$("#loginBox").classList.add("hidden");$("#dash").classList.remove("hidden")}catch(e){alert(e.message)}};
$("#savePhase").onclick=async()=>{try{await p("/api/admin/set-phase",{phase:$("#phase").value});await refresh()}catch(e){alert(e.message)}};
$("#allowNames").onchange=async()=>{try{await p("/api/admin/set-name-suggestions",{enabled:$("#allowNames").checked})}catch(e){alert(e.message)}};
$("#closeNameRound").onclick=async()=>{if(!confirm("Close the current association-name voting round? No more name votes will be accepted in this round."))return;try{alert((await p("/api/admin/close-name-round",{})).message);await refresh()}catch(e){alert(e.message)}};
$("#startRunoff").onclick=async()=>{if(!confirm("Start a new run-off round using the top two results? The SAME member tokens will be used again."))return;try{const d=await p("/api/admin/start-runoff",{});alert(`${d.message}\n\nFinalists:\n${d.finalists.join("\n")}`);await refresh()}catch(e){alert(e.message)}};
$("#addMemberBtn").onclick=async()=>{const name=$("#newMemberName").value.trim();if(!name)return alert("Enter the member name.");try{const d=await p("/api/admin/add-member",{display_name:name});$("#newMemberName").value="";giveToken(d.display_name,d.token,"Member added successfully.");await refresh()}catch(e){alert(e.message)}};
$("#changeAdminPassword").onclick=async()=>{const a=$("#newAdminPassword").value,b=$("#confirmAdminPassword").value;if(a.length<10)return alert("Use at least 10 characters.");if(a!==b)return alert("Passwords do not match.");if(!confirm("Change the admin password?"))return;try{const d=await p("/api/admin/change-password",{new_password:a});key=a;$("#newAdminPassword").value="";$("#confirmAdminPassword").value="";alert(d.message)}catch(e){alert(e.message)}};
$("#showResults").onclick=renderResults;

async function renderResults(){
 try{
  const d=await g("/api/admin/results");
  $("#nameTurnoutCards").innerHTML=stats(d.eligible,d.name.voted,d.name.remaining,d.name.turnout_pct);
  if(d.name.open){
   $("#nameDetailedResults").classList.add("hidden");$("#nameResultsLocked").classList.remove("hidden");
   $("#nameResultsLocked").innerHTML=`🔒 <div><b>Name-voting round ${d.name.round} is still open.</b><br><span class="muted small">Only turnout is visible until you close the round.</span></div>`;
  }else{
   $("#nameResultsLocked").classList.add("hidden");$("#nameDetailedResults").classList.remove("hidden");
   const s=d.name.summary;
   if(!s)$("#nameDecision").textContent="No association-name votes were received.";
   else if(s.threshold_reached)$("#nameDecision").innerHTML=`✅ <b>${esc(s.leaders[0])}</b> received <b>${fmt(s.share)}</b> and reached the 75% direct-approval threshold.`;
   else $("#nameDecision").innerHTML=`A single name did not reach the 75% threshold${s.leaders.length>1?" (there is also a tie for first place)":""}. A run-off can be started from the controls above.`;
   $("#nameChart").innerHTML=bars(`Association name — round ${d.name.round}`,d.name.tallies,d.name.voted);
  }

  $("#execTurnoutCards").innerHTML=stats(d.eligible,d.executive.voted,d.executive.remaining,d.executive.turnout_pct);
  if(!d.executive.results_visible){
   $("#execDetailedResults").classList.add("hidden");$("#execResultsLocked").classList.remove("hidden");
   $("#execResultsLocked").innerHTML=`🔒 <div><b>Executive results are hidden.</b><br><span class="muted small">They will be revealed when the whole election is set to CLOSED.</span></div>`;
  }else{
   $("#execResultsLocked").classList.add("hidden");$("#execDetailedResults").classList.remove("hidden");
   const total=d.executive.ballots||0,rows=[];
   if(!d.name.open&&d.name.summary){rows.push({item:"Association name",...topChoice(d.name.tallies,d.name.voted)})}
   for(const pos of d.positions||[]){rows.push({item:pos.title,...topChoice(d.executive.tallies?.positions?.[pos.id]||{},total)})}
   $("#summaryBody").innerHTML=rows.map(r=>`<tr><td>${esc(r.item)}</td><td><b>${esc(r.name)}</b></td><td>${r.votes}</td><td>${fmt(r.share)}</td></tr>`).join("");
   $("#positionCharts").innerHTML=(d.positions||[]).map(pos=>bars(pos.title,d.executive.tallies?.positions?.[pos.id]||{},total)).join("");
  }
 }catch(e){alert(e.message)}
}
