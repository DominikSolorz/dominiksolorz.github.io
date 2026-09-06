import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL='https://nzfyhteodpyewpatfmgd.supabase.co';
const SUPABASE_KEY='sb_publishable_pQyqrQFFZBwjHGDK_RbTsA_R93HWA1_';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let session=null;
let profile=null;
let authMode='login';

const $=(id)=>document.getElementById(id);
const all=(sel)=>[...document.querySelectorAll(sel)];
const money=(grosz)=>`${(Number(grosz||0)/100).toFixed(2).replace('.',',')} PLN`;

function setStatus(id,text,error=false){const el=$(id);if(!el)return;el.textContent=text||'';el.style.color=error?'#fca5a5':'#c4b5fd';}
function currentRoute(){const raw=(location.hash||'#home').slice(1).split('?')[0];return raw||'home';}
function showRoute(route){
  if(route==='register'){setAuthMode('register');route='auth';}
  const allowed=['home','creator','auth','dashboard','payments','goals','integrations','settings'];
  if(!allowed.includes(route))route='home';
  all('.view').forEach(v=>v.classList.add('hidden'));
  $(`view-${route}`)?.classList.remove('hidden');
  if(route==='creator')loadCreator();
  if(route==='dashboard')loadDashboard();
  if(route==='payments')loadPayments();
  if(route==='goals')loadGoals();
  if(route==='integrations')loadIntegrations();
  if(route==='settings')loadSettings();
  scrollTo({top:0,behavior:'instant'});
}

function refreshNav(){
  $('loginNav')?.classList.toggle('hidden',!!session);
  $('registerNav')?.classList.toggle('hidden',!!session);
  $('logoutNav')?.classList.toggle('hidden',!session);
}

function setAuthMode(mode){
  authMode=mode;
  $('tabLogin')?.classList.toggle('active',mode==='login');
  $('tabRegister')?.classList.toggle('active',mode==='register');
  $('nameLabel')?.classList.toggle('hidden',mode!=='register');
  if($('authTitle'))$('authTitle').textContent=mode==='login'?'Zaloguj się':'Załóż konto twórcy';
  if($('authSubmit'))$('authSubmit').textContent=mode==='login'?'Zaloguj się':'Zarejestruj się';
  setStatus('authStatus','');
}

async function initAuth(){
  const {data}=await supabase.auth.getSession();session=data.session;refreshNav();
  supabase.auth.onAuthStateChange((_event,newSession)=>{session=newSession;refreshNav();});
}

async function loadCreator(){
  const {data:p}=await supabase.from('stream_profiles').select('username,display_name,bio,stripe_payment_link_url').eq('username','dominik-demo').maybeSingle();
  if(p){$('creatorName').textContent=p.display_name;$('creatorHandle').textContent=`@${p.username}`;$('creatorBio').textContent=p.bio||'';if(p.stripe_payment_link_url)$('stripePay').href=p.stripe_payment_link_url;}
  const {data:g}=await supabase.rpc('stream_public_goal_progress',{p_username:'dominik-demo'}).maybeSingle();
  if(g){$('goalBox').classList.remove('hidden');$('goalTitle').textContent=g.title;$('goalValue').textContent=`${money(g.current_grosz)} / ${money(g.target_grosz)}`;const pct=Math.max(0,Math.min(100,Number(g.current_grosz)/Number(g.target_grosz)*100));$('goalProgress').style.width=`${pct}%`;}
}

async function requireProfile(){
  if(!session){location.hash='#auth';return null;}
  if(profile?.id)return profile;
  const {data:p,error}=await supabase.from('stream_profiles').select('*').eq('user_id',session.user.id).maybeSingle();
  if(error)throw error;profile=p;return p;
}

async function loadDashboard(){
  const gate=$('dashboardGate'),content=$('dashboardContent');
  if(!session){gate.classList.remove('hidden');content.classList.add('hidden');return;}
  try{
    const p=await requireProfile();if(!p){gate.classList.remove('hidden');content.classList.add('hidden');return;}
    gate.classList.add('hidden');content.classList.remove('hidden');$('dashName').textContent=p.display_name;$('dashUrl').textContent=`/c/${p.username}`;$('overlayLink').href=`./overlay.html?username=${encodeURIComponent(p.username)}`;
    const {data:d}=await supabase.from('stream_donations').select('id,payer_name,amount_grosz,status,moderation_status,message,created_at').eq('creator_profile_id',p.id).order('created_at',{ascending:false}).limit(20);
    const rows=d||[];$('dashCount').textContent=String(rows.length);$('dashTotal').textContent=money(rows.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount_grosz),0));
    $('donationList').innerHTML=rows.length?rows.map(x=>`<div><span>${escapeHtml(x.payer_name||'Anonim')}</span><b>${money(x.amount_grosz)}</b><em>${escapeHtml(x.status)} · ${escapeHtml(x.moderation_status)}</em><small>${escapeHtml(x.message||'—')}</small></div>`).join(''):'<small>Brak wpłat. Użyj przycisku testowego powyżej.</small>';
  }catch(e){setStatus('testStatus',e.message,true);}
}

async function loadPayments(){
  if(!session){location.hash='#auth';return;}
  try{const p=await requireProfile();if(!p)return;const {data:m,error}=await supabase.from('stream_payment_methods').select('id,provider,label,configured,enabled,min_amount_grosz').eq('profile_id',p.id).order('sort_order');if(error)throw error;
    $('paymentMethodList').innerHTML=(m||[]).map(x=>`<button class="paymentMethodRow ${x.enabled?'on':''}" data-method="${x.id}" data-enabled="${x.enabled}" data-configured="${x.configured}"><div><b>${escapeHtml(x.label)}</b><small>${x.configured?'Operator skonfigurowany':'Wymaga operatora / API'}</small></div><div><b>50 PLN</b><small>${x.enabled?'AKTYWNA':'WYŁ.'}</small></div></button>`).join('');
    all('[data-method]').forEach(btn=>btn.addEventListener('click',()=>togglePayment(btn)));
  }catch(e){setStatus('paymentStatus',e.message,true);}
}
async function togglePayment(btn){
  const configured=btn.dataset.configured==='true';const enabled=btn.dataset.enabled==='true';if(!configured){setStatus('paymentStatus','Ta metoda wymaga najpierw podłączenia operatora/API.',true);return;}
  const {error}=await supabase.rpc('stream_set_payment_method_enabled',{p_method_id:btn.dataset.method,p_enabled:!enabled});if(error){setStatus('paymentStatus',error.message,true);return;}setStatus('paymentStatus',`Metoda ${!enabled?'włączona':'wyłączona'}. Próg pozostaje 50 PLN.`);loadPayments();
}

async function loadGoals(){
  if(!session){location.hash='#auth';return;}try{const p=await requireProfile();if(!p)return;const {data:g}=await supabase.from('stream_goals').select('id,title,target_grosz').eq('profile_id',p.id).eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();$('goalInputTitle').value=g?.title||'Rozwój kanału';$('goalInputAmount').value=g?String(Number(g.target_grosz)/100):'5000';$('saveGoalBtn').dataset.goalId=g?.id||'';}catch(e){setStatus('goalStatus',e.message,true);}
}
async function saveGoal(){
  try{const p=await requireProfile();if(!p)return;const title=$('goalInputTitle').value.trim().slice(0,120);const amount=Number($('goalInputAmount').value);if(amount<50)throw new Error('Cel musi wynosić co najmniej 50 PLN.');const id=$('saveGoalBtn').dataset.goalId;const payload={profile_id:p.id,title,target_grosz:Math.round(amount*100),active:true};const {error}=id?await supabase.from('stream_goals').update(payload).eq('id',id):await supabase.from('stream_goals').insert(payload);if(error)throw error;setStatus('goalStatus','Cel zapisany.');loadGoals();}catch(e){setStatus('goalStatus',e.message,true);}
}

async function loadIntegrations(){
  if(!session){location.hash='#auth';return;}try{const p=await requireProfile();if(!p)return;const {data:i,error}=await supabase.from('stream_integrations').select('id,provider,enabled').eq('profile_id',p.id).order('provider');if(error)throw error;const labels={twitch:'Twitch',youtube:'YouTube',tiktok:'TikTok',discord:'Discord',obs:'OBS',webhook:'Webhook'};$('integrationList').innerHTML=(i||[]).map(x=>`<button class="integrationRow ${x.enabled?'on':''}" data-integration="${x.id}" data-enabled="${x.enabled}"><div><b>${labels[x.provider]||escapeHtml(x.provider)}</b><small>${x.enabled?'WŁ.':'WYŁ.'}</small></div><span>50 PLN nie dotyczy integracji</span></button>`).join('');all('[data-integration]').forEach(btn=>btn.addEventListener('click',()=>toggleIntegration(btn)));}catch(e){console.error(e);}
}
async function toggleIntegration(btn){const enabled=btn.dataset.enabled==='true';const {error}=await supabase.from('stream_integrations').update({enabled:!enabled}).eq('id',btn.dataset.integration);if(!error)loadIntegrations();}

async function loadSettings(){
  if(!session){location.hash='#auth';return;}try{const p=await requireProfile();if(!p)return;$('settingsName').value=p.display_name||'';$('settingsUsername').value=p.username||'';$('settingsBio').value=p.bio||'';$('settingsPublic').checked=!!p.page_enabled;$('settingsVoice').checked=!!p.voice_enabled;}catch(e){setStatus('settingsStatus',e.message,true);}
}
async function saveSettings(){
  try{const p=await requireProfile();if(!p)return;const username=$('settingsUsername').value.toLowerCase().trim().replace(/[^a-z0-9_-]/g,'-').slice(0,32);if(username.length<3)throw new Error('Adres musi mieć co najmniej 3 znaki.');const payload={display_name:$('settingsName').value.trim().slice(0,100),username,bio:$('settingsBio').value.slice(0,500),page_enabled:$('settingsPublic').checked,voice_enabled:$('settingsVoice').checked,min_amount_grosz:5000,voice_min_amount_grosz:5000};const {data,error}=await supabase.from('stream_profiles').update(payload).eq('id',p.id).select().single();if(error)throw error;profile=data;setStatus('settingsStatus','Profil zapisany. Minimum pozostaje 50 PLN.');}catch(e){setStatus('settingsStatus',e.message,true);}
}

async function createTestDonation(){
  setStatus('testStatus','Wysyłam test…');const {data,error}=await supabase.functions.invoke('stream-test-donation',{body:{name:'Testowy widz',amount_grosz:10000,message:'Testowa wpłata z publicznego panelu DS 💜'}});if(error){setStatus('testStatus',error.message,true);return;}setStatus('testStatus',`Gotowe: ${money(data.amount_grosz)}. Alert OBS powinien pojawić się od razu.`);loadDashboard();
}

function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

$('loginNav').addEventListener('click',()=>{setAuthMode('login');location.hash='#auth';});
$('registerNav').addEventListener('click',()=>{setAuthMode('register');location.hash='#auth';});
$('logoutNav').addEventListener('click',async()=>{await supabase.auth.signOut();session=null;profile=null;refreshNav();location.hash='#home';});
$('tabLogin').addEventListener('click',()=>setAuthMode('login'));
$('tabRegister').addEventListener('click',()=>setAuthMode('register'));
$('authForm').addEventListener('submit',async(e)=>{e.preventDefault();setStatus('authStatus','Przetwarzam…');const email=$('authEmail').value.trim();const password=$('authPassword').value;try{if(password.length<8)throw new Error('Hasło musi mieć minimum 8 znaków.');if(authMode==='register'){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:$('authName').value.trim()}}});if(error)throw error;session=data.session;refreshNav();setStatus('authStatus',data.session?'Konto utworzone. Otwieram panel…':'Konto utworzone. Sprawdź e-mail, jeśli wymagane jest potwierdzenie.');if(data.session)setTimeout(()=>location.hash='#dashboard',500);}else{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;session=data.session;profile=null;refreshNav();location.hash='#dashboard';}}catch(err){setStatus('authStatus',err.message,true);}});
$('testDonationBtn').addEventListener('click',createTestDonation);
$('saveGoalBtn').addEventListener('click',saveGoal);
$('saveSettingsBtn').addEventListener('click',saveSettings);
all('[data-amount]').forEach(btn=>btn.addEventListener('click',()=>{$('donationAmount').value=btn.dataset.amount;}));
all('.method.unavailable').forEach(btn=>btn.addEventListener('click',()=>alert('Ta metoda ma próg 50 PLN, ale wymaga podłączenia odpowiedniego operatora/API.')));

window.addEventListener('hashchange',()=>showRoute(currentRoute()));
await initAuth();
showRoute(currentRoute());
