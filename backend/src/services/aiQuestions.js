const KEYS = [
  'decisionMaker',
  'networkDiscussion',
  'nonNegotiables',
  'mainObstacle',
  'whoHasTheBall',
];

function timedFetch(url, options, ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...options, signal: ac.signal }).finally(() => clearTimeout(timer));
}

function validQuestions(value, fallback) {
  if (!value || typeof value !== 'object') return fallback;
  const next = { ...fallback };
  for (const key of KEYS) {
    const item = value[key];
    if (item && typeof item.answer === 'string' && item.answer.trim()) {
      next[key] = {
        ...fallback[key],
        answer: item.answer.trim(),
        basis: typeof item.basis === 'string' && item.basis.trim()
          ? item.basis.trim()
          : fallback[key].basis,
      };
    }
  }
  return next;
}

export async function enhanceFiveQuestions(fallback, evidence = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !fallback) return fallback;
  const endpoint = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  try {
    const response = await timedFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Answer five realtor questions from evidence. Keep each basis citation. Return JSON with decisionMaker, networkDiscussion, nonNegotiables, mainObstacle, whoHasTheBall — each {answer, basis}.',
          },
          {
            role: 'user',
            content: JSON.stringify({ fallback, evidence }),
          },
        ],
      }),
    }, 8000);
    if (!response.ok) return fallback;
    const body = await response.json();
    const text = body.choices?.[0]?.message?.content;
    if (!text) return fallback;
    return validQuestions(JSON.parse(text), fallback);
  } catch {
    return fallback;
  }
}
