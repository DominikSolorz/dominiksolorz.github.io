import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createStore } from "../kamera/core/store.mjs";
import { createRouter } from "../kamera/core/router.mjs";
import { CommandClient, CommandDispatcher } from "../kamera/communication/commands.mjs";
import { createPeerDiagnostics } from "../kamera/core/peer-diagnostics.mjs";
import { NativeAgentClient } from "../kamera/communication/native-agent-client.mjs";
import vm from "node:vm";

test("telemetry survives logs; freshness does not erase auth failure", () => {
  let time = 1;
  const store = createStore({ now: () => time, logLimit: 2 });
  store.component("cloud", { status: "auth_required" });
  for (let i = 0; i < 3; i++) store.event({ message: "info" });
  time = 50000;
  assert.equal(store.read("cloud").status, "auth_required");
  assert.equal(store.read("cloud").freshness, "stale");
  assert.equal(store.snapshot().events.length, 2);
  const copy = store.snapshot(); copy.components.cloud.status = "healthy";
  assert.equal(store.read("cloud").status, "auth_required");
  store.component("cloud", { status: "healthy" });
  assert.equal(store.read("cloud").status, "healthy");
});

test("observer failures do not affect other subscribers", () => {
  const store = createStore({ onError() {} }); let observed = false;
  store.subscribe(() => { throw new Error("UI failed"); });
  store.subscribe(() => { observed = true; });
  store.component("recording", { status: "recording" });
  assert.equal(observed, true);
  assert.equal(store.read("recording").status, "recording");
});

test("router preserves video identity and recording state", () => {
  const store = createStore(), video = { srcObject: {} }, stream = video.srcObject;
  store.component("recording", { status: "recording" });
  const router = createRouter({ routes: ["live", "settings", "archive", "alerts"], store,
    render(route) { video.hidden = route !== "live"; } });
  for (const route of ["settings", "archive", "alerts", "live"]) assert.equal(router.navigate(route), true);
  assert.equal(router.navigate("invalid"), false);
  assert.equal(video.srcObject, stream);
  assert.equal(store.read("recording").status, "recording");
});

test("client requires terminal confirmation, not send or accepted", async () => {
  let done = false;
  const client = new CommandClient({ send: async () => "ok", uuid: () => "a", timeoutMs: 100 });
  const pending = client.execute("recording.stop").then(result => { done = true; return result; });
  client.receive({ id: "a", status: "accepted" });
  await Promise.resolve();
  assert.equal(done, false);
  client.receive({ id: "wrong", status: "succeeded" });
  assert.equal(done, false);
  client.receive({ id: "a", status: "succeeded", result: { recording: false } });
  assert.equal((await pending).status, "succeeded");
  assert.equal(client.pending.size, 0);
});

test("timeout and connection loss mean unknown, never failed or success", async () => {
  const client = new CommandClient({ send: async () => {}, timeoutMs: 5 });
  assert.equal((await client.execute("start")).status, "unknown");
  const pending = client.execute("stop"); client.disconnect();
  assert.equal((await pending).code, "DISCONNECTED");
});

test("transport errors are contained", async () => {
  const client = new CommandClient({ send: async () => { throw new Error("network"); } });
  assert.equal((await client.execute("start")).code, "TRANSPORT_ERROR");
});

test("dispatcher deduplicates pending commands and rejects ID conflicts", async () => {
  let count = 0;
  const dispatcher = new CommandDispatcher({ handlers: { start: async () => { count++; return true; } } });
  const command = { v: 1, id: "a", name: "start", args: {}, expiresAt: Date.now() + 1000 };
  const [a, b] = await Promise.all([dispatcher.execute(command), dispatcher.execute(command)]);
  assert.equal(a.status, "succeeded"); assert.deepEqual(a, b); assert.equal(count, 1);
  assert.equal((await dispatcher.execute({ ...command, args: { changed: true } })).code, "ID_CONFLICT");
});

test("dispatcher serializes commands and validates expiry after queuing", async () => {
  let now = 10; const order = [];
  const dispatcher = new CommandDispatcher({ now: () => now, handlers: {
    first: async () => { order.push("first"); now = 30; },
    second: () => order.push("second")
  } });
  const first = dispatcher.execute({ v: 1, id: "a", name: "first", expiresAt: 20 });
  const second = dispatcher.execute({ v: 1, id: "b", name: "second", expiresAt: 20 });
  await first;
  assert.equal((await second).code, "EXPIRED");
  assert.deepEqual(order, ["first"]);
  assert.equal((await dispatcher.execute({ v: 1, id: "c", name: "unknown", expiresAt: 40 })).code, "UNKNOWN_COMMAND");
});

test("engine failure becomes terminal failed result", async () => {
  const dispatcher = new CommandDispatcher({ handlers: { start: () => { throw new Error("camera busy"); } } });
  const result = await dispatcher.execute({ v: 1, id: "a", name: "start", expiresAt: Date.now() + 1000 });
  assert.equal(result.status, "failed"); assert.equal(result.message, "camera busy");
});

test("ICE 701 does not change connected state; failure persists beyond logs", () => {
  class Peer extends EventTarget {
    connectionState = "connected"; iceConnectionState = "connected";
    async getStats() { return new Map(); }
  }
  const store = createStore(), diagnostics = createPeerDiagnostics({ store }), peer = new Peer();
  const dispose = diagnostics.attach(peer, "test");
  try {
    peer.dispatchEvent(Object.assign(new Event("icecandidateerror"), { errorCode: 701 }));
    assert.equal(diagnostics.snapshot().failed, false);
    peer.connectionState = "failed"; peer.dispatchEvent(new Event("connectionstatechange"));
    peer.dispatchEvent(Object.assign(new Event("icecandidateerror"), { errorCode: 701 }));
    assert.equal(diagnostics.snapshot().failed, true);
    peer.connectionState = "connected"; peer.dispatchEvent(new Event("connectionstatechange"));
    assert.equal(diagnostics.snapshot().failed, false);
  } finally { dispose(); }
  assert.equal(diagnostics.snapshot().failed, false);
});

test("DVR source never reparents or mutates live stage/video", async () => {
  const source = await readFile(new URL("../kamera/dvr-ui.js", import.meta.url), "utf8");
  assert.equal(/liveVideo\.(style|srcObject|pause|remove)/.test(source), false);
  assert.equal(/append\(liveStage|liveStage\.(remove|replaceWith)/.test(source), false);
  assert.equal(source.includes('className: "stage archivePlaybackStage"'), true);
});

test("actual app adapter replies on sender channel after dispatcher result", async () => {
  const source = await readFile(new URL("../kamera/app.js", import.meta.url), "utf8");
  const start = source.indexOf("      if (sig.commandId) {");
  const end = source.indexOf('      if (sig.type === "mode-set")', start);
  const branch = source.slice(start, end);
  let reply, executed;
  const context = vm.createContext({
    sig: { commandId: "a", clientId: "viewer", type: "mode-set", mode: "preview", expiresAt: Date.now()+1000 },
    commandDispatcher: { execute: async (command, clientId) => { executed = { command, clientId }; return { id: command.id, status: "succeeded" }; } },
    ACCESS_KEY: "test", sign: async () => "signed",
    chan: { channel: "actual-channel" }, send: (channel, payload) => { reply = { channel, payload }; }
  });
  await vm.runInContext(`(async () => { ${branch} })()`, context);
  assert.equal(executed.clientId, "viewer");
  assert.equal(executed.command.name, "mode-set");
  assert.equal(reply.channel, "actual-channel");
  assert.equal(reply.payload.mac, "signed");
  assert.equal(reply.payload.result.status, "succeeded");
});

test("command signature binds command ID, client and expiry", async () => {
  const source = await readFile(new URL("../kamera/app.js", import.meta.url), "utf8");
  const signature = source.slice(source.indexOf("const controlText ="), source.indexOf("// ---------- Biblioteka nagrań"));
  const context = vm.createContext({
    OWNER_CONTROL: new Set(["mode-set"]), ACCESS_KEY: "test",
    sign: async (key, message) => key + message,
    clampLight: Number, Date
  });
  vm.runInContext(signature, context);
  const signed = await vm.runInContext('signedOwnerControl({type:"mode-set",mode:"preview",commandId:"a",clientId:"viewer",expiresAt:123})', context);
  context.packet = signed;
  assert.equal(await vm.runInContext("validOwnerControl(packet)", context), true);
  for (const field of ["commandId", "clientId", "expiresAt"]) {
    context.packet = { ...signed, [field]: "tampered" };
    assert.equal(await vm.runInContext("validOwnerControl(packet)", context), false);
  }
});

test("native adapter supports read-only IPC and propagates unknown", async () => {
  const previous = globalThis.__HOME_SECURITY_AGENT_BRIDGE__;
  globalThis.__HOME_SECURITY_AGENT_BRIDGE__ = true;
  class WebView extends EventTarget { postMessage(value) { this.sent = value; } }
  const webview = new WebView(), client = new NativeAgentClient(webview);
  try {
    assert.throws(() => client.execute("secret.read"));
    const pending = client.execute("system.snapshot");
    await Promise.resolve(); await Promise.resolve();
    assert.equal(webview.sent.type, "agent.command");
    webview.dispatchEvent(Object.assign(new Event("message"), { data: {
      type: "agent.result", result: { id: webview.sent.id, status: "unknown", code: "PIPE_UNAVAILABLE" }
    } }));
    assert.equal((await pending).code, "PIPE_UNAVAILABLE");
  } finally { client.dispose(); globalThis.__HOME_SECURITY_AGENT_BRIDGE__ = previous; }
});
