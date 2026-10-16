const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../kamera/auth.js"), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
const storage = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) }; };
function harness() {
  const state = { security: { pin_hash: "existing" }, opened: 0, url: "", updated: null, user: { id: "user-a" }, oauth: null, oauthError: null, consent: true };
  const steps = ["login", "profile", "device", "pin"].map(step => ({ hidden: true, dataset: { authStep: step } }));
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { value: "", hidden: true, disabled: false, textContent: "", classList: { toggle() {}, remove() {} }, handlers: {}, addEventListener(type,fn) { this.handlers[type] = fn; }, querySelector() { return node("submit"); } });
    if (id === "profileForm") for (const field of ["first_name","last_name","address_line","postal_code","phone","terms"]) nodes.get(id)[field] = node(`profile-${field}`);
    return nodes.get(id);
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: state.user } }), signInWithOAuth: async args => {state.oauth = args; return {error:state.oauthError};}, onAuthStateChange: fn => { state.authCallback = fn; } },
    from: table => ({
      select() { return this; }, update(data) { state.updated = data; return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: table === "user_profiles" ? { first_name: "A", last_name: "B", address_line: "X", postal_code: "00-000", preferred_device: "desktop", privacy_accepted_at: state.consent ? "2026-10-16" : null, terms_accepted_at: state.consent ? "2026-10-16" : null } : state.security }),
      then(resolve) { return Promise.resolve({ error: null }).then(resolve); }
    })
  };
  const context = vm.createContext({
    window: { supabase: { createClient: () => client }, __openSecurePanel: () => state.opened++, addEventListener() {} },
    document: { getElementById: node, querySelectorAll: selector => selector === "[data-auth-step]" ? steps : [] },
    location: { origin:"https://example.test", pathname:"/kamera/", hash: "", search: "", href: "https://example.test/kamera/?view=desktop&auth=login", replace: url => { state.url = url; } },
    sessionStorage: storage(), localStorage: storage(), URL, URLSearchParams, Date,
    SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", setTimeout: fn => fn(), crypto: globalThis.crypto,
  });
  vm.runInContext(source, context);
  return { context, state, node, steps, run: code => vm.runInContext(code, context) };
}
(async () => {
  let h = harness();
  await h.run("continueWithSession()");
  assert.equal(h.steps.find(s => s.dataset.authStep === "device").hidden, false, "existing preferred device must not skip choice");
  assert.equal(h.state.opened, 0);
  await h.run("continueWithSession(true)");
  assert.equal(h.state.opened, 1, "existing PIN goes to mandatory lock, not PIN setup");
  h = harness(); h.state.security = null;
  await h.run("continueWithSession(true)");
  assert.equal(h.steps.find(s => s.dataset.authStep === "pin").hidden, false);
  assert.equal(h.state.opened, 0);
  for (const [device, platform, ui] of [["phone","iphone","phone"],["phone","android","phone"],["desktop","","computer"]]) {
    h = harness(); h.node("deviceValue").value = device; h.node("platformValue").value = platform;
    await h.node("deviceForm").handlers.submit({ preventDefault() {}, currentTarget: h.node("deviceForm") });
    assert.equal(new URL(h.state.url).searchParams.get("ui"), ui);
    assert.equal(new URL(h.state.url).searchParams.has("view"), false);
    assert.equal(h.run("takeDeviceEntry({id:'wrong-user'})"), false);
    assert.equal(h.state.opened, 0, "choice must not unlock panel");
  }
  h = harness(); h.node("deviceValue").value = "phone";
  await h.node("deviceForm").handlers.submit({ preventDefault() {}, currentTarget: h.node("deviceForm") });
  assert.equal(h.state.url, "", "phone requires platform");
  h.context.sessionStorage.setItem("hs-device-entry-v1", JSON.stringify({userId:"user-a",device:"phone",platform:"iphone",at:Date.now()}));
  assert.equal(h.run("takeDeviceEntry({id:'user-a'})"), true);
  assert.equal(h.run("takeDeviceEntry({id:'user-a'})"), false, "ticket must be single-use");
  h.context.sessionStorage.setItem("hs-device-entry-v1", JSON.stringify({userId:"user-a",device:"desktop",at:Date.now()-180000}));
  assert.equal(h.run("takeDeviceEntry({id:'user-a'})"), false, "expired ticket rejected");
  const html = fs.readFileSync(path.join(__dirname, "../kamera/index.html"), "utf8");
  const earlyMode = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [search, savedMode, native, userAgent, expected] of [
    ["?ui=phone", "computer", false, "iPhone", "mobileOwnerMode"],
    ["?ui=computer", "phone", false, "Windows", "desktopMode"],
    ["", "computer", false, "iPhone", "mobileOwnerMode"],
    ["", "phone", true, "Windows", "desktopMode"],
    ["?ui=phone", "computer", true, "Windows", "mobileOwnerMode"]
  ]) {
    const classes = new Set(), store = storage(); store.setItem("hs-ui-mode", savedMode);
    vm.runInNewContext(earlyMode, {
      location: { search, hash: "" }, URLSearchParams, localStorage: store,
      window: { __HOME_SECURITY_DESKTOP__: native }, navigator: { userAgent },
      matchMedia: query => ({ matches: query.includes("min-width") ? !userAgent.includes("iPhone") : userAgent.includes("iPhone") }),
      document: { documentElement: { classList: { add: name => classes.add(name) }, dataset: {} } }
    });
    assert.equal(classes.has(expected), true, search + " mode");
    assert.equal(classes.size, 1, "never mount both desktop and mobile");
  }
  h = harness();
  await h.node("googleLoginBtn").handlers.click();
  assert.equal(h.state.oauth.provider, "google");
  assert.equal(h.state.oauth.options.redirectTo, "https://example.test/kamera/");
  assert.equal(h.state.oauth.options.scopes, "openid email profile");
  assert.equal(h.state.opened, 0, "OAuth start must not bypass PIN");
  await h.node("googleLoginBtn").handlers.click();
  h = harness(); h.state.oauthError = {message:"Unsupported provider: provider is not enabled"};
  await h.node("googleLoginBtn").handlers.click();
  assert.equal(h.node("googleLoginBtn").disabled, false);
  assert.match(h.node("authMessage").textContent, /nie jest jeszcze włączone/);
  h = harness(); h.context.window.chrome = {webview:{}};
  await h.node("googleLoginBtn").handlers.click();
  assert.equal(h.state.oauth, null, "never send Google OAuth into embedded WebView2");
  h = harness(); h.state.user = {id:"user-a", identities:[{provider:"google"}]};
  await assert.rejects(h.run("currentAccountUser()"), /nie został potwierdzony/);
  h.state.user.email_confirmed_at = "2026-10-16T10:00:00Z";
  assert.equal((await h.run("currentAccountUser()")).id, "user-a");
  h = harness(); h.state.consent = false;
  await h.run("continueWithSession(true)");
  assert.equal(h.steps.find(s => s.dataset.authStep === "profile").hidden, false);
  assert.equal(h.node("profileForm").first_name.value, "A", "existing profile is retained");
  assert.equal(h.state.opened, 0, "missing consent cannot enter panel");
  assert.match(h.node("authMessage").textContent, /brakuje jedynie akceptacji/);
  assert.equal(h.node("profileForm").terms.checked, undefined, "never accept terms automatically");
  await h.node("profileForm").handlers.submit({preventDefault(){},currentTarget:h.node("profileForm")});
  assert.match(h.node("authMessage").textContent, /Zaakceptuj/);
  console.log("PASS: device/PIN routing and Google OAuth scopes, errors, embedded-browser guard, verified identity.");
})().catch(error => { console.error(error); process.exitCode = 1; });
