-- ============================================================================
-- ACL GESTIÓN HÍDRICA — SPOKE PUCUSANA
-- Migración 0004: seed de 'wells' con los 2 pozos operativos reales,
-- tomado de la ficha AWS 1.1.1 (5.1 Abastecimiento privado de agua - Pozos).
--
-- Nota de nomenclatura: el pozo IRHS-777 aparece como "Pozo 2" en la ficha
-- AWS, pero el nombre oficial que usa la planta (y el que aparece en el
-- histórico de calidad de agua) es "Pozo 3". Se usa ese nombre en 'name'
-- para evitar confusión en el dashboard; el código IRHS-777 identifica al
-- pozo de forma única e inequívoca. El detalle queda documentado en 'notes'.
--
-- Los pozos 3 y 4 mencionados en la ficha AWS (columnas vacías, sin datos
-- operativos aún) NO se siembran aquí; se agregan cuando entren en operación.
-- ============================================================================

insert into public.wells (
  code, name, status, depth_m, aquifer_unit, commissioned_on,
  utm_norte, utm_este, utm_zona, utm_datum,
  nivel_estatico_referencia_m, nivel_dinamico_referencia_m,
  caudal_habitual_m3h, capacidad_nominal_bomba_m3h, costo_agua_usd_m3,
  ficha_tecnica, notes
) values
  (
    'IRHS-776', 'Pozo 1', 'activo', 118, 'Acuífero Chilca (sedimentos cuaternarios: depósitos aluviales, fluvio-aluviales, eólicos y marinos, hasta 352 m de espesor)', '2013-01-01',
    8619309.784, 310061.691, '18S', 'WGS84',
    21.6, 27.8,
    202, 218, 0.08,
    jsonb_build_object(
      'material_construccion', 'Acero inoxidable DN 200',
      'intervalo_filtro_m', '42 - 56',
      'tipo_bomba', 'Well Pumps 8F90X904C',
      'profundidad_bomba_m', 63,
      'valvula_retorno', true,
      'uso_suelo_acuifero', 'Industrial',
      'sensores_instalados', 'eC (nivel estático/dinámico)',
      'datos_nivel_registrados', '2017 - 2024',
      'ultima_prueba_bombeo', 'Set-2014',
      'ultima_inspeccion', '5 y 6 de octubre del 2024 (incompleta, avanzó hasta -26 m de -118 m)',
      'problemas_calidad', 'Corrosión en empalmes/soldaduras/costuras; fisuras en tramo revisado; falta filtro de aire en boca de pozo; verticalidad no evaluada',
      'limitaciones_uso', 'Caracterización del agua (Alto TDS)'
    ),
    'Fuente: Ficha AWS 1.1.1 - 5.1 Abastecimiento privado de agua. Estudio hidrogeológico del acuífero Chilca (ANA, 2019): almacenamiento total ~69.19 hm³.'
  ),
  (
    'IRHS-777', 'Pozo 3', 'activo', 117, 'Acuífero Chilca (sedimentos cuaternarios: depósitos aluviales, fluvio-aluviales, eólicos y marinos, hasta 352 m de espesor)', '2013-01-01',
    8619657.534, 309974.578, '18S', 'WGS84',
    21.9, 27.3,
    193, 218, 0.08,
    jsonb_build_object(
      'material_construccion', 'Acero inoxidable DN 200',
      'intervalo_filtro_m', '42 - 56',
      'tipo_bomba', 'Well Pumps 8F90X904C',
      'profundidad_bomba_m', 63,
      'valvula_retorno', true,
      'uso_suelo_acuifero', 'Industrial',
      'sensores_instalados', 'eC (nivel estático/dinámico)',
      'datos_nivel_registrados', '2017 - 2024',
      'ultima_prueba_bombeo', 'Set-2014',
      'ultima_inspeccion', '18 al 20 de octubre del 2024 (incompleta, avanzó hasta -77 m de -117 m)',
      'problemas_calidad', 'Corrosión en empalmes/soldaduras/costuras; incrustación con carbonatos a -44.3 y -53.8 m; pérdida de verticalidad de -3 a -9 m',
      'limitaciones_uso', 'Caracterización del agua (Alto TDS)'
    ),
    'Fuente: Ficha AWS 1.1.1 - 5.1 Abastecimiento privado de agua, donde figura como "Pozo 2 IRHS 777". La planta rotula este pozo como "Pozo 3", que es el nombre oficial usado en operación y en el histórico de calidad de agua 2014-2025. Estudio hidrogeológico del acuífero Chilca (ANA, 2019): almacenamiento total ~69.19 hm³.'
  )
on conflict (code) do nothing;
