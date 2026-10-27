// HOME SECURITY public pages update automatically, without a misleading Update button.
// Do not interrupt a partially filled contact form or an open modal.
const buildMeta=document.querySelector('meta[name="home-security-build"]');
if(document.body?.classList.contains('marketingPage')&&buildMeta?.content){
  const currentBuild=Number(buildMeta.content);
  let checking=false,dirty=false;
  const versionURL=new URL('./version.json',import.meta.url);
  document.addEventListener('input',event=>{
    if(event.target?.matches?.('input,textarea,select,[contenteditable]'))dirty=true;
  },{capture:true});
  document.addEventListener('change',event=>{
    if(event.target?.matches?.('input,textarea,select,[contenteditable]'))dirty=true;
  },{capture:true});
  const safeToReload=()=>document.visibilityState==='visible'&&!dirty
    &&!document.querySelector('dialog[open],input:focus,textarea:focus,select:focus,[contenteditable]:focus');
  const check=async()=>{
    if(checking||!Number.isSafeInteger(currentBuild)||currentBuild<1)return;
    checking=true;
    try{
      const response=await fetch(versionURL,{cache:'no-store'});
      if(!response.ok)return;
      const latest=Number((await response.json()).version);
      if(!Number.isSafeInteger(latest)||latest<=currentBuild||!safeToReload())return;
      // Avoid repeatedly reloading an obsolete CDN response.
      const marker='hs-marketing-reload-'+currentBuild;
      let last=0;
      try{last=Number(sessionStorage.getItem(marker)||0);}catch{}
      if(Date.now()-last<90000)return;
      try{sessionStorage.setItem(marker,String(Date.now()));}catch{}
      window.location.reload();
    }catch{/* Offline or restricted browser: keep the existing page usable. */}
    finally{checking=false;}
  };
  // Visible, idle public pages refresh as soon as a newer published build is found.
  if(document.readyState==='complete')void check();
  else window.addEventListener('load',()=>void check(),{once:true});
  window.addEventListener('focus',()=>void check());
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')void check();
  });
  const interval=setInterval(()=>{if(document.visibilityState==='visible')void check();},2*60000);
  window.addEventListener('pagehide',event=>{if(!event.persisted)clearInterval(interval);});
}
