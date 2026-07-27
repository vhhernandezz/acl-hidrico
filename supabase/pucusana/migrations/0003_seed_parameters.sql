-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0003: seed del catálogo 'parameters'
-- Basado en: ANALISIS_MENSUAL_AGUA_DE_POZOS_2015-2025 (Cloruros, N-Nitratos,
-- Sulfatos, TDS, Calcio, Sodio, Turbidez, pH) + parámetros operativos
-- necesarios para el formulario de ingreso manual (Sesión 1-A).
-- ============================================================================

insert into public.parameters (code, name, category, unit, description, is_active) values
  ('CLORUROS',         'Cloruros',                    'intrusion_salina',       'mg/L', 'Indicador principal de intrusión salina en el acuífero.', true),
  ('SODIO',            'Sodio',                        'intrusion_salina',       'mg/L', 'Asociado a intrusión de agua marina.', true),
  ('TDS',              'Sólidos Totales Disueltos',    'intrusion_salina',       'mg/L', 'Indicador general de salinidad/mineralización del agua.', true),
  ('N_NITRATOS',       'Nitrógeno de Nitratos',        'calidad_fisicoquimica',  'mg/L', NULL, true),
  ('SULFATOS',         'Sulfatos',                     'calidad_fisicoquimica',  'mg/L', NULL, true),
  ('CALCIO',           'Calcio',                       'calidad_fisicoquimica',  'mg/L', NULL, true),
  ('TURBIDEZ',         'Turbidez',                     'calidad_fisicoquimica',  'NTU',  NULL, true),
  ('PH',               'pH',                            'calidad_fisicoquimica',  'pH',   NULL, true),
  ('SELENIO_TOTAL',    'Selenio Total',                'calidad_fisicoquimica',  'mg/L', NULL, true),
  ('CAUDAL_EXTRACCION','Caudal de Extracción',         'caudal',                 'm³/h', 'Caudal medido en campo durante el bombeo. Usado por el formulario de ingreso manual.', true),
  ('NIVEL_ESTATICO',   'Nivel Estático',               'nivel',                  'm',    'Nivel de agua en pozo en reposo (m bgl).', true),
  ('NIVEL_DINAMICO',   'Nivel Dinámico',               'nivel',                  'm',    'Nivel de agua en pozo durante bombeo (m bgl).', true)
on conflict (code) do nothing;
