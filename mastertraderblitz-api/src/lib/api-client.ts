export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.MTB_API_BASE_URL ?? 'http://localhost:3001';
  const key = process.env.MTB_API_KEY ?? '';
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-mtb-api-key': key,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
