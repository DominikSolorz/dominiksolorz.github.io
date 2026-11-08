// Real panel modules and PIN derivation; account responses use isolated fixtures.
// Set HS_REAL_MOBILE_LIVE=1 to verify the deployed UI without using a real account.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'mobile@example.invalid',email_confirmed_at:'2026-01-01T00:00:00Z',identities:[]};
const token=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'fixture'].join('.');
const salt='isolated-mobile-ui-fixture';
const key=crypto.pbkdf2Sync('1234',salt,150000,32,'sha256').toString('base64');
const security={pin_salt:salt,pin_hash:crypto.createHash('sha256').update(key).digest('hex'),failed_attempts:0,locked_until:null,pin_wrapped_access_key:null};
const artifacts=process.env.HS_MOBILE_PROOF;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 if(artifacts)fs.mkdirSync(artifacts,{recursive:true});
 try{
  for(const [width,height] of [[1280,900]]){
   const page=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,serviceWorkers:'block',userAgent:width>=1000?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
   let exchangeBody;
   await page.addInitScript(()=>{
    const listeners=new Set();
    window.__HOME_SECURITY_ACCOUNT_OAUTH__=true;
    window.chrome=window.chrome||{};
    window.chrome.webview={addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn);},removeEventListener:(type,fn)=>listeners.delete(fn),postMessage:data=>{
     if(data.type==='desktop.auth.google'){
      window.__testGoogleRequest=data;
      setTimeout(()=>{for(const fn of listeners)fn({data:{type:'desktop.auth.google.result',id:data.id,code:'fixture-google-code'}});},30);
     }
    }};
   });
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   if(!process.env.HS_REAL_MOBILE_LIVE)await page.route('https://dominiksolorz.github.io/kamera/**',route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice('/kamera/'.length))||'index.html';
    const file=path.join(root,'kamera',relative);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Missing asset'});
   });
   await page.route('https://*.supabase.co/**',route=>{
    const pathname=new URL(route.request().url()).pathname;
    const reply=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(pathname.endsWith('/token')){exchangeBody=route.request().postDataJSON();return reply({access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});}
    if(pathname.endsWith('/user'))return reply(user);
    if(pathname.includes('user_profiles'))return reply({user_id:user.id,first_name:'Test',last_name:'Mobile',address_line:'Test',postal_code:'00-001',privacy_accepted_at:'yes',terms_accepted_at:'yes'});
    if(pathname.includes('user_security'))return reply(security);
    if(pathname.includes('user_access_roles'))return reply({role:'owner'});
    return reply([]);
   });
   await page.routeWebSocket('**/realtime/**',socket=>socket.close());
   const shot=async name=>{if(artifacts&&width===390)await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true});};
   if(width===390)await page.clock.install();
   await page.goto('https://dominiksolorz.github.io/kamera/?auth=login&desktop=1',{waitUntil:'networkidle'});
   await page.locator('#googleLoginBtn').click();
   await page.locator('#lock').waitFor({state:'visible'});
   assert.equal(await page.locator('#app').isVisible(),false,'Google login must still require PIN');
   const request=await page.evaluate(()=>window.__testGoogleRequest);
   const authorization=new URL(request.url);
   assert.equal(authorization.searchParams.get('code_challenge_method').toLowerCase(),'s256');
   assert.equal(authorization.searchParams.get('redirect_to'),'https://dominiksolorz.github.io/kamera/');
   assert.equal(exchangeBody.auth_code,'fixture-google-code');
   assert.ok(exchangeBody.code_verifier.length>=43,'SDK must use the original PKCE verifier in the WebView');
   assert.equal(page.url().includes('dominiksolorz.github.io/kamera/'),true);
   assert.deepEqual(errors,[]);
   console.log('PASS native Google bridge: actual Supabase PKCE URL, matching flow verifier exchange, PIN remains locked');
   await page.close();
  }
  // Actual browser bootstrap -> Supabase redirect -> root callback -> loopback.
  const page=await browser.newPage({serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://dominiksolorz.github.io/kamera/**',route=>{
   const relative=new URL(route.request().url()).pathname.slice('/kamera/'.length)||'index.html';
   const file=path.join(root,'kamera',relative);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Missing asset'});
  });
  await page.route('https://*.supabase.co/auth/v1/authorize**',route=>route.fulfill({status:302,headers:{location:'https://dominiksolorz.github.io/kamera/?code=browser-handoff-code'},body:''}));
  let callback;
  await page.route('http://127.0.0.1:49152/**',route=>{callback=new URL(route.request().url());return route.fulfill({body:'Return to HOME SECURITY'});});
  const authorize=new URL('https://ksacbcrzuwdahnmggfxg.supabase.co/auth/v1/authorize');
  for(const [k,v] of Object.entries({provider:'google',redirect_to:'https://dominiksolorz.github.io/kamera/',code_challenge:'N'.repeat(43),code_challenge_method:'s256'}))authorize.searchParams.set(k,v);
  const payload=Buffer.from(JSON.stringify({url:authorize.href,nonce:'N'.repeat(43),port:49152})).toString('base64url');
  await page.goto('https://dominiksolorz.github.io/kamera/desktop-auth.html#'+payload);
  await page.waitForURL('http://127.0.0.1:49152/**');
  assert.equal(callback.searchParams.get('code'),'browser-handoff-code');
  assert.equal(callback.searchParams.get('state'),'N'.repeat(43));
  assert.deepEqual(errors,[]);
  console.log('PASS system-browser bootstrap: provider redirect -> root callback -> one-use loopback code, before panel initialization');
  await page.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
