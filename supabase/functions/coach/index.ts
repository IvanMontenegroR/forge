// ============================================================
// Forge — Edge Function "coach"
// Proxy seguro a la API de Claude.
//
//   * La API key de Claude vive SOLO acá, como secreto de entorno
//     (ANTHROPIC_API_KEY). Nunca en el frontend ni en el repo.
//   * Verifica el JWT del usuario (Supabase Auth) antes de llamar.
//   * El modelo es configurable vía CLAUDE_MODEL (default abajo).
//
// Deploy:
//   supabase functions deploy coach
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   (opcional) supabase secrets set CLAUDE_MODEL=claude-sonnet-4-6
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const DEFAULT_MODEL = 'claude-sonnet-5'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

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

const SYSTEM_PROMPT = `Sos el coach de una app de fitness llamada Forge. El usuario prioriza su objetivo
(recomposición, bajar grasa o ganar músculo) con foco en la proteína (meta diaria, no negociable)
y en quedar bajo su techo de calorías.

Recibís TODOS estos datos del usuario en JSON:
- perfil: objetivo, edad, altura, peso, metas (proteína, kcal, pasos, sueño), días de entreno.
- entrenamiento: total de sesiones completadas, fecha de la última, y sesiones recientes con sus series.
- nutricion.resumen: días registrados, promedio de kcal y proteína/día, días bajo el techo de kcal, días que cumplió la proteína.
- nutricion.por_dia: kcal y proteína por día (últimos ~30 días).
- metricas: peso/cintura/brazo en el tiempo; sueño; cardio.

Basá tus respuestas SOLO en esos datos. YA TENÉS el historial de nutrición por día y el de
entrenamiento: usalos. NO digas que solo ves los datos de "hoy".

Tu trabajo:
- Análisis claro y accionable, en español rioplatense, motivador pero honesto.
- Evaluá el progreso cruzando la tendencia de métricas + la adherencia a proteína y calorías + el entrenamiento.
  Si no entrenó en el período, decilo con su impacto real y qué priorizar.
- Doble progresión para subir peso (si llegó al tope de reps en todas las series, +2.5 kg).
  Premiá consistencia y recuperación; NUNCA incentives sobreentrenar ni loguear de más.
- Si un dato puntual falta o es escaso, decilo específicamente (no en general).
- Sé conciso: 3 a 6 viñetas + una frase de cierre. Nada de relleno.`

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
  let body: { payload?: unknown; question?: string; model?: string } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido.' }, 400)
  }

  const model = body.model || Deno.env.get('CLAUDE_MODEL') || DEFAULT_MODEL
  const question = (body.question || '').toString().slice(0, 2000)
  const dataStr = JSON.stringify(body.payload ?? {}, null, 0).slice(0, 50_000)

  const userContent = [
    question ? `Pregunta del usuario: ${question}\n` : 'Hacé un análisis general de mi progreso reciente y decime qué ajustar.\n',
    `Datos recientes (JSON):\n${dataStr}`,
  ].join('\n')

  // ── Llamada a Claude ──
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

    return json({ text, model, usage: data.usage ?? null })
  } catch (e) {
    return json({ error: `Fallo al contactar a Claude: ${(e as Error).message}` }, 502)
  }
})
