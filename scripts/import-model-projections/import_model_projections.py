#!/usr/bin/env python3
"""
Importador de proyecciones del modelo (MODFLOW u otro) a Supabase.
Sesión 4-C — ACL Gestión Hídrica, spoke Pucusana.

Formato de CSV esperado (GENÉRICO — ajustar cuando se conozca el export
real de MODFLOW; ver README.md para cómo adaptar el mapeo de columnas):

    well_code,parameter_code,model_name,scenario,projection_date,projected_value
    IRHS-776,TDS,intrusion_salina_v1,base,2026-01-01,9600
    IRHS-776,TDS,intrusion_salina_v1,optimista,2026-01-01,9400
    IRHS-776,TDS,intrusion_salina_v1,pesimista,2026-01-01,9900

Uso:
    python import_model_projections.py ruta/al/archivo.csv

Requiere un archivo .env junto a este script (ver .env.example) con:
    SUPABASE_URL=https://xxxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...

IMPORTANTE: usa el service_role key, NO el anon key — este script bypassa
RLS a propósito porque es una herramienta de administrador que corre
localmente, no algo expuesto al navegador. Nunca subas el .env a git.
"""

import csv
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from supabase import create_client

VALID_SCENARIOS = {'optimista', 'base', 'pesimista'}
REQUIRED_COLUMNS = {'well_code', 'parameter_code', 'model_name', 'scenario', 'projection_date', 'projected_value'}
BATCH_SIZE = 500


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def load_supabase_client():
    load_dotenv()
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        fail("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el .env (ver .env.example)")
    return create_client(url, key)


def load_lookup_maps(supabase):
    """Trae los códigos reales de wells/parameters para validar y resolver a UUID."""
    wells = supabase.table('wells').select('id, code').execute().data
    parameters = supabase.table('parameters').select('id, code').execute().data
    well_map = {w['code']: w['id'] for w in wells}
    param_map = {p['code']: p['id'] for p in parameters}
    return well_map, param_map


def validate_row(row, line_num, well_map, param_map):
    errors = []

    well_code = (row.get('well_code') or '').strip()
    if well_code not in well_map:
        errors.append(f"well_code '{well_code}' no existe en la tabla wells")

    param_code = (row.get('parameter_code') or '').strip()
    if param_code not in param_map:
        errors.append(f"parameter_code '{param_code}' no existe en la tabla parameters")

    scenario = (row.get('scenario') or '').strip()
    if scenario not in VALID_SCENARIOS:
        errors.append(f"scenario '{scenario}' inválido (debe ser optimista/base/pesimista)")

    date_str = (row.get('projection_date') or '').strip()
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        errors.append(f"projection_date '{date_str}' no tiene formato YYYY-MM-DD")

    value_str = (row.get('projected_value') or '').strip()
    try:
        float(value_str)
    except ValueError:
        errors.append(f"projected_value '{value_str}' no es numérico")

    model_name = (row.get('model_name') or '').strip()
    if not model_name:
        errors.append("model_name vacío")

    if errors:
        return None, [f"Línea {line_num}: {e}" for e in errors]

    return {
        'well_id': well_map[well_code],
        'parameter_id': param_map[param_code],
        'model_name': model_name,
        'scenario': scenario,
        'projection_date': date_str,
        'projected_value': float(value_str),
    }, []


def main():
    if len(sys.argv) != 2:
        fail("Uso: python import_model_projections.py ruta/al/archivo.csv")

    csv_path = sys.argv[1]
    if not os.path.isfile(csv_path):
        fail(f"No se encontró el archivo: {csv_path}")

    print("Conectando a Supabase...")
    supabase = load_supabase_client()
    well_map, param_map = load_lookup_maps(supabase)
    print(f"  {len(well_map)} pozos y {len(param_map)} parámetros encontrados en el catálogo.")

    valid_rows = []
    all_errors = []

    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            fail(f"Faltan columnas en el CSV: {', '.join(sorted(missing))}. "
                 f"Columnas encontradas: {', '.join(reader.fieldnames or [])}")

        for line_num, row in enumerate(reader, start=2):  # fila 1 es el header
            parsed, errors = validate_row(row, line_num, well_map, param_map)
            if parsed:
                valid_rows.append(parsed)
            all_errors.extend(errors)

    print(f"\nFilas leídas: {len(valid_rows) + len(all_errors)}")
    print(f"Filas válidas: {len(valid_rows)}")
    print(f"Filas con error: {len(all_errors)}")

    if all_errors:
        print("\n--- Errores encontrados (estas filas NO se cargan) ---")
        for e in all_errors:
            print(f"  {e}")

    if not valid_rows:
        print("\nNada que cargar.")
        return

    print(f"\nCargando {len(valid_rows)} filas a Supabase (upsert, en lotes de {BATCH_SIZE})...")

    total_upserted = 0
    for i in range(0, len(valid_rows), BATCH_SIZE):
        batch = valid_rows[i:i + BATCH_SIZE]
        result = supabase.table('model_projections').upsert(
            batch,
            on_conflict='well_id,parameter_id,model_name,scenario,projection_date'
        ).execute()
        total_upserted += len(result.data)
        print(f"  Lote {i // BATCH_SIZE + 1}: {len(result.data)} filas")

    print(f"\nListo. {total_upserted} filas insertadas/actualizadas en model_projections.")


if __name__ == '__main__':
    main()
