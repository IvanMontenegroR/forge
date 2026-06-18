// ============================================================
// Forge — Edge Function "analyze-meal"
// Estima calorías y proteína de una foto de comida con Claude (visión).
//
//   * La API key de Claude vive SOLO acá (ANTHROPIC_API_KEY).
//   * Verifica el JWT del usuario (Supabase Auth) antes de llamar.
//   * Modelo configurable vía CLAUDE_MODEL (default abajo).
//
// Deploy:
//   supabase functions deploy analyze-meal
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ALLOWED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const SYSTEM_PROMPT = `Sos un nutricionista que estima el contenido de una foto de comida o bebida.
Devolvé SOLO un objeto JSON válido (sin texto extra, sin markdown, sin backticks) con esta forma:
{"items":[{"name":"string en español","kcal":number,"protein_g":number}],"total_kcal":number,"total_protein_g":number,"note":"string corto"}

Reglas:
- Un item por alimento/bebida visible. Estimá la porción por lo que se ve en el plato/vaso.
- kcal y protein_g son enteros razonables por la porción mostrada (no por 100 g).
- total_kcal y total_protein_g son la suma de los items.
- "note": una frase breve con supuestos o el nivel de confianza.
- Si no hay comida identificable, devolvé items vacío y explicá en "note".
- Las estimaciones son aproximadas; no inventes precisión falsa.`

// Extrae el primer objeto JSON {...} de un texto, tolerando ruido alrededor.
function extractJson(text: string): any | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'Falta ANTHROPIC_API_KEY en el entorno de la función.' }, 500)

  // ── Verificar el JWT del usuario ──
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supa = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await supa.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'No autorizado.' }, 401)

  // ── Payload ──
  let body: { image?: string; media_type?: string; note?: string; model?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido.' }, 400)
  }

  const image = (body.image || '').toString()
  const mediaType = (body.media_type || 'image/jpeg').toString()
  if (!image) return json({ error: 'Falta la imagen.' }, 400)
  if (!ALLOWED_MEDIA.includes(mediaType)) return json({ error: `Formato no soportado: ${mediaType}` }, 400)

  const model = body.model || Deno.env.get('CLAUDE_MODEL') || DEFAULT_MODEL
  const note = (body.note || '').toString().slice(0, 500)

  const userContent: unknown[] = [
    { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
    { type: 'text', text: note ? `Contexto del usuario: ${note}\nEstimá calorías y proteína.` : 'Estimá calorías y proteína de esta comida.' },
  ]

  // ── Llamada a Claude (visión) ──
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      return json({ error: `Claude API error (${resp.status}): ${errText.slice(0, 500)}` }, 502)
    }

    const data = await resp.json()
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim()

    const parsed = extractJson(text)
    if (!parsed) return json({ error: 'No pude interpretar la estimación. Probá con otra foto.', raw: text.slice(0, 300) }, 502)

    const items = Array.isArray(parsed.items) ? parsed.items.map((it: any) => ({
      name: String(it?.name ?? 'Comida').slice(0, 80),
      kcal: Math.max(0, Math.round(Number(it?.kcal) || 0)),
      protein_g: Math.max(0, Math.round(Number(it?.protein_g) || 0)),
    })) : []

    const total_kcal = Math.round(Number(parsed.total_kcal) || items.reduce((s: number, it: any) => s + it.kcal, 0))
    const total_protein_g = Math.round(Number(parsed.total_protein_g) || items.reduce((s: number, it: any) => s + it.protein_g, 0))

    return json({ items, total_kcal, total_protein_g, note: parsed.note ?? null, model })
  } catch (e) {
    return json({ error: `Fallo al contactar a Claude: ${(e as Error).message}` }, 502)
  }
})
