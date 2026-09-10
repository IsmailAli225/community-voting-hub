const cfg=window.VOTING_CONFIG,$=s=>document.querySelector(s);let key="";
async function g(path){const r=await fetch(cfg.apiBase+path,{headers:{"x-admin-key":key}}),d=await r.json();if(!r.ok)throw Error(d.message||d.error||"Failed");return d}
async function p(path,b){const r=await fetch(cfg.apiBase+path,{method:"POST",headers:{"x-admin-key":key,"content-type":"application/json"},body:JSON.stringify(b)}),d=await r.json();if(!r.ok)throw Error(d.message||d.error||"Failed");return d}
function giveToken(name,token,label){const ok=confirm(`${label}\n\n${name}\nToken: ${token}\n\nPress OK to copy the token.`);if(ok&&navigator.clipboard)navigator.clipboard.writeText(token)}
async function refresh(){
 const d=await g("/api/admin/dashboard");$("#phase").value=d.phase;$("#allowNames").checked=d.allowNameSuggestions;
 $("#members").innerHTML=d.members.map(m=>`<tr><td>${m.display_name}</td><td>${m.nomination_submitted?"✓":""}</td><td>${m.voted?"✓":""}</td><td>
 <button onclick="resetToken(${m.id},${JSON.stringify(m.display_name)})">Change token</button>
 <button onclick="removeMember(${m.id},${JSON.stringify(m.display_name)},${m.voted?1:0})" ${m.voted?"disabled title='Cannot permanently remove after voting'":""}>Remove</button>
 </td></tr>`).join("");
 $("#noms").innerHTML=d.nominations.map(n=>`<tr><td>${n.title}</td><td>${n.display_name}</td></tr>`).join("")||"<tr><td colspan=2>No confirmed nominations yet</td></tr>";
}
$("#adminLogin").onclick=async()=>{key=$("#adminKey").value;try{await refresh();$("#loginBox").classList.add("hidden");$("#dash").classList.remove("hidden")}catch(e){alert(e.message)}};
$("#savePhase").onclick=async()=>{await p("/api/admin/set-phase",{phase:$("#phase").value});await refresh()};
$("#allowNames").onchange=async()=>{await p("/api/admin/set-name-suggestions",{enabled:$("#allowNames").checked})};
$("#addMemberBtn").onclick=async()=>{const name=$("#newMemberName").value.trim();if(!name)return alert("Enter the member name.");try{const d=await p("/api/admin/add-member",{display_name:name});$("#newMemberName").value="";giveToken(d.display_name,d.token,"Member added successfully.");await refresh()}catch(e){alert(e.message)}};
window.resetToken=async(id,name)=>{if(!confirm(`Generate a NEW token for ${name}?\n\nThe previous token will stop working immediately.`))return;try{const d=await p("/api/admin/reset-token",{member_id:id});giveToken(d.display_name,d.token,"Token changed successfully.");}catch(e){alert(e.message)}};
window.removeMember=async(id,name,voted)=>{if(voted)return alert("This member has already voted and cannot be permanently removed because ballots are anonymous.");if(!confirm(`Remove ${name} from the election?\n\nTheir token will stop working and any self-nomination will be deleted.`))return;try{alert((await p("/api/admin/remove-member",{member_id:id})).message);await refresh()}catch(e){alert(e.message)}};
$("#changeAdminPassword").onclick=async()=>{const a=$("#newAdminPassword").value,b=$("#confirmAdminPassword").value;if(a.length<10)return alert("Use at least 10 characters.");if(a!==b)return alert("Passwords do not match.");if(!confirm("Change the admin password now?"))return;try{const d=await p("/api/admin/change-password",{new_password:a});key=a;$("#newAdminPassword").value="";$("#confirmAdminPassword").value="";alert(d.message)}catch(e){alert(e.message)}};
$("#showResults").onclick=async()=>$("#results").textContent=JSON.stringify(await g("/api/admin/results"),null,2);
