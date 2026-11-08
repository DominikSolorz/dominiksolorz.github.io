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
  for(const [width,height] of [[390,844],[320,568],[844,390],[1280,900]]){
   const page=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000,serviceWorkers:'block',userAgent:width>=1000?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   if(!process.env.HS_REAL_MOBILE_LIVE)await page.route('https://dominiksolorz.github.io/kamera/**',route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname.slice('/kamera/'.length))||'index.html';
    const file=path.join(root,'kamera',relative);return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Missing asset'});
   });
   await page.route('https://*.supabase.co/**',route=>{
    const pathname=new URL(route.request().url()).pathname;
    const reply=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    if(pathname.endsWith('/token'))return reply({access_token:token,refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});
    if(pathname.endsWith('/user'))return reply(user);
    if(pathname.includes('user_profiles'))return reply({user_id:user.id,first_name:'Test',last_name:'Mobile',address_line:'Test',postal_code:'00-001',privacy_accepted_at:'yes',terms_accepted_at:'yes'});
    if(pathname.includes('user_security'))return reply(security);
    if(pathname.includes('user_access_roles'))return reply({role:'owner'});
    return reply([]);
   });
   await page.routeWebSocket('**/realtime/**',socket=>socket.close());
   const shot=async name=>{if(artifacts&&width===390)await page.screenshot({path:path.join(artifacts,name+'.png'),fullPage:true});};
   if(width===390)await page.clock.install();
   const entry='https://dominiksolorz.github.io/kamera/?hs_release=273'+(width>=1000?'&layout=manual&ui=phone':'&layout=auto');
   await page.goto(entry,{waitUntil:'networkidle'});
   if(width===390){
    await page.clock.runFor(10000);
    assert.equal(await page.locator('.hsMobileSplashImage').nth(1).getAttribute('aria-hidden'),'false');
    await page.clock.runFor(10000);
    assert.equal(await page.locator('.hsMobileSplashImage').nth(2).getAttribute('aria-hidden'),'false');
    await page.clock.runFor(10500);
    assert.equal(await page.locator('#hsMobileSplash').isVisible(),false);
   }else await page.locator('#hsMobileSplash button').click();
   assert.equal(await page.locator('#mobileWelcome').isVisible(),true);
   await shot('01-real-home');
   await page.locator('#mobileWelcome .mobileWelcomeLogin').click();
   await page.locator('#loginForm input[name=email]').fill(user.email);
   await page.locator('#loginForm input[name=password]').fill('fixture-password');
   await shot('02-real-login');
   await page.locator('#loginForm button[type=submit]').click();
   await page.locator('#lock').waitFor({state:'visible'});
   assert.equal(await page.locator('#app').isVisible(),false,'Application must remain hidden before PIN');
   await shot('03-real-pin');
   for(const digit of '0000')await page.locator('#lock [data-k="'+digit+'"]').click();
   await page.locator('#lock [data-k=ok]').click();
   await page.locator('#lock .pinMsg').filter({hasText:'Zły PIN'}).waitFor();
   assert.equal(await page.locator('#app').isVisible(),false,'Wrong PIN must not open the new layout');
   for(const digit of '1234')await page.locator('#lock [data-k="'+digit+'"]').click();
   await page.locator('#lock [data-k=ok]').click();
   await page.locator('#app').waitFor({state:'visible'});
   await page.locator('#mobileOverview').waitFor({state:'visible'});
   assert.equal(await page.locator('.mobileOverviewActions button').count(),7);
   assert.equal(await page.locator('.mobileOverviewActions').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
   assert.equal(await page.locator('.mobileBottomNav').count(),0);
   assert.equal(await page.locator('.mobileAppHeader #deviceLayoutBtn').count(),0);
   const brand=await page.locator('.mobileBrandName').boundingBox(),menu=await page.locator('#mobileMenuBtn').boundingBox();
   assert.ok(brand.x+brand.width+8<=menu.x,'Brand and menu must have separate space');
   const originalVideo=await page.locator('#video').evaluateHandle(el=>el);
   await shot('04-real-dashboard');
   for(const view of ['camera','recordings','settings','cloud']){
    await page.locator('#mobileOverview [data-open-mobile-view="'+view+'"]').click();
    assert.equal(await page.locator('body').getAttribute('data-mobile-view'),view);
    assert.equal(await page.locator('#mobileOverview').isVisible(),false);
    assert.equal(await originalVideo.evaluate(node=>node===document.getElementById('video')),true,'Navigation must preserve the real video element');
    if(view==='settings'){
     assert.equal(await page.locator('#mobileSettingsHome .mobileSettingCategories > *').count(),7);
     await page.locator('#mobileSettingsHome [data-setting-section="image"]').click();
     await page.locator('.mobileMediaTabs [data-setting-section="sound"]').click();
     assert.equal(await page.locator('body').getAttribute('data-mobile-settings'),'sound');
     await page.locator('.mobileSettingsBack').click();
    }
    if(view==='cloud')assert.equal(await page.locator('#dvrCard').isVisible(),false,'Cloud must not include the player');
    if(view==='recordings')assert.equal(await page.locator('#mobileRecordingStorage').isVisible(),false,'Archive must not include storage settings');
    await shot('05-real-'+view);
    await page.locator('#mobileBackHome').click();
   }
   await page.locator('#mobileMenuBtn').click();
   assert.equal(await page.locator('#mobileMenuPage').isVisible(),true);
   assert.equal(await page.locator('#mobileOverview').isVisible(),false,'Menu replaces dashboard instead of overlaying it');
   await shot('06-menu');
   for(const view of ['appearance','updates','playback']){
    await page.locator('#mobileMenuPage [data-open-mobile-view="'+view+'"]').click();
    assert.equal(await page.locator('body').getAttribute('data-mobile-view'),view);
    assert.equal(await page.locator('#mobileMenuPage').isVisible(),false);
    assert.equal(await page.locator('#mobileOverview').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Function page must not overflow the phone');
    await shot('07-'+view);
    await page.locator('#mobileBackHome').click();
    await page.locator('#mobileMenuBtn').click();
   }
   await page.locator('#mobileMenuBtn').click();
   assert.equal(await page.locator('#mobileOverview').isVisible(),true);
   await page.locator('[data-open-mobile-profile]').click();
   await page.locator('.accountDialog').waitFor({state:'visible'});
   assert.deepEqual(errors,[]);
   console.log(`PASS ${width}x${height}: real home/login, wrong and correct PIN, six tiles, separate menu/cloud/settings, no bottom navigation, profile and preserved video node`);
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
