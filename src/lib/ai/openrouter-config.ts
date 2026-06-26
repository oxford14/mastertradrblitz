export function getOpenRouterApiKey(): string | undefined {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY?.trim();
  return key || undefined;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}
