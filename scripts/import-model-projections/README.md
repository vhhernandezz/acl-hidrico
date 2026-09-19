# import_model_projections.py

Carga un CSV de proyecciones del modelo (MODFLOW u otro) a la tabla `model_projections` del spoke Pucusana, vía `upsert` (correr el script dos veces con el mismo CSV no duplica filas).

## Formato del CSV (genérico — por ajustar)

Como todavía no existe el export real de MODFLOW, el script espera un CSV **ya transformado** a esta forma exacta:

```csv
well_code,parameter_code,model_name,scenario,projection_date,projected_value
IRHS-776,TDS,intrusion_salina_v1,base,2026-01-01,9600
IRHS-776,TDS,intrusion_salina_v1,optimista,2026-01-01,9400
IRHS-776,TDS,intrusion_salina_v1,pesimista,2026-01-01,9900
```

- `well_code`: debe existir en la tabla `wells` (ej. `IRHS-776`, `IRHS-777`).
- `parameter_code`: debe existir en `parameters` (ej. `TDS`).
- `scenario`: exactamente `optimista`, `base`, o `pesimista`.
- `projection_date`: formato `YYYY-MM-DD`.
- `projected_value`: numérico.

**Cuando tengas el CSV real que sale de tu post-proceso de MODFLOW**, lo más probable es que sus columnas no coincidan exactamente con esto. En ese caso, la forma más simple de adaptarlo es:
1. Compárteme una muestra del CSV real (aunque sea unas pocas filas).
2. Ajustamos la función `validate_row()` de este script para mapear tus columnas reales a las que espera `model_projections`, en vez de que tengas que transformar el CSV a mano cada vez.

## Instalación

```bash
cd scripts/import-model-projections
python -m venv venv
# Windows (Git Bash):
source venv/Scripts/activate
# Mac/Linux:
# source venv/bin/activate

pip install -r requirements.txt
```

## Configuración

```bash
cp .env.example .env
```

Edita `.env` y pon tu `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (proyecto de **Pucusana**, no el Hub). El service_role key está en Supabase → Project Settings → API → `service_role` (es distinto del `anon` key que usa el frontend).

## Uso

```bash
python import_model_projections.py ruta/a/tu_archivo.csv
```

El script:
1. Se conecta a Supabase y trae el catálogo real de pozos y parámetros.
2. Valida cada fila del CSV (código de pozo/parámetro existente, escenario válido, fecha, número).
3. Reporta las filas con error SIN cargarlas (no se detiene por una fila mala — carga las que sí son válidas y te dice cuáles fallaron y por qué).
4. Hace `upsert` de las filas válidas en lotes de 500.

## Ejemplo de prueba

Hay un CSV de ejemplo (datos ficticios) en `ejemplo_proyecciones.csv`, en esta misma carpeta, para probar el script de punta a punta antes de tener datos reales.
