-- ============================================================
-- Forge — seed GLOBAL (idempotente)
-- Biblioteca de ejercicios del plan + preset del split de Ivan
-- (cualquier usuario lo puede adoptar) + catálogo de badges.
-- NO contiene datos personales de ningún usuario.
-- ============================================================

-- ─────────────── Ejercicios ───────────────
insert into public.exercises (slug, name, muscle_group, equipment, is_unilateral, instructions) values
  ('press-banca-plano-mancuernas', 'Press banca plano con mancuernas', 'pecho', 'mancuernas', false, 'Banco plano. Bajá controlado al pecho, empujá sin trabar codos.'),
  ('remo-un-brazo',                'Remo a un brazo (rodilla en banco)', 'espalda', 'mancuernas', true, 'Rodilla y mano apoyadas en el banco. Tirá del codo hacia la cadera.'),
  ('press-hombros-sentado',        'Press de hombros sentado', 'hombros', 'mancuernas', false, 'Banco a 90°. Empujá arriba sin arquear la espalda.'),
  ('press-inclinado-mancuernas',   'Press inclinado con mancuernas', 'pecho', 'mancuernas', false, 'Banco reclinado ~30°. Foco en pecho superior.'),
  ('curl-biceps-pie',              'Curl de bíceps de pie', 'biceps', 'mancuernas', false, 'Codos pegados al cuerpo, sin balanceo.'),
  ('extension-triceps-sobre-cabeza','Extensión de tríceps sobre la cabeza', 'triceps', 'mancuernas', false, 'Una mancuerna con ambas manos sobre la cabeza, codos quietos.'),
  ('elevaciones-laterales',        'Elevaciones laterales', 'hombros', 'mancuernas', false, 'Subí hasta la línea de los hombros, sin envión.'),
  ('sentadilla-goblet',            'Sentadilla goblet', 'piernas', 'mancuernas', false, 'Una mancuerna al pecho. Bajá entre los talones, pecho arriba.'),
  ('peso-muerto-rumano',           'Peso muerto rumano con mancuernas', 'piernas', 'mancuernas', false, 'Bisagra de cadera, leve flexión de rodilla, estirá isquios.'),
  ('zancadas',                     'Zancadas con mancuernas', 'piernas', 'mancuernas', true, 'Paso largo, rodilla trasera al piso, torso erguido.'),
  ('hip-thrust',                   'Hip thrust con mancuerna', 'gluteo', 'mancuernas', false, 'Espalda apoyada en el banco, empujá con glúteos arriba.'),
  ('elevacion-talones',            'Elevación de talones de pie', 'gemelos', 'mancuernas', false, 'Rango completo, pausa arriba.'),
  ('plancha',                      'Plancha', 'core', 'peso corporal', false, 'Cuerpo recto, abdomen y glúteo apretados. Medido en segundos.'),
  ('elevacion-piernas-acostado',   'Elevación de piernas acostado', 'core', 'peso corporal', false, 'Bajá las piernas sin tocar el piso, lumbar pegada.'),
  ('remo-inclinado-2-mancuernas',  'Remo inclinado con 2 mancuernas', 'espalda', 'mancuernas', false, 'Torso inclinado ~45°, tirá los codos hacia atrás.'),
  ('curl-martillo',                'Curl martillo', 'biceps', 'mancuernas', false, 'Agarre neutro (martillo), trabaja braquial.'),
  ('press-frances',                'Press francés con mancuernas (acostado)', 'triceps', 'mancuernas', false, 'Acostado, bajá hacia la frente, codos fijos.'),
  ('curl-concentrado',             'Curl concentrado', 'biceps', 'mancuernas', true, 'Codo apoyado en el muslo, pico de contracción.'),
  ('crunch',                       'Crunch', 'core', 'peso corporal', false, 'Enrollá el tronco, sin tirar del cuello.'),
  ('crunch-bicicleta',             'Crunch bicicleta', 'core', 'peso corporal', false, 'Codo hacia rodilla opuesta, alterná.')
on conflict (slug) do nothing;

-- ─────────────── Programa preset (split de Ivan) ───────────────
insert into public.programs (slug, name, description, days_per_week, is_preset, created_by) values
  ('preset-recomp', 'Recomposición — Torso / Piernas / Full',
   'Split de 3 días (lun/mar/vie) + domingo opcional. Mancuernas, banco y caminadora. Prioriza brazos y core. Doble progresión.',
   3, true, null)
on conflict (slug) do nothing;

-- Días del programa
insert into public.program_days (program_id, order_index, weekday, name, focus, is_optional, notes)
select p.id, v.oi, v.wd, v.nm, v.fc, v.opt, v.nt
from (values
  (0, 1, 'Torso', 'Pecho, espalda, hombros, brazos', false, 'Calentar: 5 min movilidad de hombros + 1 serie liviana.'),
  (1, 2, 'Piernas + Core', 'Cuádriceps, isquios, glúteo, core', false, null),
  (2, 5, 'Full body + brazos', 'Cuerpo completo con remate de brazos', false, null),
  (3, 7, 'Opcional: Brazos + Core', 'Superseries de brazos, circuito de core y cardio', true, 'No obligatorio. Para las semanas con ganas.')
) as v(oi, wd, nm, fc, opt, nt)
cross join (select id from public.programs where slug = 'preset-recomp') p
on conflict (program_id, order_index) do nothing;

-- Ejercicios por día — helper inline
-- Día 0: Torso
insert into public.program_day_exercises (program_day_id, exercise_id, order_index, target_sets, rep_low, rep_high, per_side, notes)
select pd.id, ex.id, v.oi, v.sets, v.lo, v.hi, v.ps, v.nt
from (values
  ('press-banca-plano-mancuernas', 0, 4, 8, 10, false, null),
  ('remo-un-brazo',                1, 4, 10, 12, true, null),
  ('press-hombros-sentado',        2, 3, 10, 12, false, null),
  ('press-inclinado-mancuernas',   3, 3, 10, 12, false, null),
  ('curl-biceps-pie',              4, 3, 10, 12, false, 'Prioridad: brazos'),
  ('extension-triceps-sobre-cabeza',5, 3, 10, 12, false, 'Prioridad: brazos'),
  ('elevaciones-laterales',        6, 3, 12, 15, false, 'Si queda tiempo')
) as v(slug, oi, sets, lo, hi, ps, nt)
join public.exercises ex on ex.slug = v.slug
join public.program_days pd on pd.order_index = 0
  and pd.program_id = (select id from public.programs where slug = 'preset-recomp')
on conflict (program_day_id, order_index) do nothing;

-- Día 1: Piernas + Core
insert into public.program_day_exercises (program_day_id, exercise_id, order_index, target_sets, rep_low, rep_high, per_side, notes)
select pd.id, ex.id, v.oi, v.sets, v.lo, v.hi, v.ps, v.nt
from (values
  ('sentadilla-goblet',          0, 4, 10, 12, false, null),
  ('peso-muerto-rumano',         1, 4, 10, 12, false, null),
  ('zancadas',                   2, 3, 10, 10, true, null),
  ('hip-thrust',                 3, 3, 12, 12, false, null),
  ('elevacion-talones',          4, 3, 15, 20, false, null),
  ('plancha',                    5, 3, 40, 60, false, 'Segundos por serie'),
  ('elevacion-piernas-acostado', 6, 3, 12, 15, false, null)
) as v(slug, oi, sets, lo, hi, ps, nt)
join public.exercises ex on ex.slug = v.slug
join public.program_days pd on pd.order_index = 1
  and pd.program_id = (select id from public.programs where slug = 'preset-recomp')
on conflict (program_day_id, order_index) do nothing;

-- Día 2: Full body + brazos
insert into public.program_day_exercises (program_day_id, exercise_id, order_index, target_sets, rep_low, rep_high, per_side, notes)
select pd.id, ex.id, v.oi, v.sets, v.lo, v.hi, v.ps, v.nt
from (values
  ('press-inclinado-mancuernas', 0, 3, 10, 12, false, null),
  ('remo-inclinado-2-mancuernas',1, 3, 10, 12, false, null),
  ('elevaciones-laterales',      2, 3, 12, 15, false, null),
  ('curl-martillo',              3, 3, 10, 12, false, 'Prioridad: brazos'),
  ('press-frances',              4, 3, 10, 12, false, 'Prioridad: brazos'),
  ('curl-concentrado',           5, 2, 12, 15, true, 'Remate'),
  ('sentadilla-goblet',          6, 3, 12, 12, false, 'Ligera'),
  ('crunch',                     7, 3, 15, 20, false, null)
) as v(slug, oi, sets, lo, hi, ps, nt)
join public.exercises ex on ex.slug = v.slug
join public.program_days pd on pd.order_index = 2
  and pd.program_id = (select id from public.programs where slug = 'preset-recomp')
on conflict (program_day_id, order_index) do nothing;

-- Día 3: Opcional brazos + core
insert into public.program_day_exercises (program_day_id, exercise_id, order_index, target_sets, rep_low, rep_high, per_side, notes)
select pd.id, ex.id, v.oi, v.sets, v.lo, v.hi, v.ps, v.nt
from (values
  ('curl-biceps-pie',               0, 4, 10, 12, false, 'Superserie con tríceps'),
  ('extension-triceps-sobre-cabeza',1, 4, 10, 12, false, 'Superserie con bíceps'),
  ('curl-martillo',                 2, 3, 10, 12, false, 'Superserie con press francés'),
  ('press-frances',                 3, 3, 10, 12, false, 'Superserie con martillo'),
  ('plancha',                       4, 3, 40, 60, false, 'Circuito de core'),
  ('elevacion-piernas-acostado',    5, 3, 12, 15, false, 'Circuito de core'),
  ('crunch-bicicleta',              6, 3, 15, 20, false, 'Circuito de core')
) as v(slug, oi, sets, lo, hi, ps, nt)
join public.exercises ex on ex.slug = v.slug
join public.program_days pd on pd.order_index = 3
  and pd.program_id = (select id from public.programs where slug = 'preset-recomp')
on conflict (program_day_id, order_index) do nothing;

-- ─────────────── Catálogo de badges ───────────────
insert into public.badges (code, name, description, icon, category, xp_reward, sort_order) values
  ('first_session',   'Primer paso',        'Completaste tu primera sesión.', 'flame', 'hitos', 50, 0),
  ('sessions_10',     '10 sesiones',        'Llegaste a 10 sesiones completadas.', 'dumbbell', 'hitos', 100, 1),
  ('sessions_50',     '50 sesiones',        '50 sesiones. Esto ya es identidad.', 'dumbbell', 'hitos', 250, 2),
  ('first_pr',        'Primer PR',          'Rompiste tu primer récord en un ejercicio.', 'trophy', 'fuerza', 50, 3),
  ('streak_7',        'Racha de 7',         '7 sesiones programadas seguidas.', 'flame', 'rachas', 75, 4),
  ('streak_30',       'Racha de 30',        '30 días de constancia con el split.', 'flame', 'rachas', 300, 5),
  ('first_month',     'Primer mes',         'Un mes completo entrenando.', 'calendar', 'hitos', 150, 6),
  ('perfect_week',    'Semana perfecta',    'Completaste todas las sesiones programadas de la semana.', 'star', 'rachas', 120, 7),
  ('arm_plus_1',      '+1 cm de brazo',     'Ganaste 1 cm de circunferencia de brazo.', 'trending-up', 'objetivos', 150, 8),
  ('waist_minus_2',   '-2 cm de cintura',   'Bajaste 2 cm de cintura.', 'trending-down', 'objetivos', 150, 9),
  ('creatine_30',     'Creatina 30 días',   '30 días seguidos de creatina.', 'pill', 'habitos', 120, 10),
  ('protein_week',    'Semana proteica',    '7 días seguidos cumpliendo la meta de proteína.', 'beef', 'habitos', 100, 11),
  ('steps_week',      'Caminante',          '7 días seguidos cumpliendo los pasos.', 'footprints', 'habitos', 80, 12),
  ('sleep_week',      'Buen descanso',      '7 días seguidos durmiendo tu meta.', 'moon', 'habitos', 80, 13),
  ('first_coach',     'Primera consulta',   'Pediste tu primer análisis al Coach IA.', 'sparkles', 'general', 30, 14)
on conflict (code) do nothing;
