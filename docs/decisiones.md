# ACL Gestión Hídrica — Decisiones y Estado del Proyecto

> Este documento consolida el historial de decisiones técnicas, convenciones y pendientes del proyecto, para que el desarrollo pueda continuar sin pérdida de contexto — incluyendo desde una máquina nueva o una sesión de chat nueva (que no tiene memoria de conversaciones anteriores).
>
> Última actualización: tras cerrar la Sesión 4-A (gráfico histórico de TDS), con una limitación de red pendiente de reprobar.

---

## 1. Arquitectura general

**Patrón: Hub & Spoke.**
- Cada planta (spoke) es un **proyecto Supabase físicamente separado**, con su propia base de datos, RLS, y Edge Functions. Pucusana es el primer spoke activo.
- El **Hub corporativo** es otro proyecto Supabase independiente que consolida indicadores de las 6 plantas, leyendo **por API** desde cada spoke (nunca por conexión directa de base de datos ni foreign keys entre spokes).
- 6 plantas ACL Perú en total (Pucusana + 5 más: Arequipa, Cusco, Iquitos, Trujillo, Zárate/Lima).

**Stack técnico:**
- Frontend: React + Vite, monorepo con **npm workspaces** (no pnpm ni Turborepo).
- Backend: Supabase (Postgres + Auth + Realtime + Edge Functions).
- Gráficos: Recharts.
- Email transaccional: Resend.
- Despliegue: Vercel, **un proyecto por app** (hub, pucusana, etc.) — pendiente de configurar realmente, hasta ahora todo corre en local (`localhost`).
- Repo: GitHub, `vhhernandezz/acl-hidrico`, un solo repositorio para todo (Hub + todos los spokes + frontend).

---

## 2. Estructura del repositorio

```
acl-hidrico/
├── apps/
│   ├── hub/                    ← app del Hub (bootstrapeada en la 3-B, puerto 5175)
│   ├── pucusana/                ← spoke Pucusana (activo, en desarrollo, puerto 5174)
│   └── zarate/                  ← reservado, vacío
├── packages/
│   ├── core/                    ← compartido por todas las apps (componentes, hooks, lib genéricos)
│   └── modules/
│       ├── intrusion-marina/    ← módulo específico de Pucusana
│       ├── calidad-superficial/ ← reservado
│       └── balance-hidrico/     ← reservado
├── supabase/
│   ├── pucusana/
│   │   └── supabase/            ← ⚠️ carpeta anidada, ver nota abajo
│   │       ├── config.toml
│   │       ├── migrations/      ← 0001 a 0015
│   │       └── functions/
│   │           └── datalogger-ingest/
│   └── hub/
│       └── supabase/            ← misma estructura anidada
│           ├── config.toml
│           ├── migrations/      ← 0001 a 0005
│           └── functions/
│               └── notify/
└── docs/
    └── decisiones.md            ← este archivo
```

**⚠️ Nota importante sobre la carpeta anidada `supabase/pucusana/supabase/` y `supabase/hub/supabase/`:** el Supabase CLI exige que exista una carpeta literalmente llamada `supabase/` (con `config.toml`, `migrations/`, `functions/`) **relativa a donde se ejecuta el comando**. Como organizamos el repo con `supabase/pucusana/` y `supabase/hub/` para separar los proyectos, tuvimos que anidar una carpeta `supabase/` más adentro de cada una. Es intencional, no un error.

Para correr comandos del CLI: `cd supabase/pucusana` (o `supabase/hub`) y desde ahí `supabase link`, `supabase functions deploy`, etc. En la laptop, todos estos comandos llevan el prefijo `npx` (ver sección 10).

**Si un proyecto nunca corrió `supabase init`**, la carpeta `supabase/` anidada con `config.toml` puede no existir todavía aunque ya tengas migraciones ahí copiadas a mano — hay que correr `supabase init` (o `npx supabase init`) parado en esa carpeta para que se genere `config.toml`, que es indispensable para `functions deploy`.

---

## 3. Convenciones establecidas

- **Nomenclatura de pozos:** el nombre oficial que usa la planta es **"Pozo 1"** y **"Pozo 3"** (no "Pozo 2", aunque la ficha técnica AWS los llama así). Código único: `IRHS-776` (Pozo 1) e `IRHS-777` (Pozo 3).
- **Coordenadas:** UTM (Norte/Este, zona 18S, datum WGS84), NO lat/long decimal.
- **Roles de usuario (spoke):** `admin`, `director_tecnico`, `operador_planta`, `visor`. El operador puede insertar lecturas pero no editarlas ni borrarlas.
- **Roles del Hub:** simplificado a `admin` y `visor`.
- **Fuente de datos (`readings.source`):** `manual`, `sensor`, `carga_masiva`, `laboratorio`.
- **Naming de tabla de alertas:** en Pucusana se llama `alerts` (inglés); en el Hub se llama `alarmas_activas` (español). Inconsistencia heredada, no bloquea nada.
- **Paleta visual:** teal/aqua sobre fondo arena (NO el tema oscuro del prototipo del cliente — se mantiene paleta clara por ahora).
- **Convención de commits:** `tipo(alcance): descripción` estilo Conventional Commits.
- **Secretos que nunca van a git:** cuando un valor secreto (API key, webhook secret) tiene que aparecer en una migración SQL por necesidad técnica, se deja un **placeholder** en el archivo versionado (ej. `REEMPLAZA_AQUI_TU_WEBHOOK_SECRET`), y el valor real solo se pega directo en el SQL Editor al momento de ejecutar — nunca se guarda de vuelta en el archivo del repo con el valor real.

---

## 4. Historial de sesiones completadas

### Fase 0 — Fundaciones
- **0-A**: Esquema SQL completo del spoke Pucusana (tablas, tipos, índices, RLS).
- **0-B**: Esquema SQL del Hub corporativo (`plantas`, `planta_status`, `alarmas_activas` + función de agregación).
- **0-C**: Estructura del monorepo (`apps/`, `packages/`, `README.md` con convenciones, incluyendo atajos `dev:pucusana` y `dev:hub` en el `package.json` raíz).

### Fase 1 — Ingesta de datos (Pucusana)
- **1-A**: Formulario de ingreso manual de caudal (`CaudalReadingForm.jsx`). **Bloqueado para envío real** — requiere sesión de Supabase Auth, que aún no existe.
- **1-B**: Endpoint de ingesta de datalogger (`Edge Function datalogger-ingest`), CE + nivel, autenticado por API key propio (tabla `dataloggers`). Probado en producción.
- **1-C**: Carga histórica de TDS/Cloruros/etc. 2014-2025 (924 lecturas), parseada desde Excel del cliente.
- **1-D**: Panel de estado de ingesta con semáforo de **recencia** (`IngestionStatusPanel.jsx` + vista `latest_readings_status`).

### Fase 2 — Dashboard operador (Pucusana)
- **2-A**: Gráfico de CE horaria con Recharts + Supabase Realtime (`CEHourlyChart.jsx`).
- **2-B**: Gráficos de Nivel de Napa + Caudal de Extracción (`OperationalCharts.jsx`, componentes genéricos reutilizables).
- **2-C**: Tarjetas KPI del operador (`OperatorKPICards.jsx`) — TDS, Nivel, Caudal con semáforo de **umbral operativo**.
- **2-D**: Layout final del operador (`OperatorLayout.jsx`) — header + sidebar + topbar, fiel al prototipo del cliente pero en paleta clara y con selector de pozo.

### Fase 3 — Alertas
- **3-A**: Función + trigger `evaluate_reading_threshold()` — evalúa cada lectura nueva contra `well_parameters` y gestiona el ciclo de vida completo en `alerts` (crear/escalar/resolver automático).
- **3-B**: Panel de Alarmas Activas del **Hub** (`AlarmasActivasPanel.jsx`), filtro por planta y nivel, botón "Reconocer" con Realtime. Bootstrap completo de `apps/hub` desde cero (nunca había existido), reconstrucción del esquema `0001_schema_hub.sql` (nunca se había subido a GitHub ni ejecutado en un proyecto real), seed del catálogo `plantas`.
- **3-C**: Configurador de Umbrales por pozo (`ThresholdConfig.jsx`, Pucusana) — tabla con todo el catálogo de parámetros, `upsert` en `well_parameters`, guardado fila por fila. Probado con Cloruros en Pozo 1 (valores de PRUEBA, no técnicos: atención 3500, crítico 5000 mg/L).
- **3-D**: Notificación por email (`Edge Function notify`, Hub) — envía correo vía Resend cuando una alarma **se vuelve** crítica (no cuando ya lo era, para no duplicar al reconocer). Sesión con bastante fricción de infraestructura:
  - El **Database Webhook nativo del Dashboard de Supabase falló** con `ERROR: 3F000: schema "supabase_functions" does not exist` (bug conocido de la plataforma, no de nuestro código). Se resolvió con una **alternativa por SQL directo**: un trigger que llama a `pg_net.http_post()` manualmente, reproduciendo el mismo payload que hubiera mandado el webhook nativo (migración `0005_notify_webhook_trigger.sql`).
  - Se intentó guardar el secreto del webhook con `alter database postgres set app.settings.webhook_secret = '...'` — **Supabase no permite esto** (`ERROR: 42501: permission denied`, requiere superusuario, que no tenemos en el plan hosted). Se resolvió embebiendo el secreto directo en la función, con un placeholder en el archivo versionado (ver convención en sección 3).
  - Se agregó el atajo `npm run dev:hub` al `package.json` raíz (ya existía sin que lo recordáramos — cuidado con revisar antes de agregar algo "nuevo").
  - Confirmado en producción: alarma crítica → llega correo (a spam, esperable por usar el dominio compartido `onboarding@resend.dev` sin dominio propio verificado); reconocer esa misma alarma → NO llega un segundo correo.

### Fase 4 — Análisis histórico
- **4-A**: Gráfico histórico de TDS 2014-2025 (`HistoricalChart.jsx`, Pucusana) — selector de pozo, 4 presets de rango (Todo/5a/2a/1a) + rango personalizado, líneas de referencia de umbral (atención/crítico) superpuestas usando los valores ya configurados en `well_parameters`. Sin migraciones nuevas, reutiliza datos existentes.
  - **Hallazgo de red sin resolver, específico de la laptop de viaje:** los presets de rango (todo menos "Todo") se quedan colgados indefinidamente en "Cargando serie", sin error visible. Diagnóstico exhaustivo confirmó que el código y los datos están correctos:
    - La query equivalente corre instantánea en el SQL Editor de Supabase.
    - La misma petición HTTP hecha con `curl` (bypasseando el navegador) responde en <1 segundo.
    - Falla igual en modo incógnito (descarta extensiones) y en dos navegadores distintos (Edge y Chrome).
    - Conclusión: algo a nivel de sistema/red en esta laptop de viaje intercepta específicamente peticiones de navegador con ciertos parámetros de query (posiblemente el mismo tipo de interferencia de antivirus/proxy corporativo que causó el problema de Scoop al inicio del viaje), pero no afecta llamadas directas por `curl`. **Pendiente: reprobar esta misma prueba (presets de rango) cuando Victor esté de vuelta en su red habitual**, para confirmar si el problema desaparece fuera de esta conexión de viaje.

---

## 5. Umbrales operativos definidos (well_parameters)

Desde la Sesión 3-C existe `ThresholdConfig.jsx`, así que estos valores **ya no requieren editar SQL a mano** — se configuran desde la UI, por pozo, para cualquier parámetro del catálogo.

| Parámetro | Dirección | Atención | Crítico | Estado |
|---|---|---|---|---|
| **TDS** | above | 18,750 mg/L | 25,000 mg/L | Definido (acuerdo temporal, 75% de 25,000) |
| **CAUDAL_EXTRACCION** | above | `caudal_habitual_m3h` del pozo | `capacidad_nominal_bomba_m3h` del pozo | Definido, específico por pozo |
| **NIVEL_AGUA** | above (napa más profunda = alerta) | — | — | PENDIENTE — sin valores numéricos aún |
| **CLORUROS** (Pozo 1 / IRHS-776 únicamente) | above | 3,500 mg/L | 5,000 mg/L | **Valores de PRUEBA** (Sesión 3-C, solo para validar el configurador) — no confirmado como criterio técnico real, y no se replicó a Pozo 3 |
| **CE** | — | — | — | No se usa directamente; se usa TDS como proxy. |
| Resto del catálogo (Sulfatos, Sodio, Calcio, Turbidez, pH, Selenio, Nivel Estático/Dinámico) | — | — | — | Sin configurar — se puede hacer en cualquier momento desde `ThresholdConfig.jsx` |

---

## 6. Pendientes explícitos (nada bloqueante hoy, pero no perder de vista)

1. **Revertir migraciones temporales anon** en cuanto exista Auth real, en AMBOS proyectos:
   - Pucusana: `0007_revert_temp_dev_anon_read_only.sql` (revierte la 0006, lectura) y `0015_revert_temp_dev_well_parameters_write_anon.sql` (revierte la 0014, escritura de umbrales).
   - Hub: `0004_revert_temp_dev_anon_access.sql` (revierte la 0003).
2. **Login / Supabase Auth** — pendiente en los DOS proyectos. Bloqueante real para: (a) que el formulario de caudal (1-A) pueda enviar datos de verdad, (b) que el botón "Reconocer" del Hub y el guardado de umbrales (3-C) funcionen con usuario real (hoy son anon), (c) poder cerrar el punto 1 sin romper ninguna app.
3. **Umbral de Nivel de Napa** — falta que Victor defina los valores numéricos.
4. **Factor de conversión CE↔TDS** — cuando se defina, migrar el umbral de la tarjeta de TDS a CE.
5. **Dónde viven el formulario de caudal (1-A), el panel de ingesta (1-D) y el configurador de umbrales (3-C)** dentro de `OperatorLayout` — hoy están montados aparte en `main.jsx`, no integrados al layout final.
6. **Vista dual de ambos pozos a la vez** (como muestra el prototipo del cliente) — hoy cada gráfico/tarjeta usa selector de un pozo a la vez.
7. **Valores de umbral para el resto del catálogo** — la herramienta ya existe (3-C), falta que Victor defina los valores técnicos correctos. El de Cloruros en Pozo 1 es de PRUEBA, falta replicarlo (con valor correcto) en Pozo 3.
8. **Función de sincronización Hub↔spoke** — sigue sin existir. `alarmas_activas` y `planta_status` del Hub no se actualizan solas; hoy solo tienen datos de prueba insertados a mano. Sin esto, las alarmas reales de Pucusana (generadas por el trigger de la 3-A) nunca llegan al Hub, y por lo tanto tampoco disparan el email de la 3-D en la vida real.
9. **Layout/shell propio del Hub** (análogo a `OperatorLayout`) — el panel de alarmas y cualquier futuro componente del Hub se montan solos, sin header/sidebar/topbar.
10. **Dominio propio verificado en Resend** — hoy los correos salen de `onboarding@resend.dev` y caen en spam. Verificar un dominio (ej. `acl-hidrico.pe`) resolvería esto para producción.
11. **"Reconocedor asignado" real** — la 3-D usa un correo único fijo (`NOTIFY_EMAIL_TO`) para todas las alarmas, como decisión consciente de simplicidad. Falta diseñar cómo se asigna un responsable real (¿por planta? ¿por rol?) cuando haga falta.
12. **Dataloggers de prueba** (`DL-TEST-01`/`DL-TEST-02`) — reemplazar por dispositivos reales cuando lleguen.
13. **Selenio Total histórico** — pendiente si se necesita cargarlo (riesgo de duplicados con el dataset ya cargado).
14. **Consolidar nomenclatura `alerts` (Pucusana) vs `alarmas_activas` (Hub)** — cosmético, no urgente.
15. **Reprobar los presets de rango de `HistoricalChart.jsx` (Sesión 4-A) fuera de la red de viaje** — funcionalmente el código está verificado correcto (SQL Editor + `curl` exitosos), pero nunca se confirmó visualmente en el navegador por una interferencia de red/sistema en la laptop de viaje. Si el problema persiste también en la red habitual, ahí sí habría que investigar más a fondo (por ejemplo, revisar si supabase-js agrega algo distinto a la petición que un antivirus/proxy esté bloqueando específicamente).

---

## 7. Credenciales y secretos (NO se guardan aquí — solo referencia de dónde viven)

| Secreto | Dónde vive | Notas |
|---|---|---|
| `apps/pucusana/.env` (Supabase URL + anon key) | Local en cada máquina, gitignored | Copiar manualmente entre máquinas |
| `apps/hub/.env` (Supabase URL + anon key — proyecto DISTINTO al de Pucusana) | Local en cada máquina, gitignored | Ídem |
| Sesión de `supabase login` (o `npx supabase login` en la laptop) | Local, por máquina | Se re-autentica con el navegador en cada máquina nueva |
| PAT de GitHub embebido en el remoto git | Local, por máquina — **solo desktop** | La laptop usa Git Credential Manager (login vía navegador) en vez de esto |
| API keys de `DL-TEST-01` / `DL-TEST-02` | Perdidas si no se guardaron aparte — solo el hash SHA-256 vive en la tabla `dataloggers` | Si se necesitan, regenerar y actualizar el hash con `UPDATE` |
| Contraseña de la base de datos Postgres (Pucusana/Hub) | La que se configuró al crear cada proyecto Supabase | Necesaria para `supabase link` en máquinas nuevas |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `WEBHOOK_SECRET` | Supabase Secrets del proyecto Hub (`supabase secrets set`) | No recuperables una vez guardados — si se pierden, regenerar y volver a `secrets set` |
| Valor real de `WEBHOOK_SECRET` embebido en la función `trigger_notify_critical_alarm` | Solo dentro de la base de datos del Hub (ejecutado una vez en SQL Editor) | El archivo `0005_notify_webhook_trigger.sql` en git tiene un PLACEHOLDER, no el valor real |

---

## 8. Scripts de utilidad y SQL de prueba (no versionados en el repo)

- **`simulate_datalogger.sh`** — simula varias lecturas de CE/nivel distribuidas en las últimas horas.
- **`test_caudal_readings.sql`** — inserta lecturas de caudal de prueba directo por SQL.
- **`test_alarmas_hub.sql`** — inserta alarmas de prueba en `alarmas_activas` del Hub.

Ninguno se guardó dentro del repo Git — si se necesitan en una máquina nueva, hay que regenerarlos o copiarlos manualmente.

---

## 9. Próxima sesión sugerida

- Función de sincronización Hub↔Pucusana (le daría datos reales a los paneles/notificaciones del Hub, hoy solo con datos de prueba).
- Sesión de Login/Auth (desbloquea 1-A, "Reconocer", guardado de umbrales, y permite cerrar los puntos pendientes de RLS temporal).
- Definir con Victor los valores reales de umbral pendientes (Nivel de Napa, Cloruros definitivo, resto del catálogo).
- Layout/shell propio del Hub (análogo a `OperatorLayout`).
- Verificar dominio propio en Resend para que los correos no caigan en spam.
- Reprobar los presets de `HistoricalChart.jsx` en la red habitual de Victor (ver pendiente #15).

---

## 10. Trabajo en dos máquinas (desktop + laptop)

**Regla de oro: `git push` al final de cada sesión de trabajo, sin excepción.** Ya causó un problema real una vez (sesiones 2-D y 3-A se habían quedado solo en la desktop).

**Diferencias de configuración entre máquinas (normal, no es un problema):**
- **Supabase CLI**: desktop usa **Scoop**. La laptop no pudo (Scoop fallaba repetidamente clonando su propio repo base — probablemente antivirus/OneDrive) y se resolvió instalándolo vía **npm**: `npm install -D supabase`, usando **`npx supabase ...`** en vez de `supabase ...` en TODOS los comandos del CLI en la laptop (incluyendo `secrets set`, `functions deploy`, etc.).
- **Autenticación de GitHub**: desktop usa un PAT embebido en la URL del remoto. La laptop usa Git Credential Manager (login vía navegador).
- **`.env`** de cada app: no viaja con git, se recrea manualmente en cada máquina.

**Conflictos de merge esperables en `package-lock.json`:** nunca editarlo a mano — en un conflicto, borrarlo, correr `npm install` para regenerarlo, y commitear. `package.json` sí se fusiona normalmente.

**Lección — verificar, no asumir, que un archivo llegó a GitHub:** varias veces un archivo generado en el chat (la migración `0001_schema_hub.sql`, y `docs/decisiones.md` la primera vez) se quedó solo como descarga suelta, sin llegar nunca al repo. Regla práctica: el paso "cópialo a tu repo y haz `git add`/`commit`/`push`" no está completo hasta que lo confirmes viéndolo en GitHub.com.

**Lección — cuidado al pegar instrucciones multilínea en archivos de configuración (`.toml`, `.json`):** más de una vez una instrucción de "agrega estas dos líneas" terminó pegada en una sola línea (ej. `[functions.notify] verify_jwt = false` en vez de dos líneas separadas), rompiendo el formato del archivo. Siempre revisar que cada línea quedó en su propio renglón antes de guardar.

**Límites de la plataforma Supabase descubiertos en la Sesión 3-D (aplican a cualquier máquina):**
- El Database Webhook nativo del Dashboard puede fallar con un bug de plataforma (`schema "supabase_functions" does not exist`) — la alternativa confiable es un trigger SQL manual con `pg_net.http_post()`.
- No se puede usar `ALTER DATABASE ... SET app.settings.xxx` en Supabase hosted (requiere superusuario) — para pasar un secreto a una función de trigger, hay que embeberlo directo en la función (con la convención de placeholder de la sección 3), no vía variables de sesión de Postgres.
