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

const DEFAULT_MODEL = 'claude-opus-4-8'
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
- Un item por PLATO/comida o por bebida. Agrupá TODOS los ingredientes de un mismo plato en UN solo item con su total; NO desgloses por ingrediente.
- Nombrá el item por el plato (ej. "Milanesa con puré"), no por sus componentes.
- Si hay platos o bebidas claramente distintos, usá un item por cada uno.
- kcal y protein_g son enteros razonables por la porción mostrada o descrita (no por 100 g).
- total_kcal y total_protein_g son la suma de los items.
- Puede venir una foto, una descripción de texto, o ambas: combiná toda la info para estimar mejor.
- Buscá activamente objetos de referencia para calcular el tamaño de la porción (cubiertos, mano, plato o vaso estándar, latas, botellas, monedas) y usalos para estimar mejor los gramos/volumen. Si el usuario menciona una referencia en el texto (ej. "la cuchara es sopera", "el vaso es de 500 ml"), priorizala.
- PREPARACIÓN (calorías): salvo que el usuario aclare lo contrario, asumí preparación ESTÁNDAR de restaurante/casa: cocinado con aceite o manteca, salsas normales, y cortes de carne intermedios (grasa normal). Es preferible errar un poco ALTO en calorías que bajo. Si el usuario especifica ("sin aceite", "a la plancha", "carne magra", "light"), respetá eso.
- PROTEÍNA (precisa): sumá la proteína de TODOS los componentes del plato, no solo la fuente principal. Contá también queso, huevo, fiambre/bacon, pan, lácteos, legumbres y frutos secos. No subestimes la proteína: buscá que sea lo más exacta posible. Recordá que los cortes magros tienen MENOS kcal pero MÁS proteína por gramo que los grasos.
- "note": una frase breve con supuestos o el nivel de confianza; mencioná qué referencia usaste para la escala y qué preparación asumiste (ej. "asumí cocido con aceite"), así el usuario puede corregir si sabe cómo se hizo.
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
  const note = (body.note || '').toString().slice(0, 800)
  if (!image && !note) return json({ error: 'Falta una foto o una descripción.' }, 400)
  if (image && !ALLOWED_MEDIA.includes(mediaType)) return json({ error: `Formato no soportado: ${mediaType}` }, 400)

  const model = body.model || Deno.env.get('CLAUDE_MODEL') || DEFAULT_MODEL

  const userContent: unknown[] = []
  if (image) userContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } })
  userContent.push({
    type: 'text',
    text: image
      ? (note ? `Analizá la comida de la foto. Contexto del usuario: ${note}\nEstimá calorías y proteína.` : 'Estimá calorías y proteína de la comida de la foto.')
      : `Estimá calorías y proteína de esta comida descrita por el usuario:\n${note}`,
  })

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
