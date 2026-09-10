const cfg=window.VOTING_CONFIG,$=s=>document.querySelector(s);let token="",boot=null;
$("#appTitle").textContent=cfg.title;
const msg=(e,t,c="notice")=>{e.textContent=t;e.className=c};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
const phaseLabel=p=>({NAME_VOTING:"Association Name Vote",NOMINATION:"Self-Nomination",EXECUTIVE_VOTING:"Executive Voting",CLOSED:"Closed"}[p]||p);

async function api(path,body){
 const r=await fetch(cfg.apiBase+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const d=await r.json();if(!r.ok)throw Error(d.message||d.error||"Request failed");return d;
}

async function load(){
 boot=await api("/api/bootstrap",{token});
 $("#login").classList.add("hidden");$("#member").classList.remove("hidden");
 $("#memberName").textContent=boot.member.display_name;$("#phaseBadge").textContent=phaseLabel(boot.phase);
 ["nameVotingView","nominationView","executiveVotingView","closedView","doneView"].forEach(id=>$("#"+id).classList.add("hidden"));

 if(boot.completed){
  $("#doneView").classList.remove("hidden");
  $("#doneView").innerHTML="<h2>Executive vote already submitted ✓</h2><p>Your final executive vote has already been recorded. This token cannot be used to vote again.</p>";
  return;
 }
 if(boot.phase==="NAME_VOTING"){$("#nameVotingView").classList.remove("hidden");renderNameStage()}
 else if(boot.phase==="NOMINATION"){ $("#nominationView").classList.remove("hidden");renderNomination()}
 else if(boot.phase==="EXECUTIVE_VOTING"){ $("#executiveVotingView").classList.remove("hidden");await renderExecutiveVote()}
 else $("#closedView").classList.remove("hidden");
}

$("#enterBtn").onclick=async()=>{
 token=$("#token").value.trim();
 try{await load()}catch(e){msg($("#loginMsg"),e.message,"error")}
};

function renderNames(selected=""){
 $("#associationChoices").innerHTML=(boot.associationNames||[]).map(n=>`
 <label class="option">
  <input type="radio" name="association_name" value="${esc(n.name)}" ${selected===n.name?"checked":""}>
  <span>${esc(n.name)}</span>
 </label>`).join("");
}

function renderNameStage(){
 $("#addNameBox").classList.toggle("hidden",!boot.allowNameSuggestions || boot.nameRound>1 || !boot.nameRoundOpen);
 if(!boot.nameRoundOpen){
  $("#nameVoteForm").classList.add("hidden");
  $("#nameAlreadyVoted").classList.remove("hidden");
  $("#nameAlreadyVoted").textContent=`Association-name voting round ${boot.nameRound} is closed. Keep your token for the next stage.`;
  return;
 }
 if(boot.nameVoteSubmitted){
  $("#nameVoteForm").classList.add("hidden");
  $("#nameAlreadyVoted").classList.remove("hidden");
  $("#nameAlreadyVoted").textContent=`Your association-name vote for round ${boot.nameRound} has already been submitted. Keep this same token for the next stage.`;
  return;
 }
 $("#nameVoteForm").classList.remove("hidden");$("#nameAlreadyVoted").classList.add("hidden");renderNames();
}

$("#addAssociationName").onclick=async()=>{
 const name=$("#newAssociationName").value.trim();
 try{
  const d=await api("/api/add-association-name",{token,name});
  const latest=await api("/api/association-names",{token});
  boot.associationNames=latest.names;renderNames(d.name.name);$("#newAssociationName").value="";
  msg($("#addNameMsg"),d.message,"success");
 }catch(e){msg($("#addNameMsg"),e.message,"error")}
};

$("#submitNameVote").onclick=async()=>{
 const a=$('input[name="association_name"]:checked');
 if(!a)return msg($("#nameVoteMsg"),"Please choose an association name.","error");
 if(!$("#nameConfirm").checked)return msg($("#nameVoteMsg"),"Please confirm your final choice.","error");
 $("#submitNameVote").disabled=true;
 try{
  const d=await api("/api/vote-name",{token,choice:a.value});
  $("#nameVoteForm").classList.add("hidden");$("#nameAlreadyVoted").classList.remove("hidden");
  $("#nameAlreadyVoted").textContent=d.message;
 }catch(e){msg($("#nameVoteMsg"),e.message,"error");$("#submitNameVote").disabled=false}
};

function renderNomination(){
 $("#nominationIntro").innerHTML=`Choose the position(s) where <b>${esc(boot.member.display_name)}</b> is willing to serve.`;
 $("#nominationPositions").innerHTML=boot.positions.map(p=>`
 <div class="position"><label class="option">
  <input type="checkbox" value="${esc(p.id)}" ${boot.myNominations.includes(p.id)?"checked":""}>
  <span><b>${esc(p.title)}</b><br><span class="muted small">${esc(p.description)}</span></span>
 </label></div>`).join("");
}

$("#saveNomination").onclick=async()=>{
 const ids=[...$("#nominationPositions").querySelectorAll("input:checked")].map(x=>x.value);
 try{
  await api("/api/submit-nomination",{token,position_ids:ids});
  msg($("#nominationMsg"),ids.length?`Saved. You are nominated for ${ids.length} position(s).`:"Saved. You are not nominated for any position.","success");
 }catch(e){msg($("#nominationMsg"),e.message,"error")}
};

async function renderExecutiveVote(){
 const c=await api("/api/candidates",{token});
 $("#candidateVotes").innerHTML=c.positions.map(p=>`
 <div class="question"><h3>${esc(p.title)}</h3><p class="muted small">${esc(p.description)}</p>
 ${p.candidates.map(n=>`<label class="option"><input type="radio" name="p_${esc(p.id)}" value="${esc(n)}"><span>${esc(n)}</span></label>`).join("")}
 ${!p.candidates.length?"<p class='warning'>No confirmed candidate for this position.</p>":""}
 <label class="option"><input type="radio" name="p_${esc(p.id)}" value="Abstain"><span>Abstain / امتنع</span></label>
 </div>`).join("");
}

$("#submitExecutiveVote").onclick=async()=>{
 const positions={};
 for(const p of boot.positions){
  const x=$(`input[name="p_${CSS.escape(p.id)}"]:checked`);
  if(!x)return msg($("#executiveVoteMsg"),`Please choose a response for ${p.title}.`,"error");
  positions[p.id]=x.value;
 }
 if(!$("#executiveConfirm").checked)return msg($("#executiveVoteMsg"),"Please confirm your final selections.","error");
 $("#submitExecutiveVote").disabled=true;
 try{
  await api("/api/vote-executive",{token,positions});
  $("#executiveVotingView").classList.add("hidden");$("#doneView").classList.remove("hidden");
  $("#doneView").innerHTML="<h2>Executive vote submitted ✓</h2><p>جزاكم الله خيراً. Your anonymous executive ballot has been recorded and this token cannot vote again.</p>";
 }catch(e){msg($("#executiveVoteMsg"),e.message,"error");$("#submitExecutiveVote").disabled=false}
};
