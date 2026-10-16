import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js?v=34";
import { deriveKey, b64 } from "./pin.js?v=14";

const { createClient } = window.supabase;
export const accountClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "home-security-account-v1" },
});

const $ = id => document.getElementById(id);
const clean = value => String(value || "").trim();
const message = (text, bad = false) => { const el = $("authMessage"); el.textContent = text || ""; el.classList.toggle("bad", !!bad); };
const section = name => document.querySelectorAll("[data-auth-step]").forEach(el => { el.hidden = el.dataset.authStep !== name; });
// Zostawiamy adres bez parametrów. Jest zgodny z dozwolonym adresem strony
// w Supabase, a po potwierdzeniu zdarzenie SIGNED_IN otworzy konfigurację.
const callbackUrl = () => `${location.origin}${location.pathname}`;
const postCode = value => /^\d{2}-\d{3}$/.test(value);
let pendingConfirmationEmail = "";
const ENTRY_TICKET = "hs-device-entry-v1";
let returnedWithEmailToken = location.hash.includes("access_token");
let continuing = false;
let googleLoginPending = false;

async function signInWithGoogle() {
  if (googleLoginPending) return;
  // Google blocks embedded user agents. Never navigate WebView2 to Google login.
  if (window.chrome?.webview) {
    message("Logowanie Google otwórz w Chrome lub Edge. W programie Windows możesz nadal użyć e-maila i hasła. Bezpieczne przekazanie sesji do programu wymaga osobnego mostka.", true);
    return;
  }
  googleLoginPending = true;
  const button = $("googleLoginBtn");
  if (button) button.disabled = true;
  message("Przekierowuję do Google. Po potwierdzeniu konta nadal wymagany będzie PIN.");
  try {
    const { error } = await accountClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(), scopes: "openid email profile", queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
  } catch (error) {
    message(explainAuthError(error), true);
    googleLoginPending = false;
    if (button) button.disabled = false;
  }
}

$("googleLoginBtn")?.addEventListener("click", signInWithGoogle);
function takeDeviceEntry(user) {
  let ticket = null;
  try { ticket = JSON.parse(sessionStorage.getItem(ENTRY_TICKET) || "null"); sessionStorage.removeItem(ENTRY_TICKET); } catch (_) {}
  return !!ticket && ticket.userId === user.id && Date.now() - ticket.at >= 0 && Date.now() - ticket.at < 120000
    && ["desktop", "phone"].includes(ticket.device)
    && (ticket.device !== "phone" || ["iphone", "android"].includes(ticket.platform));
}

function explainAuthError(error) {
  const raw = String(error?.message || error?.error_description || error || "Nieznany błąd logowania.");
  const text = raw.toLowerCase();
  if (text.includes("invalid login credentials")) return "Nieprawidłowy e-mail lub hasło.";
  if (text.includes("email not confirmed")) return "Konto nie zostało jeszcze potwierdzone. Otwórz link wysłany e-mailem.";
  if (text.includes("provider is not enabled") || text.includes("unsupported provider")) return "Logowanie Google nie jest jeszcze włączone w konfiguracji kont HOME SECURITY. Użyj e-maila i hasła.";
  if (text.includes("access_denied")) return "Logowanie Google zostało anulowane albo dostęp nie został przyznany. Spróbuj ponownie lub użyj e-maila i hasła.";
  if (text.includes("redirect") || text.includes("redirect_to")) return "Link potwierdzający wymaga konfiguracji adresu powrotu. Konto nie zostało jeszcze utworzone.";
  if (text.includes("already registered") || text.includes("already been registered")) return "Ten adres ma już konto. Zaloguj się albo użyj odzyskiwania hasła.";
  if (text.includes("network") || text.includes("fetch")) return "Nie udało się połączyć z usługą kont. Sprawdź internet i spróbuj ponownie.";
  return `Nie udało się wykonać operacji: ${raw}`;
}

async function hashText(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function randomSalt() { const bytes = crypto.getRandomValues(new Uint8Array(24)); return b64(bytes); }

export async function currentAccountUser() {
  const { data: { user }, error } = await accountClient.auth.getUser();
  if (error) throw error;
  // Server-confirmed user, not user-editable metadata or the browser's token text.
  const googleIdentity = user?.identities?.some(identity => identity.provider === "google");
  if (googleIdentity && !user.email_confirmed_at) throw new Error("Adres e-mail konta Google nie został potwierdzony przez usługę logowania.");
  return user || null;
}
export async function accessRoleForCurrentUser() {
  const user = await currentAccountUser();
  if (!user) return null;
  const { data, error } = await accountClient.from("user_access_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data?.role || "viewer";
}
export async function securityForCurrentUser() {
  const user = await currentAccountUser();
  if (!user) return null;
  const { data, error } = await accountClient.from("user_security").select("pin_salt,pin_hash,failed_attempts,locked_until").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function verifyAccountPin(pin) {
  const security = await securityForCurrentUser();
  if (!security || !/^\d{4,6}$/.test(String(pin))) return null;
  if (security.locked_until && new Date(security.locked_until).getTime() > Date.now()) return null;
  const key = await deriveKey(String(pin), security.pin_salt);
  return (await hashText(key)) === security.pin_hash ? key : null;
}

async function savePin(pin) {
  const user = await currentAccountUser();
  if (!user) throw new Error("Sesja logowania wygasła. Zaloguj się ponownie.");
  const salt = randomSalt();
  const key = await deriveKey(pin, salt);
  const { error } = await accountClient.from("user_security").upsert({ user_id: user.id, pin_salt: salt, pin_hash: await hashText(key), pin_updated_at: new Date().toISOString(), failed_attempts: 0, locked_until: null });
  if (error) throw error;
}
async function profileFor(user) {
  const { data, error } = await accountClient.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data || null;
}
async function saveProfile(form) {
  const user = await currentAccountUser();
  if (!user) throw new Error("Sesja logowania wygasła.");
  const first = clean(form.first_name.value), last = clean(form.last_name.value), address = clean(form.address_line.value), code = clean(form.postal_code.value), phone = clean(form.phone.value);
  if (!first || !last || !address || !postCode(code)) throw new Error("Uzupełnij imię, nazwisko, adres i kod w formacie 00-000.");
  const { error } = await accountClient.from("user_profiles").upsert({ user_id: user.id, display_name: `${first} ${last}`.slice(0, 80), first_name: first, last_name: last, address_line: address, postal_code: code, phone: phone || null, privacy_accepted_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  if (error) throw error;
}
async function saveDevice(device, platform) {
  const user = await currentAccountUser();
  const { error } = await accountClient.from("user_profiles").update({ preferred_device: device, phone_platform: platform || null, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) throw error;
}
function enterPanel() { $("authDialog").hidden = true; window.__openSecurePanel?.(); }

async function continueWithSession(deviceChosen = false) {
  if (continuing) return;
  continuing = true;
  try {
  const user = await currentAccountUser();
  if (!user) { section("login"); return; }
  const profile = await profileFor(user);
  const missingProfile = !profile || !profile.first_name || !profile.last_name || !profile.address_line || !profile.postal_code;
  const missingConsent = !profile?.privacy_accepted_at || !profile?.terms_accepted_at;
  if (missingProfile || missingConsent) {
    const form = $("profileForm"); const meta = user.user_metadata || {};
    form.first_name.value = profile?.first_name || meta.first_name || ""; form.last_name.value = profile?.last_name || meta.last_name || "";
    form.address_line.value = profile?.address_line || meta.address_line || ""; form.postal_code.value = profile?.postal_code || meta.postal_code || ""; form.phone.value = profile?.phone || meta.phone || "";
    section("profile");
    message(missingProfile
      ? "Konto zostało potwierdzone. Uzupełnij dane profilu i zaakceptuj dokumenty, aby przejść do wyboru urządzenia i PIN-u."
      : "Logowanie powiodło się. Dane profilu są już zapisane; brakuje jedynie akceptacji Regulaminu i Polityki prywatności. Przeczytaj dokumenty, zaznacz zgodę i kliknij Dalej. Twój dotychczasowy PIN pozostaje bez zmian.");
    return;
  }
  const security = await securityForCurrentUser();
  // Wybór dotyczy bieżącego urządzenia, nie ostatniego urządzenia konta.
  if (!deviceChosen) { section("device"); message(""); return; }
  if (!security?.pin_hash) { section("pin"); message(""); return; }
  enterPanel();
  } finally { continuing = false; }
}

window.__ensureAccountReady = async () => {
  const user = await currentAccountUser();
  if (!user) throw new Error("Sesja konta wygasła. Zaloguj się ponownie.");
  return user;
};
window.__showAccount = async () => { $("authDialog").hidden = false; message(""); await continueWithSession(); };
// Osobny adres ?auth=register otwiera formularz niezależnie od skryptów strony głównej.
// Pozwala to wkleić link bezpośrednio w przeglądarce lub aplikacji Windows.
window.__showRegistration = async () => { $("authDialog").hidden = false; message(""); section("register"); };

window.addEventListener("hs-auth-request", () => window.__showAccount());

$("authClose")?.addEventListener("click", () => { $("authDialog").hidden = true; });
$("authToRegister")?.addEventListener("click", () => { message(""); section("register"); });
document.querySelectorAll(".authToLogin").forEach(button => button.addEventListener("click", () => { message(""); section("login"); }));
$("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget; message("Sprawdzam dane logowania…");
  try {
    const { error } = await accountClient.auth.signInWithPassword({ email: clean(form.email.value), password: form.password.value });
    if (error) return message(explainAuthError(error), true);
    await continueWithSession();
  } catch (error) { message(explainAuthError(error), true); }
});
$("registerForm")?.addEventListener("submit", async event => {
  event.preventDefault(); const form = event.currentTarget;
  const first = clean(form.first_name.value), last = clean(form.last_name.value), address = clean(form.address_line.value), code = clean(form.postal_code.value), phone = clean(form.phone.value), email = clean(form.email.value);
  if (!first || !last || !address || !postCode(code)) return message("Uzupełnij imię, nazwisko, adres i kod w formacie 00-000.", true);
  if (form.password.value.length < 10) return message("Hasło powinno mieć co najmniej 10 znaków.", true);
  if (form.password.value !== form.password_repeat.value) return message("Hasła nie są identyczne.", true);
  if (!form.terms.checked) return message("Zaakceptuj Regulamin i Politykę prywatności.", true);
  message("Tworzę konto i wysyłam link potwierdzający…");
  try {
    const { error } = await accountClient.auth.signUp({ email, password: form.password.value, options: { emailRedirectTo: callbackUrl(), data: { first_name: first, last_name: last, address_line: address, postal_code: code, phone } } });
    if (error) return message(explainAuthError(error), true);
    pendingConfirmationEmail = email;
    section("confirm");
  } catch (error) { message(explainAuthError(error), true); }
});
$("resendConfirmation")?.addEventListener("click", async () => {
  if (!pendingConfirmationEmail) return message("Wpisz adres e-mail w formularzu rejestracji, aby wysłać link ponownie.", true);
  message("Wysyłam nowy link potwierdzający…");
  try {
    const { error } = await accountClient.auth.resend({ type: "signup", email: pendingConfirmationEmail, options: { emailRedirectTo: callbackUrl() } });
    if (error) return message(explainAuthError(error), true);
    message("Nowy link został wysłany. Sprawdź skrzynkę oraz folder Spam.");
  } catch (error) { message(explainAuthError(error), true); }
});
$("verificationCodeForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const token = clean($("verificationCode")?.value);
  if (!/^\d{6,8}$/.test(token)) return message("Wpisz pełny kod z wiadomości e-mail (6–8 cyfr).", true);
  if (!pendingConfirmationEmail) return message("Wróć do rejestracji i wpisz adres e-mail, aby potwierdzić kod.", true);
  message("Potwierdzam kod…");
  try {
    const { error } = await accountClient.auth.verifyOtp({ email: pendingConfirmationEmail, token, type: "signup" });
    if (error) return message(explainAuthError(error), true);
    await continueWithSession();
  } catch (error) { message(explainAuthError(error), true); }
});
$("profileForm")?.addEventListener("submit", async event => { event.preventDefault(); if (!event.currentTarget.terms.checked) return message("Zaakceptuj Regulamin i Politykę prywatności.", true); try { await saveProfile(event.currentTarget); section("device"); } catch (error) { message(error.message, true); } });
document.querySelectorAll("[data-device]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-device]").forEach(item => { const active = item === button; item.classList.toggle("selected", active); item.setAttribute("aria-pressed", String(active)); });
  $("deviceValue").value = button.dataset.device;
  $("platformValue").value = "";
  document.querySelectorAll("[data-platform]").forEach(item => { item.classList.remove("selected"); item.setAttribute("aria-pressed", "false"); });
  $("platformChoices").hidden = button.dataset.device !== "phone";
  message("");
}));
document.querySelectorAll("[data-platform]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-platform]").forEach(item => { const active = item === button; item.classList.toggle("selected", active); item.setAttribute("aria-pressed", String(active)); }); $("platformValue").value = button.dataset.platform; }));
$("deviceForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const device = $("deviceValue").value, platform = $("platformValue").value;
  if (!["desktop", "phone"].includes(device) || (device === "phone" && !["iphone", "android"].includes(platform))) return message("Wybierz urządzenie, a przy telefonie także Android albo iPhone.", true);
  const submit = event.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  message("Przygotowuję wybrany panel…");
  try {
    const user = await currentAccountUser();
    if (!user) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    await saveDevice(device, device === "phone" ? platform : null);
    // Jednorazowe wznowienie po przeładowaniu nie przechowuje PIN-u ani uprawnień.
    sessionStorage.setItem(ENTRY_TICKET, JSON.stringify({ userId: user.id, device, platform, at: Date.now() }));
    localStorage.setItem("hs-ui-mode", device === "phone" ? "phone" : "computer");
    localStorage.setItem("hs-phone-platform", device === "phone" ? platform : "");
    const url = new URL(location.href);
    ["auth", "view", "desktop", "app", "wroc"].forEach(key => url.searchParams.delete(key));
    url.searchParams.set("ui", device === "phone" ? "phone" : "computer");
    url.hash = "";
    location.replace(url.toString());
  } catch (error) { submit.disabled = false; message(error.message, true); }
});
$("pinSetupForm")?.addEventListener("submit", async event => { event.preventDefault(); const pin = $("setupPin").value, repeat = $("setupPinRepeat").value; if (!/^\d{4}$|^\d{6}$/.test(pin)) return message("PIN musi mieć dokładnie 4 albo 6 cyfr.", true); if (pin !== repeat) return message("Numery PIN nie są identyczne.", true); try { await savePin(pin); message("PIN zapisany. Otwieram bezpieczny panel…"); setTimeout(enterPanel, 280); } catch (error) { message(error.message, true); } });

accountClient.auth.onAuthStateChange((event, session) => {
  const returnedFromEmail = event === "SIGNED_IN" && returnedWithEmailToken && !!session;
  let pendingEntry = false;
  try { pendingEntry = !!sessionStorage.getItem(ENTRY_TICKET); } catch (_) {}
  if (returnedFromEmail || (event === "INITIAL_SESSION" && (pendingEntry || new URLSearchParams(location.search).get("auth") === "confirmed"))) {
    returnedWithEmailToken = false;
    $("authDialog").hidden = false;
    setTimeout(async () => {
      try { const user = await currentAccountUser(); await continueWithSession(user ? takeDeviceEntry(user) : false); }
      catch (error) { message(error.message, true); }
    }, 0);
  }
});
// Sygnalizuje stronie głównej, że kliknięcie „Zaloguj się” może już otworzyć okno.
window.__authReadyResolve?.();
