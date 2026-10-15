import { CommandClient } from "./commands.mjs";

// Pierwsza wersja: wyłącznie stan lokalnego szkieletu. Nie zastępuje jeszcze nadajnika.
export class NativeAgentClient {
  constructor(webview = globalThis.chrome?.webview) {
    if (!globalThis.__HOME_SECURITY_AGENT_BRIDGE__ || !webview) throw new Error("Agent bridge is disabled.");
    this.webview = webview;
    this.commands = new CommandClient({ timeoutMs: 6000, send: command => {
      webview.postMessage({ type: "agent.command", id: command.id, name: command.name, args: command.args });
    } });
    this.onMessage = event => {
      if (event.data?.type !== "agent.result") return;
      const result = event.data.result;
      if (result?.status === "unknown") this.commands.finish(result.id, result);
      else this.commands.receive(result);
    };
    webview.addEventListener("message", this.onMessage);
  }
  execute(name, args = {}) {
    if (!["agent.ping", "system.snapshot", "command.status"].includes(name)) throw new Error("Command not exposed to web UI.");
    return this.commands.execute(name, args);
  }
  dispose() {
    this.webview.removeEventListener("message", this.onMessage);
    this.commands.disconnect();
  }
}
