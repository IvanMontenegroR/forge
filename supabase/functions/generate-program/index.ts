// ============================================================
// Forge — Edge Function "generate-program"
// Genera un programa de entrenamiento con Claude según los datos
// del usuario y lo inserta (service_role) como programa custom.
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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'ejercicio'
}

function extractJson(text: string): any | null {
  const start = text.indexOf('{'); const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try { return JSON.parse(text.slice(start, end + 1)) } catch { return null }
}

const WD = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json({ error: 'Falta ANTHROPIC_API_KEY en el entorno de la función.' }, 500)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  // Verificar usuario
  const supaUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userErr } = await supaUser.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'No autorizado.' }, 401)
  const userId = userData.user.id

  let body: any = {}
  try { body = await req.json() } catch { return json({ error: 'Body inválido.' }, 400) }

  const goal = String(body.goal || 'recomp')
  const sex = String(body.sex || '')
  const age = body.age ? Number(body.age) : null
  const height = body.height ? Number(body.height) : null
  const weight = body.weight ? Number(body.weight) : null
  const weekdays: number[] = Array.isArray(body.weekdays) && body.weekdays.length ? body.weekdays : [1, 3, 5]
  const equipment: string[] = Array.isArray(body.equipment) ? body.equipment : []
  const protein = body.protein ? Number(body.protein) : null
  const model = body.model || Deno.env.get('CLAUDE_MODEL') || DEFAULT_MODEL

  const nDays = weekdays.length
  const weekdayNames = weekdays.map((d) => WD[d] || String(d)).join(', ')

  const SYSTEM_PROMPT = `Sos un entrenador de fuerza. Diseñás un programa semanal personalizado.
Devolvé SOLO un objeto JSON válido (sin markdown ni texto extra) con esta forma exacta:
{"name":"string","description":"string corto","days":[{"name":"string","focus":"string corto","exercises":[{"name":"string en español","muscle_group":"pecho|espalda|hombros|biceps|triceps|piernas|gluteo|gemelos|core|cuerpo completo","equipment":"string","is_unilateral":boolean,"sets":number,"rep_low":number,"rep_high":number,"per_side":boolean,"notes":"string corto o vacío"}]}]}

Reglas:
- Generá EXACTAMENTE ${nDays} días (uno por cada día de entrenamiento del usuario).
- Usá SOLO el equipo disponible del usuario. Si va al gimnasio, podés usar máquinas, barra, poleas, mancuernas, etc.
- 4 a 7 ejercicios por día, con series y rango de reps coherentes con el objetivo.
- Ejercicios reales y bien nombrados; per_side=true para ejercicios unilaterales.
- Ajustá volumen e intensidad al objetivo y a los ${nDays} días/semana. No sobreentrenar.`

  const userMsg = `Datos del usuario:
- Objetivo: ${goal}
- Sexo: ${sex || 'n/d'}, Edad: ${age ?? 'n/d'}, Altura: ${height ?? 'n/d'} cm, Peso: ${weight ?? 'n/d'} kg
- Días de entrenamiento por semana: ${nDays} (${weekdayNames})
- Equipo disponible: ${equipment.length ? equipment.join(', ') : 'mancuernas y peso corporal'}
- Meta de proteína: ${protein ?? 'n/d'} g/día
Diseñá el programa.`

  // Llamada a Claude
  let parsed: any
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 2048, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userMsg }] }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      return json({ error: `Claude API error (${resp.status}): ${t.slice(0, 400)}` }, 502)
    }
    const data = await resp.json()
    const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    parsed = extractJson(text)
    if (!parsed || !Array.isArray(parsed.days) || !parsed.days.length) {
      return json({ error: 'No pude interpretar el programa generado. Probá de nuevo.' }, 502)
    }
  } catch (e) {
    return json({ error: `Fallo al contactar a Claude: ${(e as Error).message}` }, 502)
  }

  // Inserción con service_role
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    // 1) Upsert de ejercicios (biblioteca global) por slug
    const exMap = new Map<string, any>()
    for (const day of parsed.days) {
      for (const ex of (day.exercises || [])) {
        const slug = slugify(ex.name)
        if (!exMap.has(slug)) {
          exMap.set(slug, {
            slug,
            name: String(ex.name || 'Ejercicio').slice(0, 120),
            muscle_group: String(ex.muscle_group || 'cuerpo completo').slice(0, 40),
            equipment: String(ex.equipment || 'gimnasio').slice(0, 60),
            is_unilateral: !!ex.is_unilateral,
          })
        }
      }
    }
    const exRows = [...exMap.values()]
    if (exRows.length) {
      const { error } = await db.from('exercises').upsert(exRows, { onConflict: 'slug', ignoreDuplicates: true })
      if (error) throw error
    }
    const slugs = [...exMap.keys()]
    const { data: exData, error: exErr } = await db.from('exercises').select('id, slug').in('slug', slugs)
    if (exErr) throw exErr
    const idBySlug = new Map<string, string>((exData || []).map((r: any) => [r.slug, r.id]))

    // 2) Crear programa custom
    const progSlug = `${slugify(parsed.name || 'plan')}-${userId.slice(0, 8)}-${Date.now().toString(36)}`
    const { data: prog, error: pErr } = await db.from('programs').insert({
      slug: progSlug,
      name: String(parsed.name || 'Plan personalizado').slice(0, 120),
      description: String(parsed.description || '').slice(0, 400),
      days_per_week: nDays,
      is_preset: false,
      created_by: userId,
    }).select().single()
    if (pErr) throw pErr

    // 3) Días + ejercicios
    for (let i = 0; i < parsed.days.length; i++) {
      const day = parsed.days[i]
      const { data: pd, error: dErr } = await db.from('program_days').insert({
        program_id: prog.id,
        order_index: i,
        weekday: weekdays[i] ?? null,
        name: String(day.name || `Día ${i + 1}`).slice(0, 80),
        focus: String(day.focus || '').slice(0, 120),
        is_optional: false,
      }).select().single()
      if (dErr) throw dErr

      const pde = (day.exercises || []).map((ex: any, j: number) => {
        const id = idBySlug.get(slugify(ex.name))
        if (!id) return null
        return {
          program_day_id: pd.id,
          exercise_id: id,
          order_index: j,
          target_sets: Math.max(1, Math.round(Number(ex.sets) || 3)),
          rep_low: Math.max(1, Math.round(Number(ex.rep_low) || 8)),
          rep_high: Math.max(1, Math.round(Number(ex.rep_high) || 12)),
          per_side: !!ex.per_side,
          notes: ex.notes ? String(ex.notes).slice(0, 200) : null,
        }
      }).filter(Boolean)
      if (pde.length) {
        const { error: eErr } = await db.from('program_day_exercises').insert(pde)
        if (eErr) throw eErr
      }
    }

    // 4) Activar el programa para el usuario
    await db.from('profiles').update({ active_program_id: prog.id }).eq('id', userId)

    return json({ program_id: prog.id, name: prog.name, days: parsed.days.length })
  } catch (e) {
    return json({ error: `No se pudo guardar el programa: ${(e as Error).message}` }, 500)
  }
})
