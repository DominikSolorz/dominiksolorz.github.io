// Observe the native process without giving views ownership of its lifecycle.
export function createAgentTelemetry({client, store, interval = setInterval, cancel = clearInterval}) {
  let disposed = false, pending = false, prior = '';
  async function poll() {
    if (disposed || pending) return;
    pending = true;
    try {
      const ping = await client.execute('agent.ping');
      if (disposed) return;
      let telemetry;
      if (ping.status !== 'succeeded') {
        telemetry = {status:'disconnected', message:'Brak potwierdzonej odpowiedzi agenta. Podgląd i zapis mają osobną diagnostykę.'};
      } else {
        const snapshot = await client.execute('system.snapshot');
        if (disposed) return;
        const drive=snapshot.result?.components?.['drive.sync'];
        if(snapshot.status==='succeeded'&&drive?.state)store.component('nativeDrive',{...drive.state,updatedAt:drive.updatedAt});
        telemetry = {status:snapshot.status === 'succeeded' ? 'healthy' : 'degraded',
          mediaEngine:ping.result?.mediaEngine || 'unknown',
          message:snapshot.status !== 'succeeded' ? 'Agent odpowiada, ale nie potwierdził odczytu stanu.' :
            ping.result?.mediaEngine === 'not_implemented' ? 'IPC i odczyt bazy działają. Nagrywanie nadal obsługuje panel, nie agent.' : 'Agent odpowiedział i potwierdził odczyt stanu.'};
      }
      store.component('agent', telemetry);
      if (telemetry.status !== prior) {
        store.event({component:'agent',level:telemetry.status === 'healthy' ? 'info' : 'warning',message:telemetry.message});
        prior = telemetry.status;
      }
    } catch {
      if (!disposed) store.component('agent',{status:'disconnected',message:'Nie udało się odczytać stanu agenta.'});
    } finally { pending = false; }
  }
  const timer = interval(poll,120000);
  void poll();
  return {poll, dispose() {disposed=true;cancel(timer);client.dispose();}};
}
