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
const callbackUrl = () => `${location.origin}${location.pathname}?auth=confirmed`;
const postCode = value => /^\d{2}-\d{3}$/.test(value);
let pendingConfirmationEmail = "";

function explainAuthError(error) {
  const raw = String(error?.message || error?.error_description || error || "Nieznany błąd logowania.");
  const text = raw.toLowerCase();
  if (text.includes("invalid login credentials")) return "Nieprawidłowy e-mail lub hasło.";
  if (text.includes("email not confirmed")) return "Konto nie zostało jeszcze potwierdzone. Otwórz link wysłany e-mailem.";
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
  const { data: { user } } = await accountClient.auth.getUser();
  return user || null;
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

async function continueWithSession() {
  const user = await currentAccountUser();
  if (!user) { section("login"); return; }
  const profile = await profileFor(user);
  if (!profile || !profile.first_name || !profile.last_name || !profile.address_line || !profile.postal_code) {
    const form = $("profileForm"); const meta = user.user_metadata || {};
    form.first_name.value = profile?.first_name || meta.first_name || ""; form.last_name.value = profile?.last_name || meta.last_name || "";
    form.address_line.value = profile?.address_line || meta.address_line || ""; form.postal_code.value = profile?.postal_code || meta.postal_code || ""; form.phone.value = profile?.phone || meta.phone || "";
    section("profile"); return;
  }
  const security = await securityForCurrentUser();
  if (!profile.preferred_device) { section("device"); return; }
  if (!security) { section("pin"); return; }
  enterPanel();
}

window.__ensureAccountReady = async () => { await continueWithSession(); return currentAccountUser(); };
window.__showAccount = async () => { $("authDialog").hidden = false; message(""); await continueWithSession(); };

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
$("profileForm")?.addEventListener("submit", async event => { event.preventDefault(); try { await saveProfile(event.currentTarget); section("device"); } catch (error) { message(error.message, true); } });
document.querySelectorAll("[data-device]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-device]").forEach(item => item.classList.toggle("selected", item === button)); $("deviceValue").value = button.dataset.device; $("platformChoices").hidden = button.dataset.device !== "phone"; }));
document.querySelectorAll("[data-platform]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-platform]").forEach(item => item.classList.toggle("selected", item === button)); $("platformValue").value = button.dataset.platform; }));
$("deviceForm")?.addEventListener("submit", async event => { event.preventDefault(); const device = $("deviceValue").value, platform = $("platformValue").value; if (!device || (device === "phone" && !platform)) return message("Wybierz urządzenie, a przy telefonie także Android albo iPhone.", true); try { await saveDevice(device, platform); section("pin"); } catch (error) { message(error.message, true); } });
$("pinSetupForm")?.addEventListener("submit", async event => { event.preventDefault(); const pin = $("setupPin").value, repeat = $("setupPinRepeat").value; if (!/^\d{4}$|^\d{6}$/.test(pin)) return message("PIN musi mieć dokładnie 4 albo 6 cyfr.", true); if (pin !== repeat) return message("Numery PIN nie są identyczne.", true); try { await savePin(pin); message("PIN zapisany. Otwieram bezpieczny panel…"); setTimeout(enterPanel, 280); } catch (error) { message(error.message, true); } });

accountClient.auth.onAuthStateChange((event) => { if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && new URLSearchParams(location.search).get("auth") === "confirmed") { $("authDialog").hidden = false; setTimeout(() => continueWithSession().catch(error => message(error.message, true)), 0); } });
// Sygnalizuje stronie głównej, że kliknięcie „Zaloguj się” może już otworzyć okno.
window.__authReadyResolve?.();
