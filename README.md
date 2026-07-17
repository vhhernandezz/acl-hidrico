# ACL Gestión Hídrica — Monorepo

Plataforma de monitoreo hídrico para las 6 plantas de ACL Perú (Hub corporativo + un spoke por planta), construida sobre un modelo **Hub & Spoke**: cada planta tiene su propio proyecto Supabase independiente, y el Hub consolida indicadores leyendo por API desde cada spoke.

## Estructura del repositorio

```
acl-hidrico/
├── package.json              ← raíz, define los npm workspaces
├── apps/                     ← una app por dashboard desplegable
│   ├── hub/                  ← dashboard corporativo (6 plantas)
│   ├── pucusana/             ← spoke Pucusana (módulo base + intrusión marina)
│   └── zarate/                ← spoke Zárate/Lima (vacío, por definir)
├── packages/
│   ├── core/                 ← compartido por TODAS las apps
│   │   └── src/
│   │       ├── components/   ← TimeSeriesChart, AlarmBadge, KPICard, DataTable
│   │       ├── hooks/        ← useMonitoreo, useAlarmas, useProyeccion
│   │       └── lib/          ← supabase-client.js (configurable por planta), alarm-engine.js
│   └── modules/               ← lógica específica por PROBLEMA, no por planta
│       ├── intrusion-marina/  ← usado hoy por Pucusana
│       ├── calidad-superficial/ ← reservado (futuro)
│       └── balance-hidrico/     ← reservado (futuro)
└── supabase/                  ← migraciones SQL, una carpeta por proyecto Supabase
    ├── pucusana/migrations/
    ├── hub/migrations/
    └── (zarate, cusco, ... a medida que se activen)
```

## Convenciones

### Apps vs. módulos vs. core
- **`apps/*`**: solo orquestan (routing, layout, variables de entorno). No deben tener lógica de dominio propia.
- **`packages/core`**: cualquier componente/hook/utilidad que **cualquier planta** podría necesitar (gráficos, tablas, badges, cliente Supabase, motor de alarmas genérico).
- **`packages/modules/*`**: lógica específica de un **problema técnico** (ej. intrusión marina), no de una planta. Si dos plantas comparten el mismo problema, comparten el mismo módulo.

### Variables de entorno
Cada app tiene su propio `.env` (no versionado) basado en su `.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Cada app apunta a **su propio proyecto Supabase** (un spoke = un proyecto Supabase = un `.env`).

### Nomenclatura de paquetes
- Paquetes internos con scope `@acl-hidrico/*` (ej. `@acl-hidrico/core`, `@acl-hidrico/intrusion-marina`).
- Apps con nombre de planta en minúsculas sin tildes (`pucusana`, `zarate`, `cusco`).

### Base de datos (carpeta `supabase/`)
- Una carpeta por **proyecto Supabase real** (no por schema). `supabase/hub/` y `supabase/pucusana/` son bases físicamente distintas.
- Migraciones numeradas secuencialmente dentro de cada carpeta: `0001_schema_*.sql`, `0002_...`.
- Nunca se referencian tablas de un spoke desde otro (ni desde el Hub) vía FK — la única comunicación es por API/sync.

### Despliegue
- Un proyecto Vercel por app (`hub`, `pucusana`, etc.), cada uno con **root directory** apuntando a `apps/<nombre>` y sus propias variables de entorno configuradas en Vercel.

### Comandos principales (raíz del repo)
```bash
npm install              # instala todo el monorepo (workspaces)
npm run dev:hub          # levanta apps/hub en local
npm run dev:pucusana     # levanta apps/pucusana en local
npm run build:all        # build de todas las apps/paquetes
```

### Cómo agregar una nueva planta (ej. Zárate)
1. Crear proyecto Supabase para esa planta → migraciones en `supabase/zarate/migrations/`.
2. `apps/zarate/` con el mismo scaffold que `apps/pucusana` (package.json, vite.config.js, .env.example, src/main.jsx).
3. Si comparte problema técnico con otra planta (ej. calidad superficial), usar/crear el módulo correspondiente en `packages/modules/`.
4. Registrar la planta en el catálogo `plantas` del Hub (`supabase/hub`) para que aparezca en el dashboard corporativo.
5. Nuevo proyecto Vercel apuntando a `apps/zarate`.

## Convención de commits
Se sigue un formato simple tipo Conventional Commits:
```
feat(pucusana): agrega gráfico de serie temporal de conductividad
fix(core): corrige cálculo de compareSeverity
docs(hub): actualiza README con pasos de despliegue
chore(supabase): agrega migración 0002 al spoke Pucusana
```

## Historial de sesiones de desarrollo
- **0-A**: Esquema SQL completo del spoke Pucusana (tablas, tipos, índices, RLS).
- **0-B**: Esquema SQL del Hub corporativo (`plantas`, `planta_status`, `alarmas_activas` + función de agregación).
- **0-C**: Estructura del monorepo (este documento).
- Pendiente: función de sincronización Hub↔Pucusana; seed de datos de Pucusana (pozos + parámetros de intrusión salina).
