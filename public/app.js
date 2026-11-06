const $ = s => document.querySelector(s);
let authMode = "login";
function showAuth(mode, role = "") {
  authMode = mode;
  $("#authModal").classList.add("open");
  renderAuth(role);
}
function closeAuth(){ $("#authModal").classList.remove("open"); $("#authMessage").textContent=""; }
function renderAuth(role = "") {
  const content = $("#authContent");
  if (authMode === "login") {
    content.innerHTML = `<h2>Welcome back</h2><p class="modal-intro">Sign in to your Verified Workers account.</p>
    <form class="auth-form" id="loginForm"><label>Email address</label><input name="email" type="email" required placeholder="you@example.com"><label>Password</label><input name="password" type="password" required placeholder="Your password"><button class="btn btn-primary">Log in</button></form>
    <div class="switch-auth"><button onclick="showForgotPassword()">Forgot password?</button> · New here? <button onclick="authMode='register';renderAuth()">Create an account</button></div>`;
    $("#loginForm").onsubmit = login;
  } else {
    content.innerHTML = `<h2>Create your account</h2><p class="modal-intro">Join workers, employers and agencies across Kenya.</p>
    <form class="auth-form" id="registerForm">
    <label>Account type</label><select name="role" id="accountRole" required><option value="worker">Worker</option><option value="employer">Employer</option><option value="agency">Recruitment agency</option></select>
    <label>Full name</label><input name="fullName" required maxlength="100" placeholder="Your full name">
    <label>Email address</label><input name="email" type="email" required placeholder="you@example.com">
    <label>Phone number</label><input name="phone" required placeholder="07XXXXXXXX">
    <div id="orgField" style="display:none"><label>Organisation / agency name</label><input name="organization" placeholder="Registered business name"></div>
    <div id="workerFields"><label>Occupation / skill</label><input name="occupation" placeholder="e.g. Electrician, Driver, Chef"><label>County</label><input name="county" placeholder="County"><label>Town</label><input name="town" placeholder="Town"></div>
    <label>Password (minimum 8 characters)</label><input name="password" type="password" minlength="8" required placeholder="Create a strong password">
    <label style="display:flex;gap:8px;align-items:flex-start;font-weight:500"><input type="checkbox" name="termsAccepted" value="true" required style="width:auto"> I accept the <a href="/terms.html" target="_blank" rel="noopener">Terms of Service</a>.</label>
    <label style="display:flex;gap:8px;align-items:flex-start;font-weight:500"><input type="checkbox" name="privacyConsent" value="true" required style="width:auto"> I have read the <a href="/privacy.html" target="_blank" rel="noopener">Privacy Notice</a> and consent to the processing of my information as described.</label><button class="btn btn-primary">Create account</button>
    <p class="fineprint">By registering, you agree to provide accurate information. Registration costs Ksh 199 once. Payment does not guarantee employment or identity verification.</p></form>
    <div class="switch-auth">Already registered? <button onclick="authMode='login';renderAuth()">Log in</button></div>`;
    if (role) $("#accountRole").value = role;
    const roleSelect = $("#accountRole");
    const updateRole = () => {
      $("#orgField").style.display = ["employer","agency"].includes(roleSelect.value) ? "block" : "none";
      $("#workerFields").style.display = roleSelect.value === "worker" ? "grid" : "none";
    };
    roleSelect.addEventListener("change", updateRole); updateRole();
    $("#registerForm").onsubmit = register;
  }
}
async function api(url, options = {}) {
  const response = await fetch(url, { credentials:"same-origin", headers:{"Content-Type":"application/json", ...(options.headers||{})}, ...options });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
function showForgotPassword(){
  $("#authContent").innerHTML=`<h2>Reset your password</h2><p class="modal-intro">Enter the email address on your account. If email delivery is configured, we will send a secure reset link.</p><form id="forgotForm" class="auth-form"><label>Email address</label><input name="email" type="email" required placeholder="you@example.com"><button class="btn btn-primary">Send reset link</button></form><div class="switch-auth"><button onclick="authMode='login';renderAuth()">Back to login</button></div>`;
  $("#forgotForm").onsubmit=async e=>{e.preventDefault();try{const d=await api("/api/account/password/forgot",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))});$("#authMessage").textContent=d.message;$("#authMessage").className="message ok"}catch(err){$("#authMessage").textContent=err.message}};
}
async function register(e) {
  e.preventDefault(); const form = Object.fromEntries(new FormData(e.target).entries());
  try {
    const result = await api("/api/auth/register",{method:"POST",body:JSON.stringify(form)});
    $("#authMessage").className="message ok"; $("#authMessage").textContent=result.message;
    renderPaymentStep(result.user);
  } catch(err) { $("#authMessage").textContent=err.message; }
}
function renderPaymentStep(user) {
  $("#authContent").innerHTML = `<h2>Complete registration</h2><p class="modal-intro">Your account has been created. Pay the one-time registration fee to activate your account.</p><div class="dashboard-panel"><b>Registration fee</b><h2>Ksh 199</h2><p>Enter the M-Pesa number to receive the payment prompt.</p></div><form class="auth-form" id="paymentForm"><label>M-Pesa phone number</label><input name="phone" value="${escapeHtml(user.phone||"")}" required placeholder="07XXXXXXXX"><button class="btn btn-primary">Pay Ksh 199 with M-Pesa (Optimapay)</button></form><p class="fineprint">Your account will be activated only after the server independently verifies the Ksh 199 payment with Optimapay.</p>`;
  $("#paymentForm").onsubmit = async e => {
    e.preventDefault();
    try { const result = await api("/api/payments/mpesa/stk-push",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))}); $("#authMessage").className="message ok"; $("#authMessage").textContent=result.message || "Payment request sent. Check your phone."; if(result.paymentId){ let attempts=0; const poll=async()=>{ if(attempts++>=24)return; try{ const state=await api(`/api/payments/${result.paymentId}/status`); if(state.payment?.status==="paid"){ $("#authMessage").textContent="Payment confirmed. Your registration is now active."; setTimeout(()=>location.href="/dashboard.html",1200); return; } if(state.payment?.status==="failed"){ $("#authMessage").textContent="Payment was not completed. You can try again."; return; } }catch(_){} setTimeout(poll,5000); }; setTimeout(poll,5000); } }
    catch(err){ $("#authMessage").className="message"; $("#authMessage").textContent=err.message; }
  };
}
async function login(e) {
  e.preventDefault();
  try { await api("/api/auth/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target).entries()))}); location.href="/dashboard.html"; }
  catch(err){ $("#authMessage").textContent=err.message; }
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function loadJobs(){
  try { const {jobs}=await api("/api/jobs"); $("#jobResults").innerHTML=jobs.length?jobs.map(j=>`<article class="job-card"><span class="meta">${escapeHtml(j.county||"Kenya")} · ${escapeHtml(j.employmentType||"Full-time")}</span><h4>${escapeHtml(j.title)}</h4><p>${escapeHtml((j.description||"").slice(0,150))}${j.description?.length>150?"…":""}</p><b style="font-size:11px">${escapeHtml(j.salary||"Negotiable")}</b></article>`).join(""):`<div class="empty-state">No published vacancies yet. Check back soon.</div>`; }
  catch { $("#jobResults").innerHTML='<div class="empty-state">Job listings are temporarily unavailable.</div>'; }
}
async function searchWorkers(){
  const params=new URLSearchParams(); if($("#skillSearch").value)params.set("skill",$("#skillSearch").value);if($("#countySearch").value)params.set("county",$("#countySearch").value);
  try{const {workers}=await api("/api/workers?"+params);$("#workerResults").innerHTML=workers.length?workers.map(w=>`<article class="worker-card"><div class="worker-profile-top"><span class="worker-avatar">${escapeHtml((w.fullName||"W").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase())}</span><span>${w.isPaid?'<span class="public-paid-check" title="Registration fee paid">✓ Fee paid</span>':'<span class="public-unpaid">Fee not paid</span>'}</span></div><h4>${escapeHtml(w.fullName)}</h4><p>${escapeHtml(w.occupation||"Skilled professional")} · ${escapeHtml(w.town||w.county||"Kenya")}</p><p>${escapeHtml((w.skills||[]).join(" · "))}</p>${w.bio?`<p>${escapeHtml(w.bio.slice(0,150))}</p>`:""}</article>`).join(""):'<div class="empty-state">No worker profiles match your search.</div>'; }
  catch{$("#workerResults").innerHTML='<div class="empty-state">Unable to load worker profiles.</div>';}
}
$("#year").textContent=new Date().getFullYear();loadJobs();searchWorkers();
