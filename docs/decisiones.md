# ACL Gestión Hídrica — Decisiones y Estado del Proyecto

> Este documento consolida el historial de decisiones técnicas, convenciones y pendientes del proyecto, para que el desarrollo pueda continuar sin pérdida de contexto — incluyendo desde una máquina nueva o una sesión de chat nueva (que no tiene memoria de conversaciones anteriores).
>
> Última actualización: tras cerrar la Sesión 5-B (login real en Pucusana y Hub).

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
│   ├── hub/                    ← app del Hub (puerto 5175)
│   ├── pucusana/                ← spoke Pucusana (puerto 5174)
│   └── zarate/                  ← reservado, vacío
├── packages/
│   ├── core/                    ← compartido por todas las apps
│   │   └── src/
│   │       ├── auth/            ← createAuthContext.jsx (Sesión 5-B)
│   │       └── components/      ← LoginForm.jsx (Sesión 5-B), otros
│   └── modules/
│       ├── intrusion-marina/
│       ├── calidad-superficial/
│       └── balance-hidrico/
├── supabase/
│   ├── pucusana/
│   │   └── supabase/            ← ⚠️ carpeta anidada, ver nota abajo
│   │       ├── config.toml
│   │       ├── migrations/      ← 0001 a 0019
│   │       └── functions/
│   │           └── datalogger-ingest/
│   └── hub/
│       └── supabase/
│           ├── config.toml
│           ├── migrations/      ← 0001 a 0004
│           └── functions/
│               └── notify/
├── scripts/
│   └── import-model-projections/ ← script Python (Sesión 4-C)
└── docs/
    ├── decisiones.md
    └── AUTH.md                   ← modelo de roles, cómo crear usuarios (Sesión 5-A)
```

**⚠️ Nota sobre la carpeta anidada `supabase/pucusana/supabase/` y `supabase/hub/supabase/`:** el Supabase CLI exige una carpeta literalmente llamada `supabase/` (con `config.toml`, `migrations/`, `functions/`) **relativa a donde se ejecuta el comando**. Es intencional.

Para correr comandos del CLI: `cd supabase/pucusana` (o `supabase/hub`) y desde ahí `supabase link`, `supabase functions deploy`, etc. En la laptop, todos llevan el prefijo `npx`.

---

## 3. Convenciones establecidas

- **Nomenclatura de pozos:** "Pozo 1" (`IRHS-776`) y "Pozo 3" (`IRHS-777`, no "Pozo 2").
- **Coordenadas:** UTM (zona 18S, datum WGS84), NO lat/long decimal.
- **Roles (Pucusana):** `admin`, `director_tecnico`, `operador_planta`, `visor`.
- **Roles (Hub):** `admin`, `visor`.
- **El rol SIEMPRE se guarda en la tabla `profiles`, NUNCA en `user_metadata`** — `user_metadata` es editable por el propio usuario desde el cliente, sería una vulnerabilidad de autoescalación de privilegios. Decisión tomada explícitamente en la Sesión 5-A.
- **Fuente de datos (`readings.source`):** `manual`, `sensor`, `carga_masiva`, `laboratorio`.
- **Naming de tabla de alertas:** Pucusana usa `alerts`; Hub usa `alarmas_activas`.
- **Paleta visual:** teal/aqua sobre fondo arena.
- **Convención de commits:** `tipo(alcance): descripción`.
- **Secretos que nunca van a git:** placeholder en el archivo versionado, valor real solo pegado en el SQL Editor al ejecutar.
- **Estructuras creadas antes de tener datos reales:** flexibles (campos de texto libre en vez de enums rígidos donde haya incertidumbre), documentando qué es prueba vs. dato real.
- **Políticas RLS temporales "anon"** (usadas en varias sesiones para poder probar sin login): **todas revertidas desde la Sesión 5-A.** Si en el futuro se necesita otra temporal, seguir el mismo patrón (migración + su reversión desde el inicio), pero revertirla apenas exista el mecanismo real que la reemplace.

---

## 4. Historial de sesiones completadas

### Fase 0 — Fundaciones
- **0-A**: Esquema SQL completo del spoke Pucusana.
- **0-B**: Esquema SQL del Hub corporativo.
- **0-C**: Estructura del monorepo.

### Fase 1 — Ingesta de datos (Pucusana)
- **1-A**: Formulario de ingreso manual de caudal. (Ya funcional de verdad desde la 5-B.)
- **1-B**: Endpoint de ingesta de datalogger (`datalogger-ingest`).
- **1-C**: Carga histórica de TDS/Cloruros/etc. 2014-2025 (924 lecturas).
- **1-D**: Panel de estado de ingesta con semáforo de recencia.

### Fase 2 — Dashboard operador (Pucusana)
- **2-A**: Gráfico de CE horaria con Recharts + Realtime.
- **2-B**: Gráficos de Nivel de Napa + Caudal de Extracción.
- **2-C**: Tarjetas KPI del operador — semáforo de umbral operativo.
- **2-D**: Layout final del operador (`OperatorLayout.jsx`).

### Fase 3 — Alertas
- **3-A**: Función + trigger `evaluate_reading_threshold()`.
- **3-B**: Panel de Alarmas Activas del Hub. Bootstrap completo de `apps/hub`.
- **3-C**: Configurador de Umbrales por pozo (`ThresholdConfig.jsx`). (Ya funcional de verdad desde la 5-B.)
- **3-D**: Notificación por email (Edge Function `notify`, Hub) — trigger SQL manual con `pg_net`.

### Fase 4 — Análisis histórico y de modelo
- **4-A**: Gráfico histórico de TDS 2014-2025 (`HistoricalChart.jsx`). Hallazgo de red sin resolver en la laptop de viaje (presets de rango colgados) — código verificado correcto por SQL Editor y `curl`; pendiente reprobar en red habitual.
- **4-B**: Comparador Observado vs. Proyección del modelo (`ModelComparison.jsx`) + tabla `model_projections` (migración `0016`), diseñada flexible porque el estudio hidrogeológico formal todavía no existe.
- **4-C**: Importador de proyecciones — script Python (`scripts/import-model-projections/`, usa `service_role`) + componente web (`ModelProjectionUploader.jsx`, usa `papaparse`). Formato de CSV genérico, por ajustar cuando exista el export real de MODFLOW. Python instalado en la laptop vía instalador oficial (no Scoop).
- **4-D**: Constructor de Escenarios interactivo (`ScenarioBuilder.jsx`) — versión del prototipo HTML que el cliente ya vio, pero conectada a datos reales (antes tenía base=1,340 y umbral=2,000 mg/L hardcodeados y ficticios; ahora usa la última lectura real y el umbral real de 25,000 mg/L configurado en `well_parameters`).
  - **Bug encontrado y corregido durante las pruebas:** la primera versión estimaba la tasa de crecimiento anual comparando solo el primer y el último dato histórico (2 puntos). Con datos reales ruidosos (no monótonos), eso dio una tasa muy negativa que, sumada al piso mínimo de la fórmula (`Math.max(0.001, ...)`), hacía que **todos los escenarios (Positivo y Negativo) cayeran en el mismo valor mínimo** — los sliders y presets no producían ningún cambio visible. Corregido con: (a) una regresión lineal sobre `ln(valor)` usando TODO el histórico en vez de 2 puntos, más robusta a ruido; (b) se quitó el piso positivo de la fórmula, permitiendo tasas negativas (una proyección decreciente es válida si el histórico real lo muestra). Confirmado funcionando tras la corrección.
  - **Nota pendiente para Victor:** con el umbral real (25,000 mg/L, mucho más alto en proporción que el ficticio del prototipo), es esperable que la mayoría de escenarios muestren "+30 años" / "Riesgo bajo" — muy distinto a la dinámica dramática que se veía en el mockup con números ficticios. Vale la pena revisar si el umbral y la tasa estimada reflejan lo esperado antes de mostrarle esto al cliente como herramienta "seria".

### Fase 5 — Autenticación
- **5-A**: Configuración de Supabase Auth — roles y políticas.
  - Se corrigió el planteamiento original ("roles en `user_metadata`") por ser inseguro (ver sección 3). Se usa la tabla `profiles` ya existente desde la 0-A/0-B — **no hizo falta escribir SQL de políticas nuevo**, ya estaba todo desde el esquema original.
  - Se creó `docs/AUTH.md`: modelo de roles, cómo crear un usuario (Dashboard + SQL para asignar rol), matriz de permisos por rol y tabla.
  - **Se revirtieron las 5 políticas temporales "anon"** acumuladas en sesiones anteriores (`0007`, `0015`, `0017`, `0019` en Pucusana; `0004` en el Hub) — decisión consciente de Victor de hacerlo ya, aceptando que la app quedara sin acceso hasta la 5-B.
- **5-B**: Login real, en `packages/core` (reutilizable entre ambas apps):
  - `createAuthContext.jsx` — fábrica que, dado un cliente Supabase, da `AuthProvider` + `useAuth()` (sesión + perfil/rol desde `profiles`, nunca desde `user_metadata`).
  - `LoginForm.jsx` — formulario genérico, no conoce Supabase directamente.
  - Cada app (`apps/pucusana/src/auth.js`, `apps/hub/src/auth.js`) instancia su propio `AuthProvider`/`useAuth` con su propio cliente Supabase (proyectos distintos, sesiones independientes).
  - `main.jsx` de ambas apps: `Gate` muestra `LoginForm` sin sesión, o la app con una barra superior (correo + rol + "Cerrar sesión").
  - **Probado con éxito en ambas apps**, con los 3 usuarios de distintos roles que Victor creó siguiendo `docs/AUTH.md`.

---

## 5. Umbrales operativos definidos (well_parameters)

Configurables desde `ThresholdConfig.jsx` (ya funcional de verdad desde la 5-B).

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

1. ~~Revertir migraciones temporales anon~~ ✅ **Hecho en la Sesión 5-A** (las 5, en ambos proyectos).
2. ~~Login / Supabase Auth~~ ✅ **Hecho en la Sesión 5-B**, funcionando en Pucusana y Hub.
3. **Umbral de Nivel de Napa** — falta definición de Victor.
4. **Factor de conversión CE↔TDS.**
5. **Dónde viven el formulario de caudal (1-A), panel de ingesta (1-D), configurador de umbrales (3-C), comparador de modelo (4-B) y constructor de escenarios (4-D)** dentro de `OperatorLayout` — hoy están montados aparte en `main.jsx`.
6. **Vista dual de ambos pozos a la vez** (como el prototipo del cliente).
7. **Valores de umbral para el resto del catálogo.**
8. **Función de sincronización Hub↔spoke** — sigue sin existir.
9. **Layout/shell propio del Hub** (análogo a `OperatorLayout`).
10. **Dominio propio verificado en Resend** — hoy los correos caen en spam.
11. **"Reconocedor asignado" real** (hoy: correo único fijo).
12. **Dataloggers de prueba** — reemplazar cuando lleguen los reales.
13. **Selenio Total histórico** — pendiente si se necesita.
14. **Consolidar nomenclatura `alerts` vs `alarmas_activas`.**
15. **Reprobar los presets de rango de `HistoricalChart.jsx` (4-A) fuera de la red de viaje.**
16. **Cargar los valores reales del estudio hidrogeológico en `model_projections`** cuando exista.
17. **Adaptar el importador (script Python + componente web) al formato real del CSV de MODFLOW** cuando Victor lo tenga.
18. **Revisar si el umbral real (25,000 mg/L) y la tasa estimada del histórico dan resultados razonables en `ScenarioBuilder.jsx`** antes de mostrárselo al cliente — ver nota de la Sesión 4-D.
19. **Flujo de invitación/autogestión de usuarios** — hoy la creación de usuarios es 100% manual (Dashboard + SQL, ver `docs/AUTH.md`). Si se necesita que la gente se registre sola, sería una sesión nueva.

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
| `scripts/import-model-projections/.env` (`service_role` de Pucusana) | Local por máquina, gitignored | Distinto del anon key |
| Contraseñas de los 3 usuarios de prueba (roles distintos) creados en la 5-B | Las que Victor definió al crearlos en el Dashboard | No están en ningún archivo de este repo |

---

## 8. Scripts de utilidad y SQL de prueba (no versionados en el repo, salvo excepción marcada)

- **`simulate_datalogger.sh`** — simula lecturas de CE/nivel.
- **`test_caudal_readings.sql`** — lecturas de caudal de prueba.
- **`test_alarmas_hub.sql`** — alarmas de prueba en el Hub.
- **`plantilla_model_projections.sql`** — formato de referencia (sin datos reales).
- **`plantilla_model_projections_24meses.sql`** — datos de PRUEBA (24 meses, banda creciente).
- **`scripts/import-model-projections/ejemplo_proyecciones.csv`** — SÍ está en el repo, es parte de la herramienta como caso de prueba de referencia.

---

## 9. Próxima sesión sugerida

- Función de sincronización Hub↔Pucusana.
- Definir con Victor los valores reales de umbral pendientes.
- Layout/shell propio del Hub.
- Verificar dominio propio en Resend.
- Reprobar los presets de `HistoricalChart.jsx` en la red habitual de Victor.
- Cargar valores reales del estudio hidrogeológico en `model_projections` cuando estén disponibles.
- Revisar los resultados de `ScenarioBuilder.jsx` con el umbral real antes de mostrarlo al cliente.
- Integrar los componentes sueltos (1-A, 1-D, 3-C, 4-B, 4-D) dentro de `OperatorLayout` en vez de tenerlos apilados en `main.jsx`.

---

## 10. Trabajo en dos máquinas (desktop + laptop)

**Regla de oro: `git push` al final de cada sesión de trabajo, sin excepción.**

**Diferencias de configuración entre máquinas:**
- **Supabase CLI**: desktop usa Scoop. Laptop usa npm (`npm install -D supabase`), con **`npx supabase ...`** en TODOS los comandos.
- **Python**: instalado en la laptop vía instalador oficial de python.org (no Scoop) — marcar "Add to PATH". Usado por `scripts/import-model-projections/`.
- **Autenticación de GitHub**: desktop usa PAT embebido. Laptop usa Git Credential Manager.
- **`.env`** de cada app: no viaja con git, se recrea manualmente.

**Conflictos de merge en `package-lock.json`:** nunca editar a mano — borrar, `npm install`, commitear.

**Lección — verificar, no asumir, que un archivo llegó a GitHub:** varias veces un archivo se quedó solo como descarga suelta. No está completo hasta confirmarlo en GitHub.com.

**Lección — cuidado al pegar instrucciones multilínea en archivos de configuración:** revisar siempre que cada línea quedó en su propio renglón antes de guardar.

**Límites de la plataforma Supabase descubiertos en la Sesión 3-D:**
- El Database Webhook nativo del Dashboard puede fallar con un bug de plataforma (`schema "supabase_functions" does not exist`) — alternativa: trigger SQL manual con `pg_net.http_post()`.
- No se puede usar `ALTER DATABASE ... SET app.settings.xxx` en Supabase hosted (requiere superusuario) — el secreto se embebe directo en la función.

**Limitación de red descubierta en la Sesión 4-A (específica de la laptop/conexión de viaje):** ciertas peticiones del navegador con parámetros de filtro por fecha se quedan colgadas indefinidamente, mientras que la misma consulta por SQL Editor o por `curl` responde instantánea. Pendiente confirmar si es exclusivo del viaje.

**Lección de la Sesión 4-D — cuidado con estimaciones derivadas de datos reales ruidosos:** una fórmula que funciona bien con un número de ejemplo fijo (como tenía el prototipo) puede comportarse de forma completamente distinta con datos reales no monótonos — en este caso, anulando silenciosamente la diferencia entre escenarios en vez de dar un error visible. Vale la pena probar siempre los casos extremos (aquí: comparar Positivo vs. Negativo) antes de dar por buena una función de cálculo.
