# ACL Gestión Hídrica — Decisiones y Estado del Proyecto

> Este documento consolida el historial de decisiones técnicas, convenciones y pendientes del proyecto, para que el desarrollo pueda continuar sin pérdida de contexto — incluyendo desde una máquina nueva o una sesión de chat nueva (que no tiene memoria de conversaciones anteriores).
>
> Última actualización: tras cerrar la Sesión 3-A (motor de evaluación de umbrales).

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
- Despliegue: Vercel, **un proyecto por app** (hub, pucusana, etc.).
- Repo: GitHub, `vhhernandezz/acl-hidrico`, un solo repositorio para todo (Hub + todos los spokes + frontend).

---

## 2. Estructura del repositorio

```
acl-hidrico/
├── apps/
│   ├── hub/                    ← dashboard corporativo (placeholder, no desarrollado aún)
│   ├── pucusana/                ← spoke Pucusana (activo, en desarrollo)
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
│   │       ├── migrations/      ← 0001 a 0013 (ver sección 4)
│   │       └── functions/
│   │           └── datalogger-ingest/
│   └── hub/
│       └── supabase/            ← misma estructura anidada, aún sin migraciones propias más allá de 0001-0002
└── docs/
    └── decisiones.md            ← este archivo
```

**⚠️ Nota importante sobre la carpeta anidada `supabase/pucusana/supabase/`:** el Supabase CLI exige que exista una carpeta literalmente llamada `supabase/` (con `config.toml`, `migrations/`, `functions/`) **relativa a donde se ejecuta el comando**. Como organizamos el repo con `supabase/pucusana/` y `supabase/hub/` para separar los proyectos, tuvimos que anidar una carpeta `supabase/` más adentro de cada una. Es intencional, no un error — no la "simplifiques" quitando el anidamiento o el CLI deja de encontrar los archivos.

Para correr comandos del CLI sobre Pucusana: `cd supabase/pucusana` y desde ahí `supabase link`, `supabase functions deploy`, etc.

---

## 3. Convenciones establecidas

- **Nomenclatura de pozos:** el nombre oficial que usa la planta es **"Pozo 1"** y **"Pozo 3"** (no "Pozo 2", aunque la ficha técnica AWS los llama así). Código único: `IRHS-776` (Pozo 1) e `IRHS-777` (Pozo 3).
- **Coordenadas:** UTM (Norte/Este, zona 18S, datum WGS84), NO lat/long decimal — así quedó ajustado el esquema (migración 0002).
- **Roles de usuario (spoke):** `admin`, `director_tecnico`, `operador_planta`, `visor`. El operador puede insertar lecturas pero no editarlas ni borrarlas.
- **Roles del Hub:** simplificado a `admin` y `visor`.
- **Fuente de datos (`readings.source`):** `manual`, `sensor`, `carga_masiva`, `laboratorio`.
- **Naming de tabla de alertas:** en Pucusana se llama `alerts` (inglés); en el Hub se llama `alarmas_activas` (español). Inconsistencia heredada de las primeras sesiones — no bloquea nada, pero si se unifica en el futuro, documentarlo aquí.
- **Paleta visual:** teal/aqua sobre fondo arena (NO el tema oscuro del prototipo `ACL_Hidrico_Prototipo_v2.html` que el cliente ya vio — se decidió mantener la paleta clara por ahora, sesión 2-D).
- **Convención de commits:** `tipo(alcance): descripción` estilo Conventional Commits, ej. `feat(pucusana): agrega gráfico de CE`.

---

## 4. Historial de sesiones completadas

### Fase 0 — Fundaciones
- **0-A**: Esquema SQL completo del spoke Pucusana (tablas, tipos, índices, RLS). *(migración 0001)*
- **0-B**: Esquema SQL del Hub corporativo (`plantas`, `planta_status`, `alarmas_activas` + función de agregación).
- **0-C**: Estructura del monorepo (`apps/`, `packages/`, `README.md` con convenciones).

### Fase 1 — Ingesta de datos (Pucusana)
- **1-A**: Formulario de ingreso manual de caudal (`CaudalReadingForm.jsx`). **Bloqueado para envío real** — funciona visualmente pero el submit requiere sesión de Supabase Auth, que aún no existe.
- **1-B**: Endpoint de ingesta de datalogger (`Edge Function datalogger-ingest`), recibe CE + nivel, valida, autentica por API key propio (tabla `dataloggers`). **Probado en producción con éxito.**
- **1-C**: Carga histórica de TDS/Cloruros/etc. 2014-2025 (924 lecturas), parseada desde Excel del cliente. Migración 0005. No se implementó como script reutilizable (fue de un solo uso) — decisión consciente, suficiente por ahora.
- **1-D**: Panel de estado de ingesta con semáforo de **recencia** (`IngestionStatusPanel.jsx` + vista `latest_readings_status`, migración 0010).

### Fase 2 — Dashboard operador (Pucusana)
- **2-A**: Gráfico de CE horaria con Recharts + Supabase Realtime (`CEHourlyChart.jsx`). Requirió habilitar Realtime sobre `readings` (migración 0011) y desactivar verificación JWT en la Edge Function (`verify_jwt = false` en `config.toml`).
- **2-B**: Gráficos de Nivel de Napa + Caudal de Extracción, mismo patrón, componentes genéricos reutilizables (`ParameterHourlyChart.jsx`, `useParameterHourlyData.js`), ensamblados en `OperationalCharts.jsx`.
- **2-C**: Tarjetas KPI del operador (`OperatorKPICards.jsx`) — TDS, Nivel, Caudal con semáforo de **umbral operativo** (distinto del semáforo de recencia de 1-D). Requirió poblar `well_parameters` por primera vez (migración 0012).
- **2-D**: Layout final del operador (`OperatorLayout.jsx`) — header + sidebar + topbar, ensamblando 2-A/2-B/2-C. Estructura fiel al prototipo aprobado por el cliente, pero en paleta clara y con selector de pozo (no vista dual). Sidebar con ítems no construidos como bloqueados (Alertas, Análisis y modelo, Datos crudos, otras 5 plantas). Corrección posterior: "Chiclayo" → "Iquitos", orden alfabético.

### Fase 3 — Alertas
- **3-A**: Función + trigger `evaluate_reading_threshold()` (migración 0013) — evalúa cada lectura nueva contra `well_parameters` y gestiona el ciclo de vida completo en `alerts`: crea, escala/actualiza, o resuelve automáticamente. Probado en producción con éxito (TDS crítico → resuelto).

---

## 5. Umbrales operativos definidos (well_parameters)

| Parámetro | Dirección | Atención | Crítico | Estado |
|---|---|---|---|---|
| **TDS** | above | 18,750 mg/L | 25,000 mg/L | Definido (acuerdo temporal, 75% de 25,000) |
| **CAUDAL_EXTRACCION** | above | `caudal_habitual_m3h` del pozo | `capacidad_nominal_bomba_m3h` del pozo | Definido, específico por pozo |
| **NIVEL_AGUA** | above (napa más profunda = alerta) | — | — | PENDIENTE — sin valores numéricos aún |
| **CE** | — | — | — | No se usa directamente; se usa TDS como proxy. Ver sección 6 |

---

## 6. Pendientes explícitos (nada bloqueante hoy, pero no perder de vista)

1. **Revertir migración `0006`** (lectura anon temporal, solo para desarrollo sin login) en cuanto exista Auth real. El archivo de reversión ya existe: `0007_revert_temp_dev_anon_read_only.sql`, solo falta ejecutarlo cuando corresponda.
2. **Login / Supabase Auth** — bloqueante real para: (a) que el formulario de caudal (1-A) pueda enviar datos de verdad, (b) poder cerrar el punto 1 sin romper la app.
3. **Umbral de Nivel de Napa** — falta que Victor defina los valores numéricos (se descartó un margen de +2m/+5m sobre el nivel dinámico de referencia por falta de certeza técnica).
4. **Factor de conversión CE↔TDS** — cuando se defina (para cuando el cliente pida ver CE en vez de TDS en las tarjetas KPI), migrar el umbral de la tarjeta de TDS a CE.
5. **Dónde viven el formulario de caudal (1-A) y el panel de ingesta (1-D)** dentro de `OperatorLayout` — hoy están montados aparte en `main.jsx`, no integrados al layout final.
6. **Vista dual de ambos pozos a la vez** (como muestra el prototipo del cliente) — hoy cada gráfico/tarjeta usa selector de un pozo a la vez. Decisión consciente de posponerlo.
7. **`well_parameters` para el resto de parámetros** (Cloruros, Sulfatos, etc.) — solo TDS, CAUDAL_EXTRACCION y NIVEL_AGUA están sembrados; el resto del catálogo no tiene fila en `well_parameters`, por lo que el trigger de la 3-A no genera alertas para ellos todavía.
8. **Mostrar alertas en la UI** — la tabla `alerts` ya se llena sola (Sesión 3-A), pero no hay ningún componente que las muestre. El ítem "Alertas" del sidebar sigue bloqueado.
9. **Dataloggers de prueba** (`DL-TEST-01` en Pozo 1, `DL-TEST-02` en Pozo 3) — reemplazar por dispositivos reales cuando lleguen; sus API keys en claro **no se pueden recuperar** (solo quedó el hash en la base).
10. **Selenio Total histórico** — existe en el Excel del cliente en una sección aparte con fechas parcialmente solapadas; no se cargó por riesgo de duplicados. Pendiente si se necesita.
11. **Consolidar nomenclatura `alerts` vs `alarmas_activas`** entre Pucusana y Hub (cosmético, no urgente).

---

## 7. Credenciales y secretos (NO se guardan aquí — solo referencia de dónde viven)

| Secreto | Dónde vive | Notas |
|---|---|---|
| `apps/pucusana/.env` (Supabase URL + anon key) | Local en cada máquina de desarrollo, gitignored | Copiar manualmente entre máquinas |
| Sesión de `supabase login` | Local, por máquina | Se re-autentica con el navegador en cada máquina nueva |
| PAT de GitHub embebido en el remoto git | Local, por máquina — **solo desktop** | `git remote set-url` con el PAT. En la laptop se usa Git Credential Manager (login vía navegador) en vez de esto — ver sección 10 |
| API keys de `DL-TEST-01` / `DL-TEST-02` | Perdidas si no se guardaron aparte — solo el hash SHA-256 vive en la tabla `dataloggers` | Si se necesitan, regenerar y actualizar el hash con `UPDATE` |
| Contraseña de la base de datos Postgres (Pucusana/Hub) | La que se configuró al crear cada proyecto Supabase | Necesaria para `supabase link` en máquinas nuevas |

---

## 8. Scripts de utilidad (no versionados en el repo)

- **`simulate_datalogger.sh`** — simula varias lecturas de CE/nivel distribuidas en las últimas horas, para poblar gráficos de prueba. Requiere el API key en claro de un datalogger registrado.
- **`test_caudal_readings.sql`** — inserta lecturas de caudal de prueba directo por SQL (bypassa RLS/Auth), útil mientras no exista login.

Ninguno de los dos se guardó dentro del repo Git — si se necesitan en una máquina nueva, hay que volver a generarlos o copiarlos manualmente.

---

## 9. Próxima sesión sugerida

Al momento de escribir esto, las opciones más lógicas para continuar son (en cualquier orden, según prioridad del negocio):
- Componente de visualización de alertas (consume la tabla `alerts`, ya poblada desde la 3-A).
- Sesión de Login/Auth (desbloquea 1-A y permite cerrar el punto pendiente #1).
- Definir umbral de Nivel de Napa con Victor y sembrarlo.

---

## 10. Trabajo en dos máquinas (desktop + laptop)

A partir de la Sesión 3-A, el desarrollo continúa alternando entre una desktop y una laptop (viaje de un mes). Lecciones y configuración específica:

**Regla de oro: `git push` al final de cada sesión de trabajo, sin excepción.** El primer intento de sincronizar la laptop falló porque varias sesiones (2-D, 3-A) se habían quedado solo en la desktop, sin subir — la laptop clonó una versión vieja del repo y por eso no aparecía `OperatorLayout.jsx`. Si cada sesión termina con `git push`, la otra máquina siempre puede ponerse al día con un simple `git pull`.

**Diferencias de configuración entre máquinas (normal, no es un problema):**
- **Supabase CLI**: en la desktop se instaló vía **Scoop**. En la laptop, Scoop falló repetidamente al clonar su propio repo base (`error: unable to stat just-written file test/fixtures/decompress/TestCases.zip`, probablemente interferencia de antivirus/OneDrive) — se resolvió instalándolo vía **npm** en su lugar: `npm install -D supabase`, y usando `npx supabase ...` en vez de `supabase ...` directo. Como quedó como `devDependency` en `package.json`, la próxima vez que la desktop haga `npm install` también lo va a tener disponible.
- **Autenticación de GitHub**: en la desktop se configuró con un Personal Access Token (PAT) embebido en la URL del remoto (`git remote set-url` con el token). En la laptop, en cambio, `git push` disparó el flujo de **Git Credential Manager** (login vía navegador) — funciona igual de bien y es más seguro; no hace falta replicar el método del PAT ahí.
- **`.env` de `apps/pucusana`**: no viaja con git (está en `.gitignore`). Se recreó manualmente en la laptop con los mismos valores de URL/anon key que la desktop.

**Conflictos de merge esperables:** si ambas máquinas corren `npm install` de forma independiente entre sesiones, `package-lock.json` puede entrar en conflicto al hacer `git pull` (ya pasó una vez). La solución simple y segura: **nunca editar `package-lock.json` a mano** — en un conflicto, borrarlo (`rm package-lock.json`), correr `npm install` para regenerarlo, y luego `git add` + commit para cerrar el merge. `package.json` sí puede (y debe) fusionarse normalmente si el conflicto llega a tocarlo.

