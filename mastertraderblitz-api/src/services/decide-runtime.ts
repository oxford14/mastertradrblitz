let lastDecisionAt = 0;
let decideCallCount = 0;
const sessionStartedAt = Date.now();

export function recordDecideCall(): void {
  lastDecisionAt = Date.now();
  decideCallCount += 1;
}

export function getDecideRuntimeStats() {
  const elapsedMs = Date.now() - sessionStartedAt;
  const elapsedHours = Math.max(elapsedMs / 3_600_000, 1 / 60);
  return {
    lastDecisionAt: lastDecisionAt || null,
    decideCallCount,
    callsPerHourEstimate: Math.round(decideCallCount / elapsedHours),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    openrouterAppTitle: 'Master Trader Blitz API',
  };
}
