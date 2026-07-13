// ============================================================
// Forge — Edge Function "ingest-steps"
// Recibe los pasos del día desde Apple Shortcuts (u otra automatización)
// y los guarda en cardio_logs del usuario dueño del token.
//
// Auth: NO usa JWT. Se autentica con el `steps_token` personal del
// usuario (en profiles.steps_token). Por eso verify_jwt = false.
//
// Uso (POST JSON):
//   { "token": "<steps_token>", "steps": 8234, "date": "2026-07-12" }
//   date es opcional (default: hoy en America/Asuncion).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function localToday(tz = 'America/Asuncion') {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  let body: any = {}
  try { body = await req.json() } catch { body = {} }

  const token = String(body.token || url.searchParams.get('token') || '').trim()
  const stepsRaw = body.steps ?? url.searchParams.get('steps')
  const date = String(body.date || url.searchParams.get('date') || '').trim() || localToday()

  if (!UUID_RE.test(token)) return json({ error: 'Token inválido o ausente.' }, 401)
  const steps = Math.round(Number(stepsRaw))
  if (!Number.isFinite(steps) || steps < 0 || steps > 200000) return json({ error: 'Valor de pasos inválido.' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Fecha inválida (usar YYYY-MM-DD).' }, 400)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Buscar al usuario por su token personal
  const { data: prof, error: pErr } = await db.from('profiles').select('id').eq('steps_token', token).maybeSingle()
  if (pErr) return json({ error: 'Error del servidor.' }, 500)
  if (!prof) return json({ error: 'Token no reconocido.' }, 401)

  // Reemplazar los pasos de ese día (igual que setSteps del cliente)
  try {
    await db.from('cardio_logs').delete().eq('user_id', prof.id).eq('date', date).eq('type', 'steps')
    const { error: iErr } = await db.from('cardio_logs').insert({ user_id: prof.id, date, type: 'steps', steps })
    if (iErr) throw iErr
    return json({ ok: true, steps, date })
  } catch (e) {
    return json({ error: `No se pudieron guardar los pasos: ${(e as Error).message}` }, 500)
  }
})
