# ACL Gestión Hídrica — Decisiones y Estado del Proyecto

> Este documento consolida el historial de decisiones técnicas, convenciones y pendientes del proyecto, para que el desarrollo pueda continuar sin pérdida de contexto — incluyendo desde una máquina nueva o una sesión de chat nueva (que no tiene memoria de conversaciones anteriores).
>
> Última actualización: tras cerrar la Sesión 4-B (comparador observado vs. proyección del modelo).

---

## 1. Arquitectura general

**Patrón: Hub & Spoke.**
- Cada planta (spoke) es un **proyecto Supabase físicamente separado**, con su propia base de datos, RLS, y Edge Functions. Pucusana es el primer spoke activo.
- El **Hub corporativo** es otro proyecto Supabase independiente que consolida indicadores de las 6 plantas, leyendo **por API** desde cada spoke.
- 6 plantas ACL Perú en total (Pucusana + 5 más: Arequipa, Cusco, Iquitos, Trujillo, Zárate/Lima).

**Stack técnico:**
- Frontend: React + Vite, monorepo con **npm workspaces**.
- Backend: Supabase (Postgres + Auth + Realtime + Edge Functions).
- Gráficos: Recharts.
- Email transaccional: Resend.
- Despliegue: Vercel (pendiente de configurar realmente, hasta ahora todo corre en local).
- Repo: GitHub, `vhhernandezz/acl-hidrico`, un solo repositorio para todo.

---

## 2. Estructura del repositorio

```
acl-hidrico/
├── apps/
│   ├── hub/                    ← app del Hub (bootstrapeada en la 3-B, puerto 5175)
│   ├── pucusana/                ← spoke Pucusana (activo, puerto 5174)
│   └── zarate/                  ← reservado, vacío
├── packages/
│   ├── core/
│   └── modules/
│       ├── intrusion-marina/
│       ├── calidad-superficial/
│       └── balance-hidrico/
├── supabase/
│   ├── pucusana/
│   │   └── supabase/            ← ⚠️ carpeta anidada, ver nota abajo
│   │       ├── config.toml
│   │       ├── migrations/      ← 0001 a 0017
│   │       └── functions/
│   │           └── datalogger-ingest/
│   └── hub/
│       └── supabase/
│           ├── config.toml
│           ├── migrations/      ← 0001 a 0005
│           └── functions/
│               └── notify/
└── docs/
    └── decisiones.md
```

**⚠️ Nota sobre la carpeta anidada `supabase/pucusana/supabase/` y `supabase/hub/supabase/`:** el Supabase CLI exige una carpeta literalmente llamada `supabase/` (con `config.toml`, `migrations/`, `functions/`) **relativa a donde se ejecuta el comando**. Es intencional, no un error.

Para correr comandos del CLI: `cd supabase/pucusana` (o `supabase/hub`) y desde ahí `supabase link`, `supabase functions deploy`, etc. En la laptop, todos llevan el prefijo `npx`.

Si un proyecto nunca corrió `supabase init`, la carpeta `supabase/` anidada con `config.toml` puede no existir aunque ya tengas migraciones copiadas a mano — hay que correr `supabase init` (o `npx supabase init`) parado ahí.

---

## 3. Convenciones establecidas

- **Nomenclatura de pozos:** nombre oficial "Pozo 1" y "Pozo 3" (no "Pozo 2"). Código: `IRHS-776` (Pozo 1) e `IRHS-777` (Pozo 3).
- **Coordenadas:** UTM (Norte/Este, zona 18S, datum WGS84), NO lat/long decimal.
- **Roles de usuario (spoke):** `admin`, `director_tecnico`, `operador_planta`, `visor`.
- **Roles del Hub:** `admin` y `visor`.
- **Fuente de datos (`readings.source`):** `manual`, `sensor`, `carga_masiva`, `laboratorio`.
- **Naming de tabla de alertas:** Pucusana usa `alerts` (inglés); Hub usa `alarmas_activas` (español). No bloquea nada.
- **Paleta visual:** teal/aqua sobre fondo arena.
- **Convención de commits:** `tipo(alcance): descripción`.
- **Secretos que nunca van a git:** placeholder en el archivo versionado, valor real solo pegado en el SQL Editor al ejecutar.
- **Estructuras creadas antes de tener datos reales:** se construyen flexibles (campos de texto libre en vez de enums rígidos donde haya incertidumbre), documentando qué es prueba vs. dato real.

---

## 4. Historial de sesiones completadas

### Fase 0 — Fundaciones
- **0-A**: Esquema SQL completo del spoke Pucusana.
- **0-B**: Esquema SQL del Hub corporativo.
- **0-C**: Estructura del monorepo.

### Fase 1 — Ingesta de datos (Pucusana)
- **1-A**: Formulario de ingreso manual de caudal. Bloqueado para envío real (requiere Auth).
- **1-B**: Endpoint de ingesta de datalogger (`datalogger-ingest`), CE + nivel. Probado en producción.
- **1-C**: Carga histórica de TDS/Cloruros/etc. 2014-2025 (924 lecturas).
- **1-D**: Panel de estado de ingesta con semáforo de recencia.

### Fase 2 — Dashboard operador (Pucusana)
- **2-A**: Gráfico de CE horaria con Recharts + Realtime.
- **2-B**: Gráficos de Nivel de Napa + Caudal de Extracción.
- **2-C**: Tarjetas KPI del operador — TDS, Nivel, Caudal con semáforo de umbral operativo.
- **2-D**: Layout final del operador (`OperatorLayout.jsx`).

### Fase 3 — Alertas
- **3-A**: Función + trigger `evaluate_reading_threshold()`.
- **3-B**: Panel de Alarmas Activas del Hub. Bootstrap completo de `apps/hub`, reconstrucción de `0001_schema_hub.sql`.
- **3-C**: Configurador de Umbrales por pozo (`ThresholdConfig.jsx`).
- **3-D**: Notificación por email (Edge Function `notify`, Hub) — trigger SQL manual con `pg_net` (el Database Webhook nativo falló por bug de plataforma); secreto embebido con placeholder.

### Fase 4 — Análisis histórico
- **4-A**: Gráfico histórico de TDS 2014-2025 (`HistoricalChart.jsx`) — selector de pozo, presets de rango + rango personalizado, líneas de referencia de umbral. Sin migraciones nuevas.
  - **Hallazgo de red sin resolver, específico de la laptop de viaje:** los presets de rango se quedan colgados en "Cargando serie". Diagnóstico confirmó código y datos correctos (SQL Editor y `curl` responden instantáneo), falla igual en incógnito y en Edge/Chrome → apunta a interferencia de red/sistema de la conexión de viaje. **Pendiente: reprobar en la red habitual de Victor.**
- **4-B**: Comparador Observado vs. Proyección del modelo (`ModelComparison.jsx`) — línea sólida de lo observado, línea punteada del escenario "base", banda sombreada entre "optimista"/"pesimista" (min/max, sin asumir cuál es mayor), línea de referencia "Hoy". Nueva tabla `model_projections` (migración `0016`), diseñada flexible porque el estudio hidrogeológico formal todavía no existe. Probado con datos de prueba (2 meses, luego 24 meses con banda creciente) — confirmado visualmente funcionando.

---

## 5. Umbrales operativos definidos (well_parameters)

Configurables desde `ThresholdConfig.jsx` (Sesión 3-C), sin necesidad de SQL manual.

| Parámetro | Dirección | Atención | Crítico | Estado |
|---|---|---|---|---|
| **TDS** | above | 18,750 mg/L | 25,000 mg/L | Definido (acuerdo temporal, 75% de 25,000) |
| **CAUDAL_EXTRACCION** | above | `caudal_habitual_m3h` del pozo | `capacidad_nominal_bomba_m3h` del pozo | Definido, específico por pozo |
| **NIVEL_AGUA** | above (napa más profunda = alerta) | — | — | PENDIENTE |
| **CLORUROS** (solo Pozo 1) | above | 3,500 mg/L | 5,000 mg/L | Valores de PRUEBA, no confirmado, falta replicar en Pozo 3 |
| **CE** | — | — | — | No se usa directamente; se usa TDS como proxy |
| Resto del catálogo | — | — | — | Sin configurar |

---

## 6. Pendientes explícitos (nada bloqueante hoy, pero no perder de vista)

1. **Revertir migraciones temporales anon** en cuanto exista Auth real:
   - Pucusana: `0007` (lectura general), `0015` (escritura de umbrales), `0017` (lectura de `model_projections`).
   - Hub: `0004`.
2. **Login / Supabase Auth** — pendiente en los DOS proyectos.
3. **Umbral de Nivel de Napa** — falta definición de Victor.
4. **Factor de conversión CE↔TDS.**
5. **Dónde viven el formulario de caudal (1-A), panel de ingesta (1-D), configurador de umbrales (3-C) y comparador de modelo (4-B)** dentro de `OperatorLayout`.
6. **Vista dual de ambos pozos a la vez.**
7. **Valores de umbral para el resto del catálogo.**
8. **Función de sincronización Hub↔spoke** — sigue sin existir.
9. **Layout/shell propio del Hub.**
10. **Dominio propio verificado en Resend.**
11. **"Reconocedor asignado" real** (hoy: correo único fijo).
12. **Dataloggers de prueba** — reemplazar cuando lleguen los reales.
13. **Selenio Total histórico** — pendiente si se necesita.
14. **Consolidar nomenclatura `alerts` vs `alarmas_activas`.**
15. **Reprobar los presets de rango de `HistoricalChart.jsx` (4-A) fuera de la red de viaje.**
16. **Cargar los valores reales del estudio hidrogeológico en `model_projections`** cuando exista, reemplazando los datos de prueba (`model_name = 'intrusion_salina_v1'`, borrables con `DELETE FROM model_projections WHERE model_name = 'intrusion_salina_v1'`). Usar `plantilla_model_projections.sql` como referencia de formato.

---

## 7. Credenciales y secretos (NO se guardan aquí — solo referencia de dónde viven)

| Secreto | Dónde vive | Notas |
|---|---|---|
| `apps/pucusana/.env` / `apps/hub/.env` | Local por máquina, gitignored | Proyectos Supabase DISTINTOS |
| Sesión de `supabase login` (`npx supabase login` en laptop) | Local, por máquina | — |
| PAT de GitHub embebido en el remoto git | Local — solo desktop | Laptop usa Git Credential Manager |
| API keys de `DL-TEST-01` / `DL-TEST-02` | Solo hash SHA-256 en `dataloggers` | Si se pierden, regenerar |
| Contraseña de la base de datos Postgres | La configurada al crear el proyecto | Necesaria para `supabase link` |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `WEBHOOK_SECRET` | Supabase Secrets del Hub | No recuperables una vez guardados |
| Valor real de `WEBHOOK_SECRET` embebido en `trigger_notify_critical_alarm` | Solo en la base del Hub | El archivo en git tiene un PLACEHOLDER |

---

## 8. Scripts de utilidad y SQL de prueba (no versionados en el repo)

- **`simulate_datalogger.sh`** — simula lecturas de CE/nivel.
- **`test_caudal_readings.sql`** — lecturas de caudal de prueba.
- **`test_alarmas_hub.sql`** — alarmas de prueba en el Hub.
- **`plantilla_model_projections.sql`** — formato de referencia (sin datos reales) para cargar proyecciones.
- **`plantilla_model_projections_24meses.sql`** — datos de PRUEBA (24 meses, banda creciente) usados para verificar `ModelComparison.jsx`. Borrar con el `DELETE` incluido cuando ya no se necesiten.

Ninguno se guardó dentro del repo Git.

---

## 9. Próxima sesión sugerida

- Función de sincronización Hub↔Pucusana.
- Sesión de Login/Auth.
- Definir con Victor los valores reales de umbral pendientes.
- Layout/shell propio del Hub.
- Verificar dominio propio en Resend.
- Reprobar los presets de `HistoricalChart.jsx` en la red habitual de Victor.
- Cargar valores reales del estudio hidrogeológico en `model_projections` cuando estén disponibles.

---

## 10. Trabajo en dos máquinas (desktop + laptop)

**Regla de oro: `git push` al final de cada sesión de trabajo, sin excepción.**

**Diferencias de configuración entre máquinas:**
- **Supabase CLI**: desktop usa Scoop. Laptop usa npm (`npm install -D supabase`), con **`npx supabase ...`** en TODOS los comandos.
- **Autenticación de GitHub**: desktop usa PAT embebido. Laptop usa Git Credential Manager.
- **`.env`** de cada app: no viaja con git, se recrea manualmente.

**Conflictos de merge en `package-lock.json`:** nunca editar a mano — borrar, `npm install`, commitear.

**Lección — verificar, no asumir, que un archivo llegó a GitHub:** varias veces un archivo se quedó solo como descarga suelta. Regla práctica: no está completo hasta confirmarlo en GitHub.com.

**Lección — cuidado al pegar instrucciones multilínea en archivos de configuración:** revisar siempre que cada línea quedó en su propio renglón antes de guardar.

**Límites de la plataforma Supabase descubiertos en la Sesión 3-D:**
- El Database Webhook nativo del Dashboard puede fallar con un bug de plataforma (`schema "supabase_functions" does not exist`) — alternativa: trigger SQL manual con `pg_net.http_post()`.
- No se puede usar `ALTER DATABASE ... SET app.settings.xxx` en Supabase hosted (requiere superusuario) — el secreto se embebe directo en la función.

**Limitación de red descubierta en la Sesión 4-A (específica de esta laptop/conexión de viaje):** ciertas peticiones del navegador con parámetros de filtro por fecha se quedan colgadas indefinidamente, mientras que la misma consulta por SQL Editor o por `curl` responde instantánea. No reproducido aún fuera de esta red — pendiente confirmar si es exclusivo del viaje o algo permanente de la laptop.
