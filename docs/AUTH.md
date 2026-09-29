# Autenticación y Roles — ACL Gestión Hídrica

> Sesión 5-A. Documenta el modelo de roles (ya construido desde las Sesiones 0-A/0-B), cómo crear usuarios, la matriz de permisos, y el estado de las políticas temporales tras esta sesión.

---

## 1. Decisión de seguridad de esta sesión

La sesión se planteó originalmente como "roles en `user_metadata`". Se cambió por lo siguiente:

**`user_metadata` es editable por el propio usuario** desde el cliente (`supabase.auth.updateUser()`). Si una política RLS confía en `user_metadata->>'role'`, cualquier usuario autenticado podría autoasignarse `role: 'admin'` con una sola llamada JS — es una vulnerabilidad conocida de Supabase, no una hipótesis.

**Decisión tomada:** usar la tabla `profiles` que ya existe desde la Sesión 0-A/0-B, con una política que impide que el usuario cambie su propio `role` (`profiles_update_self_basic`, con un `with check` que compara contra el rol ya guardado). Todas las funciones RLS (`is_admin_or_director()`, `current_user_role()` en Pucusana; `hub_current_user_role()` en el Hub) ya leen de esta tabla — no hubo que escribir SQL de políticas nuevo, solo confirmar y documentar lo que ya existía.

---

## 2. Modelo de roles

**Pucusana** (`public.user_role`): `admin`, `director_tecnico`, `operador_planta`, `visor`.
**Hub** (`public.hub_user_role`): `admin`, `visor`.

Cada proyecto tiene su propia tabla `profiles`, independiente entre sí (son bases de datos distintas — arquitectura Hub & Spoke). Un usuario debe crearse **por separado** en cada proyecto si necesita acceso a ambos.

Al crear un usuario en `auth.users` (por cualquier vía: Dashboard, API, o un futuro flujo de registro), el trigger `handle_new_user()` **ya existente** crea automáticamente una fila en `profiles` con `role = 'visor'` por defecto — el rol más restrictivo. Un admin debe subirlo manualmente al rol correcto después.

---

## 3. Cómo crear un usuario nuevo

### Paso 1 — Crear el usuario en Supabase Auth (Dashboard)
1. Entra al proyecto correspondiente (Pucusana o Hub) → **Authentication** → **Users** → **Add user**.
2. Elige **Create new user**, completa email y contraseña (o "Send invite" si prefieres que el usuario la defina él mismo).
3. Guarda. Esto dispara automáticamente el trigger que crea su fila en `profiles` con `role = 'visor'`.

### Paso 2 — Asignar el rol correcto (SQL Editor)
```sql
-- Encuentra el id del usuario recién creado
select id, email from auth.users where email = 'correo@ejemplo.com';

-- Asigna el rol (Pucusana: admin/director_tecnico/operador_planta/visor)
update public.profiles set role = 'director_tecnico' where id = '<uuid-del-paso-anterior>';
```

Para el Hub, el mismo patrón pero con `role` limitado a `admin`/`visor`.

### Notas
- No existe (todavía) una UI para este proceso — es manual, vía Dashboard + SQL. Un flujo de invitación/autogestión sería una sesión aparte, si se necesita.
- Recuerda que Pucusana y Hub son proyectos Supabase distintos: un mismo correo puede (y probablemente deba) tener una cuenta en cada uno si esa persona usa ambas apps.

---

## 4. Matriz de permisos (ya implementada en RLS)

### Pucusana

| Tabla | `visor` | `operador_planta` | `director_tecnico` | `admin` |
|---|---|---|---|---|
| `wells`, `parameters` | Lectura | Lectura | Lectura + escritura | Lectura + escritura + borrado |
| `well_parameters` (umbrales) | Lectura | Lectura | Lectura + escritura | Lectura + escritura + borrado |
| `readings` | Lectura | Lectura + inserción (no edita/borra) | Lectura + edición + borrado | Lectura + edición + borrado |
| `alerts` | Lectura | Lectura + reconocer | Lectura + reconocer | Lectura + reconocer + borrado |
| `dataloggers` | — | — | Lectura | Lectura + escritura |
| `model_projections` | Lectura | Lectura | Lectura + escritura | Lectura + escritura + borrado |

### Hub

| Tabla | `visor` | `admin` |
|---|---|---|
| `plantas` | Lectura | Lectura + escritura + borrado |
| `planta_status` | Lectura | Lectura (se actualiza sola vía función) |
| `alarmas_activas` | Lectura | Lectura + escritura + borrado |

---

## 5. Estado de las políticas temporales tras esta sesión

**Todas revertidas en esta sesión** (decisión de Victor: seguridad primero, aunque la app quede sin datos visibles hasta que exista login):

| Migración | Qué revierte | Proyecto |
|---|---|---|
| `0007` | Lectura anon de `wells`/`parameters`/`well_parameters`/`readings` | Pucusana |
| `0015` | Escritura anon de `well_parameters` (umbrales) | Pucusana |
| `0017` | Lectura anon de `model_projections` | Pucusana |
| `0019` | Escritura anon de `model_projections` | Pucusana |
| `0004` | Lectura/reconocimiento anon de `plantas`/`alarmas_activas` | Hub |

**Qué se rompe temporalmente:** desde que se ejecuten estos 5 archivos, **ninguna pantalla de la app va a mostrar datos** (`OperatorLayout`, `AlarmasActivasPanel`, `ScenarioBuilder`, todo) — porque el frontend consulta con la `anon key` sin sesión, y ya no hay ninguna política que le dé acceso. Esto es esperado, no un bug.

**Cómo seguir verificando datos mientras tanto:** el **SQL Editor de Supabase** sigue funcionando normal (corre con un rol elevado que no pasa por RLS), así que puedes seguir consultando/insertando datos de prueba ahí sin problema.

**Para que la app vuelva a funcionar:** hace falta la Sesión 5-B (login UI + manejo de sesión en el frontend) — es el siguiente paso lógico e inmediato después de esta sesión.

---

## 6. Próxima sesión sugerida

**5-B — Login UI**: formulario de inicio de sesión, manejo de sesión en React (contexto de Auth, redirect si no hay sesión), y conectar `OperatorLayout` (Pucusana) y el shell del Hub a un usuario real autenticado. Sin esto, la app queda sin acceso desde el cierre de la 5-A.
