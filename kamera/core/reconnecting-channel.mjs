export function createReconnectingChannel({
  client,
  name,
  onSignal,
  onSubscribed,
  onRetry = () => {},
  onError = () => {},
  delayForAttempt = attempt => Math.min(30000, 2000 * 2 ** attempt),
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let channel = null;
  let attempt = 0;
  let timer = null;
  let active = false;

  function reportError(error) {
    try { onError(error); } catch { /* Reporting cannot interrupt reconnection. */ }
  }

  function remove(target) {
    if (!target) return;
    try {
      Promise.resolve(client.removeChannel(target)).catch(reportError);
    } catch (error) {
      reportError(error);
    }
  }

  function clearRetry() {
    if (timer === null) return;
    cancel(timer);
    timer = null;
  }

  function retry(status) {
    if (!active || timer !== null) return;
    let delay = 0;
    try {
      const requestedDelay = Number(delayForAttempt(attempt++));
      delay = Number.isFinite(requestedDelay) ? Math.max(0, requestedDelay) : 0;
    } catch (error) {
      reportError(error);
    }
    try { onRetry(delay, status); } catch (error) { reportError(error); }
    timer = schedule(() => {
      timer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (!active) return;
    clearRetry();
    const previous = channel;
    channel = null;
    remove(previous);

    let next;
    try {
      next = client.channel(name, { config: { broadcast: { self: false } } });
      channel = next;
      next.on("broadcast", { event: "signal" }, ({ payload } = {}) => {
        if (!active || channel !== next) return;
        Promise.resolve().then(() => onSignal(payload)).catch(reportError);
      });
      next.subscribe(status => {
        if (!active || channel !== next) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          try { Promise.resolve(onSubscribed(next)).catch(reportError); } catch (error) { reportError(error); }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          retry(status);
        }
      });
    } catch (error) {
      if (channel === next) channel = null;
      remove(next);
      reportError(error);
      retry("CHANNEL_ERROR");
    }
  }

  return {
    get channel() { return channel; },
    start() {
      if (active) return;
      active = true;
      attempt = 0;
      connect();
    },
    reconnect() {
      if (!active) return;
      attempt = 0;
      connect();
    },
    stop() {
      active = false;
      clearRetry();
      const previous = channel;
      channel = null;
      remove(previous);
    },
  };
}
