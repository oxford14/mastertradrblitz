const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function callOpenRouter(
  model: string,
  system: string,
  user: string,
  apiKey: string,
): Promise<{ ok: boolean; rawText?: string; error?: string }> {
  if (!apiKey) {
    return { ok: false, error: 'OpenRouter API key not configured' };
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER ?? 'http://localhost:3001',
        'X-Title': 'Master Trader Blitz API',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { ok: false, error: `OpenRouter ${response.status}: ${body.slice(0, 200)}` };
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawText = data.choices?.[0]?.message?.content ?? '';
  return { ok: true, rawText };
}

export function parseJsonResponse<T>(rawText: string): T | null {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
