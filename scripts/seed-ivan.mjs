#!/usr/bin/env node
// ============================================================
// Forge — seed de MI cuenta (Ivan)
//
// Los usuarios de Supabase Auth se crean al registrarse, así que
// este script se corre UNA vez DESPUÉS de que te registres en la
// app. Puebla tu profile, programa activo, suplementos y comidas
// quick-add atados a tu user_id. Es idempotente.
//
// Uso:
//   1) Registrate en la app con tu email.
//   2) Buscá tu USER_ID en Supabase → Authentication → Users.
//   3) Creá scripts/.env.seed (ver scripts/.env.seed.example) con:
//        SUPABASE_URL=...
//        SUPABASE_SERVICE_ROLE_KEY=...   (Project Settings → API → service_role)
//        SEED_USER_ID=...                (o pasalo como argumento)
//   4) npm run seed -- <USER_ID>
//
// La service_role key saltea RLS: NO la pongas nunca en el frontend
// ni la commitees. Solo vive en tu terminal.
// ============================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- mini cargador de .env.seed (sin dependencias) ---
function loadEnvFile(path) {
  try {
    const txt = readFileSync(path, 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch { /* opcional */ }
}
loadEnvFile(resolve(__dirname, '.env.seed'))

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const USER_ID = process.argv[2] || process.env.SEED_USER_ID

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (poné scripts/.env.seed).')
  process.exit(1)
}
if (!USER_ID) {
  console.error('✗ Falta el USER_ID. Uso: npm run seed -- <USER_ID>  (o SEED_USER_ID en .env.seed)')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const today = new Date().toISOString().slice(0, 10)

async function main() {
  console.log(`→ Seedeando cuenta de Ivan (user ${USER_ID})…`)

  // Programa preset
  const { data: program, error: pErr } = await db
    .from('programs').select('id').eq('slug', 'preset-recomp').single()
  if (pErr || !program) {
    console.error('✗ No encuentro el programa preset-recomp. ¿Corriste las migraciones (0003_seed_global.sql)?')
    process.exit(1)
  }

  // 1) Profile
  const profile = {
    id: USER_ID,
    full_name: 'Ivan',
    age: 26,
    height_cm: 167,
    start_weight_kg: 70,
    goal: 'recomp',
    goal_notes: 'Recomposición: ganar músculo en brazos y bajar grasa abdominal. Skinny fat, vuelve tras 1 año.',
    equipment: ['Mancuernas ajustables 2.5–27 kg', 'Banco plano', 'Banco reclinable', 'Caminadora (máx 8 km/h)'],
    training_weekdays: [1, 2, 5], // lun, mar, vie
    optional_weekdays: [7],       // dom
    protein_goal_g: 145,
    maintenance_kcal: 2350,
    target_kcal: 2050,
    step_goal: 9000,
    hiit_per_week: 2,
    sleep_goal_hours: 8,
    caffeine_cutoff_hour: 14,
    active_program_id: program.id,
    muscle_memory_start: today,   // la ventana arranca en la fecha del seed
    muscle_memory_days: 90,
    photo_reminder_days: 14,
    onboarded: true,              // mi cuenta se saltea el onboarding
  }
  const { error: profErr } = await db.from('profiles').upsert(profile, { onConflict: 'id' })
  if (profErr) throw profErr
  console.log('  ✓ Profile')

  // 2) Comidas quick-add (gramos de proteína por porción de referencia)
  const foods = [
    { name: 'Huevo',   protein_g: 6,  kcal: 78,  serving: '1 unidad', sort_order: 0 },
    { name: 'Pollo',   protein_g: 31, kcal: 165, serving: '100 g',    sort_order: 1 },
    { name: 'Carne',   protein_g: 26, kcal: 250, serving: '100 g',    sort_order: 2 },
    { name: 'Atún',    protein_g: 25, kcal: 116, serving: '100 g',    sort_order: 3 },
    { name: 'Arroz',   protein_g: 4,  kcal: 205, serving: '1 taza cocido', sort_order: 4 },
    { name: 'Pasta',   protein_g: 8,  kcal: 220, serving: '1 taza cocida', sort_order: 5 },
    { name: 'Avena',   protein_g: 5,  kcal: 150, serving: '40 g',     sort_order: 6 },
    { name: 'Banana',  protein_g: 1,  kcal: 105, serving: '1 unidad', sort_order: 7 },
    { name: 'Manzana', protein_g: 0,  kcal: 95,  serving: '1 unidad', sort_order: 8 },
    { name: 'Whey',    protein_g: 24, kcal: 120, serving: '1 scoop',  sort_order: 9 },
    // Bebidas (proteína ~0, foco en kcal)
    { name: 'Gin tonic (sin azúcar)', protein_g: 0, kcal: 110, serving: '500 ml',        sort_order: 10 },
    { name: 'Cerveza 330',            protein_g: 0, kcal: 140, serving: '330 ml',        sort_order: 11 },
    { name: 'Cerveza 500',            protein_g: 0, kcal: 215, serving: '500 ml',        sort_order: 12 },
    { name: 'Coca-Cola',              protein_g: 0, kcal: 125, serving: '300 ml',        sort_order: 13 },
    { name: 'Vanilla Ice Latte',      protein_g: 2, kcal: 170, serving: '500 ml (coco)', sort_order: 14 },
  ].map((f) => ({ ...f, user_id: USER_ID }))

  await db.from('user_foods').delete().eq('user_id', USER_ID)
  const { error: fErr } = await db.from('user_foods').insert(foods)
  if (fErr) throw fErr
  console.log(`  ✓ ${foods.length} comidas quick-add`)

  // 3) Suplementos (con metadata para recordatorios)
  const supps = [
    { name: 'Whey',                dose: '1–2 scoops', timing: 'Para cerrar la proteína', schedule: 'daily', active: true,  is_optional: false, track_streak: false, sort_order: 0 },
    { name: 'Creatina monohidrato',dose: '5 g',        timing: 'Cualquier hora, todos los días', schedule: 'daily', active: true, is_optional: false, loading_phase: false, track_streak: true, sort_order: 1 },
    { name: 'Vitamina D3',         dose: '2000 IU',    timing: 'Con comida', schedule: 'daily', active: true, is_optional: false, sort_order: 2 },
    { name: 'Omega 3',             dose: '1–2 g EPA+DHA', timing: 'Con comida', schedule: 'daily', active: true, is_optional: false, sort_order: 3 },
    { name: 'Magnesio glicinato',  dose: 'dosis del envase', timing: 'Antes de dormir', schedule: 'daily', active: true, is_optional: false, sort_order: 4 },
    { name: 'Multivitamínico ON',  dose: '1 dosis',    timing: 'Con comida', schedule: 'daily', active: true, is_optional: false, sort_order: 5 },
    // opcionales (apagados por defecto)
    { name: 'Lipo6',     dose: 'según envase', timing: 'Mañana o pre-gym — NUNCA después de las 16h', schedule: 'daily', active: false, is_optional: true, cutoff_hour: 16, sort_order: 6 },
    { name: 'Melatonina',dose: '0.5–1 mg',     timing: 'Antes de dormir', schedule: 'daily', active: false, is_optional: true, sort_order: 7 },
    { name: 'L-teanina', dose: '200 mg',       timing: 'Noche', schedule: 'daily', active: false, is_optional: true, sort_order: 8 },
    { name: 'Ashwagandha',dose: 'según envase',timing: 'Noche', schedule: 'daily', active: false, is_optional: true, sort_order: 9 },
  ].map((s) => ({ ...s, user_id: USER_ID }))

  await db.from('user_supplements').delete().eq('user_id', USER_ID)
  const { error: sErr } = await db.from('user_supplements').insert(supps)
  if (sErr) throw sErr
  console.log(`  ✓ ${supps.length} suplementos`)

  // 4) Streaks base (para que existan las filas)
  const streaks = ['workout', 'creatine', 'steps', 'protein'].map((kind) => ({
    user_id: USER_ID, kind, current_count: 0, longest_count: 0, freeze_available: true,
  }))
  await db.from('streaks').upsert(streaks, { onConflict: 'user_id,kind' })
  console.log('  ✓ Streaks inicializadas')

  console.log('\n✅ Listo. Entrá a la app: tu cuenta ya tiene perfil, programa y configuración.')
}

main().catch((e) => {
  console.error('✗ Error en el seed:', e.message || e)
  process.exit(1)
})
