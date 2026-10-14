# Autenticación y Roles — ACL Gestión Hídrica

> Sesiones 5-A, 5-B y 5-C. Documenta el modelo de roles, cómo crear usuarios, qué puede hacer cada rol en la base de datos y en la interfaz, y las limitaciones conocidas.
>
> Última actualización: tras la Sesión 5-C (rol `consultor_externo`), con las pruebas de roles confirmadas.

---

## 1. Decisión de seguridad: el rol vive en `profiles`, no en `user_metadata`

La Sesión 5-A se planteó originalmente como "roles en `user_metadata`". Se cambió por lo siguiente:

**`user_metadata` es editable por el propio usuario** desde el cliente (`supabase.auth.updateUser()`). Si una política RLS confía en `user_metadata->>'role'`, cualquier usuario autenticado podría autoasignarse `role: 'admin'` con una sola llamada JS. Es una vulnerabilidad conocida de Supabase.

**Decisión:** el rol se guarda en la tabla `profiles`, con una política que impide que el usuario cambie su propio `role` (`profiles_update_self_basic`). Las funciones RLS (`is_admin_or_director()`, `can_write_operational_data()`, `current_user_role()` en Pucusana; `hub_current_user_role()` en el Hub) leen de esa tabla. El frontend (`createAuthContext.jsx`, Sesión 5-B) también lee el rol de `profiles`, nunca de `user_metadata`.

---

## 2. Modelo de roles

**Pucusana** (`public.user_role`): `admin`, `director_tecnico`, `operador_planta`, `visor`, `consultor_externo`.
**Hub** (`public.hub_user_role`): `admin`, `visor`. El Hub no tiene `consultor_externo`.

Cada proyecto tiene su propia tabla `profiles`, independiente (son bases de datos distintas, arquitectura Hub & Spoke). Un usuario se crea por separado en cada proyecto donde necesite acceso.

Al crear un usuario en `auth.users` (Dashboard, API o un futuro flujo de registro), el trigger `handle_new_user()` crea automáticamente su fila en `profiles` con `role = 'visor'`. Un admin lo sube al rol correcto después.

`consultor_externo` se agregó en la Sesión 5-C (migración `0020`, que debe ejecutarse sola porque Postgres no permite usar un valor de enum en la misma transacción que lo crea). Es un perfil de solo lectura de datos crudos, sin acceso a configuración.

---

## 3. Cómo crear un usuario nuevo

### Paso 1 — Crear el usuario en Supabase Auth (Dashboard)
1. Entra al proyecto correspondiente → **Authentication** → **Users** → **Add user**.
2. Elige **Create new user** y completa correo y contraseña.
3. Guarda. El trigger crea su fila en `profiles` con `role = 'visor'`.

### Paso 2 — Asignar el rol correcto (SQL Editor)
```sql
-- Encuentra el id del usuario recién creado
select id, email from auth.users where email = 'correo@ejemplo.com';

-- Pucusana: admin | director_tecnico | operador_planta | visor | consultor_externo
-- Hub: admin | visor
update public.profiles set role = 'consultor_externo' where id = '<uuid-del-paso-anterior>';
```

### Notas
- No existe una interfaz para este proceso: es manual, vía Dashboard y SQL.
- Mientras el rol no se asigne, el usuario queda como `visor`.
- Si un usuario no tiene fila en `profiles`, la app muestra un mensaje pidiendo avisar al administrador y no monta nada sensible.

---

## 4. Permisos en la base de datos (RLS)

Esta es la barrera real de seguridad. La interfaz oculta componentes por comodidad (ver sección 6), pero lo que cuenta es lo que la base permite.

### Pucusana

| Tabla | `consultor_externo` | `visor` | `operador_planta` | `director_tecnico` | `admin` |
|---|---|---|---|---|---|
| `wells`, `parameters` | Lectura | Lectura | Lectura | Lectura + escritura | Lectura + escritura + borrado |
| `well_parameters` (umbrales) | **Sin acceso** (desde 0021) | Lectura | Lectura | Lectura + escritura | Lectura + escritura + borrado |
| `readings` | Lectura | Lectura | Lectura + inserción | Lectura + edición + borrado | Lectura + edición + borrado |
| `alerts` | Lectura (*) | Lectura | Lectura + reconocer | Lectura + reconocer | Lectura + reconocer + borrado |
| `dataloggers` | Sin acceso | Sin acceso | Sin acceso | Lectura | Lectura + escritura |
| `model_projections` | Lectura (*) | Lectura | Lectura | Lectura + escritura | Lectura + escritura + borrado |
| `audit_log` | Sin acceso | Sin acceso | Sin acceso | Lectura | Lectura |
| `profiles` | Lectura de todos los perfiles (*) | ídem | ídem | ídem | Lectura + escritura |

(*) `alerts`, `model_projections` y `profiles` tienen una política de lectura abierta a cualquier usuario autenticado, de modo que `consultor_externo` puede leerlas consultando la API directamente, aunque su interfaz no las muestre. Si se quiere cerrarlas, hay que escribir políticas nuevas; hoy no se hizo porque no se pidió. Ver sección 7.

`consultor_externo` no puede escribir en ninguna tabla: las funciones `is_admin_or_director()` y `can_write_operational_data()` no lo incluyen.

### Vistas (Sesión 5-C, migración `0022`)

`latest_readings_status` y `operator_kpi_status` se crean con `security_invoker = true`, así que se ejecutan con los permisos y el RLS de quien las consulta. Sin esa opción, una vista de Postgres corre con los permisos de su dueño y se salta el RLS de las tablas que une. `operator_kpi_status` hace un `LEFT JOIN` a `well_parameters`, por lo que antes de la 0022 podía devolver umbrales a un `consultor_externo`. **Estado:** la 0022 se ejecutó sin errores (el proyecto corre PostgreSQL 15 o superior). Falta una prueba puntual: consultar `operator_kpi_status` con una sesión de `consultor_externo` y comprobar que `threshold_warning` y `threshold_critical` llegan en null.

### Hub

| Tabla | `visor` | `admin` |
|---|---|---|
| `plantas` | Lectura | Lectura + escritura + borrado |
| `planta_status` | Lectura | Lectura (se actualiza sola vía función) |
| `alarmas_activas` | Lectura | Lectura + escritura + borrado |

---

## 5. Estado de las políticas temporales

En la Sesión 5-A se revirtieron todas las políticas temporales de acceso anónimo (`0007`, `0015`, `0017`, `0019` en Pucusana; `0004` en el Hub). Ninguna sigue activa. La Sesión 5-B restauró el acceso de la app mediante login real: sin sesión, ninguna pantalla muestra datos.

El SQL Editor de Supabase corre con un rol elevado que no pasa por RLS, así que sirve para consultar e insertar datos de prueba sin sesión.

---

## 6. Qué ve cada rol en la interfaz (Pucusana)

Definido en `main.jsx` y `OperatorLayout.jsx`. Es comodidad de interfaz, no seguridad.

| Componente | `consultor_externo` | `visor` | `operador_planta` | `director_tecnico` / `admin` |
|---|---|---|---|---|
| Datos crudos (tabla + exportación CSV/Excel) | Sí | Sí | Sí | Sí |
| Monitoreo en vivo (KPIs, gráficos) | No | Sí | Sí | Sí |
| Constructor de escenarios, comparador de modelo, histórico, panel de ingesta | No | Sí | Sí | Sí |
| Formulario de caudal | No | No | Sí | Sí |
| Cargador de proyecciones, configurador de umbrales | No | No | No | Sí |

Si el rol no se puede determinar, no se monta nada sensible. Si `profiles.is_active` es falso, se muestra un mensaje de cuenta desactivada.

**Verificado por Victor:** `admin`, `operador_planta`, `visor` y `consultor_externo`; las diferencias entre roles coinciden con la tabla. Entre esos cuatro, solo `admin` accedió al configurador de umbrales. **Sin probar:** `director_tecnico` (por código ve lo mismo que `admin`, incluido el configurador de umbrales).

El Hub no tiene filtrado por rol: su `main.jsx` monta lo mismo para `admin` y `visor`.

---

## 7. Limitaciones conocidas

1. **`is_active` no se aplica en RLS.** Las funciones RLS no consultan `profiles.is_active`. Un usuario desactivado solo queda bloqueado en la interfaz, no en la base de datos. Para bloquearlo de verdad hay que incorporar `is_active` a las funciones RLS o desactivar al usuario en Supabase Auth.
2. **Lectura abierta de `alerts`, `model_projections` y `profiles`** para cualquier usuario autenticado, incluido `consultor_externo` (ver nota de la sección 4).
3. **Falta la prueba puntual de la `0022`:** la migración se ejecutó sin errores, pero no se comprobó con una sesión de `consultor_externo` que `operator_kpi_status` devuelva los umbrales en null.
4. **El Hub no tiene filtrado por rol** ni un rol equivalente a `consultor_externo`.
5. **Alta de usuarios 100% manual.** Un flujo de invitación o registro sería una sesión aparte.
