import { logger } from '../utils/logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4-5';

async function callOpenRouter(input: string | { role: string; content: string }[], json = false): Promise<string> {
  const messages = typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(json && { response_format: { type: 'json_object' } }),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error({ status: response.status, err }, 'OpenRouter error');
    throw new Error(`Request failed with status code ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

export async function callClaude(input: string | { role: string; content: string }[]): Promise<string> {
  return callOpenRouter(input, false);
}

export async function callClaudeJSON(input: string | { role: string; content: string }[]): Promise<unknown> {
  const text = await callOpenRouter(input, true);
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    logger.error({ text }, 'Failed to parse JSON response');
    return null;
  }
}
