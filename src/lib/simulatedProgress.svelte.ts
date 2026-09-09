/// Simulierter Fortschritt für einzelne DeepSeek-API-Calls ohne echtes
/// serverseitiges Fortschritts-Signal (kein Streaming). Nähert sich mit
/// abnehmender Geschwindigkeit 99% an — CONCEPT.md, "Noch offen": bewusste
/// Verlangsamung kurz vor Abschluss, damit der letzte Schritt nicht abrupt
/// wirkt. Springt bei tatsächlicher Antwort direkt auf 100%.
export function createSimulatedProgress() {
  let percent = $state(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  function start() {
    percent = 0;
    stop();
    timer = setInterval(() => {
      // Schritt schrumpft, je näher percent an 99 herankommt — nie
      // erreicht percent 99 durch die Formel selbst exakt, daher am Ende
      // hart gekappt.
      const remaining = 99 - percent;
      const step = Math.max(0.3, remaining * 0.06);
      percent = Math.min(99, percent + step);
    }, 200);
  }

  function stop() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function finish() {
    stop();
    percent = 100;
  }

  return {
    get percent() {
      return percent;
    },
    start,
    finish,
    stop,
  };
}
