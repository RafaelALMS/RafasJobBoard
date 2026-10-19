import { config } from '../config.ts'

function parseLooseJson<T>(raw: string): T {
  const text = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(text) as T
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1)) as T
    throw new Error(`LLM returned non-JSON output: ${text.slice(0, 160)}`)
  }
}

async function post(payload: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(75_000),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.llm.key}`,
    },
    body: payload,
  })
  return { status: res.status, body: await res.text() }
}

/** One OpenAI-compatible chat call that must answer with JSON. */
export async function chatJSON<T>(system: string, user: string): Promise<T> {
  const make = (withFormat: boolean) =>
    JSON.stringify({
      model: config.llm.model,
      temperature: 0.2,
      ...(withFormat ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })

  let res = await post(make(true))
  if (res.status === 400 && /response_format|json_object|not supported/i.test(res.body)) {
    res = await post(make(false)) // some OpenAI-compatible servers reject response_format
  }
  if (res.status !== 200) {
    throw new Error(`LLM HTTP ${res.status}: ${res.body.slice(0, 300)}`)
  }

  let data: { choices?: { message?: { content?: string } }[] }
  try {
    data = JSON.parse(res.body)
  } catch {
    throw new Error('LLM returned unparseable envelope')
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('LLM returned empty content')
  return parseLooseJson<T>(content)
}
