const TERMINAL = new Set(["succeeded", "failed", "rejected"]);
export class CommandClient {
  constructor({ send, now = Date.now, uuid = () => crypto.randomUUID(), timeoutMs = 15000, onResult = () => {} }) {
    Object.assign(this, { send, now, uuid, timeoutMs, onResult });
    this.pending = new Map();
  }
  execute(name, args = {}) {
    const id = this.uuid(), issuedAt = this.now();
    const command = { v: 1, id, name, args: structuredClone(args), issuedAt, expiresAt: issuedAt + this.timeoutMs };
    return new Promise(resolve => {
      const timer = setTimeout(() => this.finish(id, { id, status: "unknown", code: "TIMEOUT" }), this.timeoutMs);
      this.pending.set(id, { resolve, timer });
      Promise.resolve().then(() => this.send(command)).catch(() => this.finish(id, { id, status: "unknown", code: "TRANSPORT_ERROR" }));
    });
  }
  receive(result) {
    if (!result || !TERMINAL.has(result.status)) return;
    this.finish(result.id, result);
  }
  finish(id, result) {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(id);
    pending.resolve(result);
    try { this.onResult(result); } catch { /* obserwator nie zmienia wyniku komendy */ }
  }
  disconnect() {
    for (const id of [...this.pending.keys()]) this.finish(id, { id, status: "unknown", code: "DISCONNECTED" });
  }
}

// Deduplikacja i kolejność operacji w bieżącym procesie; nie jest trwałym dziennikiem agenta.
export class CommandDispatcher {
  constructor({ handlers, now = Date.now, limit = 256 }) {
    Object.assign(this, { handlers, now, limit });
    this.results = new Map(); this.tail = Promise.resolve();
  }
  execute(command, clientId = "local") {
    if (!command || typeof command.id !== "string" || command.id.length > 80 || command.v !== 1 || !Number.isFinite(command.expiresAt)) {
      return Promise.resolve({ id: command?.id, status: "rejected", code: "INVALID_COMMAND" });
    }
    const key = `${clientId}:${command.id}`, fingerprint = JSON.stringify([command.name, command.args]);
    const existing = this.results.get(key);
    if (existing) return existing.fingerprint === fingerprint ? existing.promise : Promise.resolve({ id: command.id, status: "rejected", code: "ID_CONFLICT" });
    if (this.results.size >= this.limit) {
      for (const [id, item] of this.results) { if (item.done) { this.results.delete(id); break; } }
      if (this.results.size >= this.limit) return Promise.resolve({ id: command.id, status: "rejected", code: "BUSY" });
    }
    const item = { fingerprint, done: false };
    item.promise = this.tail.then(async () => {
      if (command.expiresAt < this.now()) return { id: command.id, status: "rejected", code: "EXPIRED" };
      const handler = Object.hasOwn(this.handlers, command.name) && this.handlers[command.name];
      if (!handler) return { id: command.id, status: "rejected", code: "UNKNOWN_COMMAND" };
      try { return { id: command.id, status: "succeeded", result: await handler(command.args || {}) }; }
      catch (error) { return { id: command.id, status: "failed", code: "EXECUTION_ERROR", message: String(error?.message || error) }; }
    }).finally(() => { item.done = true; });
    this.results.set(key, item); this.tail = item.promise.catch(() => {});
    return item.promise;
  }
}
