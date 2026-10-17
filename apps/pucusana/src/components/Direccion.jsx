// apps/pucusana/src/components/Direccion.jsx
// Sesión 5D — Vista de Dirección técnica (director_tecnico, admin).
// Solo indicadores ejecutivos: sin tabla de lecturas ni exportación.
// Ocultar datos crudos aquí es decisión de interfaz; la barrera real sigue siendo RLS.
//
// Uso: <Direccion />  (importa el cliente igual que los demás componentes)

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  HORIZON_YEARS,
  MAX_YEARS_REPORTED,
  projectTds,
  useDireccionData,
  yearFraction,
} from '../hooks/useDireccionData'

/* ---------- Tokens (teal/aqua sobre arena) ---------- */

const C = {
  sand: '#EBE2CC',
  sandDeep: '#e9e3d4',
  paper: '#fff',
  ink: '#1F2D2E',
  muted: '#5b6b6a',
  teal: '#0f5c5a',
  aqua: '#4FB8B3',
}

const STATUS = {
  critico: { label: 'Crítico', color: '#B3382C', rank: 3 },
  atencion: { label: 'Atención', color: '#B7791F', rank: 2 },
  normal: { label: 'Normal', color: '#2F7D5B', rank: 1 },
  sin_umbral: { label: 'Sin umbral', color: '#7A7566', rank: 0 },
  sin_dato: { label: 'Sin dato', color: '#7A7566', rank: 0 },
}

const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif"
const SANS = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const fmt = (v, d = 0) =>
  v == null ? '—' : Number(v).toLocaleString('es-PE', { maximumFractionDigits: d })
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'sin fecha'

function fmtYears(y, nowYear) {
  if (y == null) return 'Sin umbral'
  if (y === 0) return 'Ya superado'
  if (y === Infinity) return 'Sin tendencia al alza'
  if (y > MAX_YEARS_REPORTED) return `Más de ${MAX_YEARS_REPORTED} años`
  const n = y < 10 ? y.toFixed(1) : Math.round(y)
  return `≈ ${Math.round(nowYear + y)} (${n} años)`
}

/* ---------- Piezas ---------- */

function StatusTag({ status }) {
  const s = STATUS[status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: SANS,
        fontSize: 13,
        fontWeight: 600,
        color: s.color,
      }}
    >
      <span
        aria-hidden
        style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }}
      />
      {s.label}
    </span>
  )
}

// Barra con marcas de umbral: muestra qué tan cerca está el valor de cada límite.
function Gauge({ value, warning, critical, unit, status }) {
  if (value == null) {
    return <p style={{ margin: 0, color: C.muted, fontFamily: SANS }}>Sin lecturas registradas</p>
  }
  const max = Math.max(value, warning ?? 0, critical ?? 0) * 1.1 || 1
  const at = (v) => `${Math.min(100, (v / max) * 100)}%`
  return (
    <div>
      <div style={{ position: 'relative', height: 12, background: C.sandDeep, borderRadius: 6 }}>
        <div
          style={{ width: at(value), height: '100%', background: STATUS[status].color, borderRadius: 6 }}
        />
        {[warning, critical].map(
          (t, i) =>
            t != null && (
              <span
                key={i}
                aria-hidden
                style={{
                  position: 'absolute',
                  left: at(t),
                  top: -4,
                  width: 2,
                  height: 20,
                  background: C.ink,
                }}
              />
            ),
        )}
      </div>
      <p style={{ margin: '8px 0 0', fontFamily: SANS, fontSize: 12, color: C.muted }}>
        {warning != null && <>Atención {fmt(warning)} {unit}</>}
        {warning != null && critical != null && ' · '}
        {critical != null && <>Crítico {fmt(critical)} {unit}</>}
        {warning == null && critical == null && 'Sin umbral configurado'}
      </p>
    </div>
  )
}

function Indicator({ title, reading, unit }) {
  const pct =
    reading.critical && reading.value != null
      ? Math.round((reading.value / reading.critical) * 100)
      : null
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: SANS, fontSize: 14, color: C.muted }}>{title}</span>
        <StatusTag status={reading.status} />
      </div>
      <p style={{ margin: '4px 0 12px', fontFamily: SERIF, fontSize: 30, color: C.ink }}>
        {fmt(reading.value, unit === 'm³/h' ? 1 : 0)}{' '}
        <span style={{ fontSize: 15, color: C.muted }}>{unit}</span>
      </p>
      <Gauge {...reading} unit={unit} />
      <p style={{ margin: '8px 0 0', fontFamily: SANS, fontSize: 12, color: C.muted }}>
        Última lectura: {fmtDate(reading.at)}
        {pct != null && ` · ${pct} % del umbral crítico`}
      </p>
    </div>
  )
}

/* ---------- Proyección ---------- */

function Projection({ wells }) {
  const [wellId, setWellId] = useState(wells[0]?.id)
  const well = wells.find((w) => w.id === wellId) ?? wells[0]
  const nowYear = Math.floor(yearFraction())

  const proj = useMemo(
    () => (well ? projectTds(well.annual, well.tds.warning, well.tds.critical) : null),
    [well],
  )

  const chartData = useMemo(() => {
    if (!proj) return []
    const rows = new Map()
    for (const a of well.annual) rows.set(a.year + 0.5, { x: a.year + 0.5, observado: Math.round(a.value) })
    for (const s of proj.scenarios)
      for (const p of s.series) {
        const row = rows.get(p.x) ?? { x: p.x }
        row[s.key] = Math.round(p.y)
        rows.set(p.x, row)
      }
    return [...rows.values()].sort((a, b) => a.x - b.x)
  }, [proj, well])

  const lineColors = { conservador: C.aqua, normal: C.teal, agresivo: '#B3382C' }
  const yMax = Math.max(
    well?.tds.critical ?? 0,
    ...chartData.flatMap((r) => [r.observado ?? 0, r.conservador ?? 0, r.normal ?? 0, r.agresivo ?? 0]),
  )

  return (
    <section style={{ marginTop: 32 }}>
      <h2 style={{ fontFamily: SERIF, fontSize: 22, margin: '0 0 4px', color: C.ink }}>
        Proyección de TDS
      </h2>
      <p style={{ margin: '0 0 16px', fontFamily: SANS, fontSize: 14, color: C.muted, maxWidth: 640 }}>
        Tendencia de los promedios anuales extendida {HORIZON_YEARS} años. Referencial hasta contar
        con el modelo numérico.
      </p>

      <div role="group" aria-label="Pozo" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {wells.map((w) => (
          <button
            key={w.id}
            onClick={() => setWellId(w.id)}
            aria-pressed={w.id === well.id}
            style={{
              fontFamily: SANS,
              fontSize: 14,
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              border: `1px solid ${C.teal}`,
              background: w.id === well.id ? C.teal : 'transparent',
              color: w.id === well.id ? '#fff' : C.teal,
            }}
          >
            {w.name}
          </button>
        ))}
      </div>

      {!proj ? (
        <p style={{ fontFamily: SANS, color: C.muted }}>
          {well.name} tiene menos de 3 años con datos de TDS: aún no alcanza para proyectar.
        </p>
      ) : (
        <>
          <div style={{ background: C.paper, borderRadius: 10, padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ left: 8, right: 24, top: 8 }}>
                <CartesianGrid stroke={C.sandDeep} strokeDasharray="3 3" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v) => Math.round(v)}
                  tick={{ fontSize: 12, fill: C.muted }}
                />
                <YAxis
                  domain={[0, Math.ceil((yMax * 1.05) / 1000) * 1000]}
                  tickFormatter={(v) => fmt(v)}
                  tick={{ fontSize: 12, fill: C.muted }}
                  width={64}
                />
                <Tooltip
                  labelFormatter={(v) => `Año ${Number(v).toFixed(1)}`}
                  formatter={(v, name) => [`${fmt(v)} mg/L`, name]}
                />
                {well.tds.warning != null && (
                  <ReferenceLine y={well.tds.warning} stroke={STATUS.atencion.color} strokeDasharray="5 4" label={{ value: 'Atención', fontSize: 11, fill: STATUS.atencion.color, position: 'insideTopLeft' }} />
                )}
                {well.tds.critical != null && (
                  <ReferenceLine y={well.tds.critical} stroke={STATUS.critico.color} strokeDasharray="5 4" label={{ value: 'Crítico', fontSize: 11, fill: STATUS.critico.color, position: 'insideTopLeft' }} />
                )}
                <Line dataKey="observado" name="Promedio anual" stroke={C.ink} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                {proj.scenarios.map((s) => (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    name={`${s.label} (${s.k}×)`}
                    stroke={lineColors[s.key]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <table style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse', fontFamily: SANS, fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: C.muted }}>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Escenario</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Alcanza atención</th>
                <th style={{ padding: '6px 8px', fontWeight: 500 }}>Alcanza crítico</th>
              </tr>
            </thead>
            <tbody>
              {proj.scenarios.map((s) => (
                <tr key={s.key} style={{ borderTop: `1px solid ${C.sandDeep}` }}>
                  <td style={{ padding: '8px' }}>
                    {s.label} <span style={{ color: C.muted }}>({s.k}× la pendiente)</span>
                  </td>
                  <td style={{ padding: '8px' }}>{fmtYears(s.toWarning, nowYear)}</td>
                  <td style={{ padding: '8px' }}>{fmtYears(s.toCritical, nowYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ margin: '12px 0 0', fontFamily: SANS, fontSize: 12, color: C.muted, maxWidth: 680 }}>
            Tendencia {proj.trend === 'sube' ? 'al alza' : proj.trend === 'baja' ? 'a la baja' : 'estable'}{' '}
            ({fmt(proj.slope, 0)} mg/L por año) calculada con {proj.years} años de promedios anuales,
            {' '}{well.annual[0].year}–{well.annual[well.annual.length - 1].year}. Si la tendencia no
            sube, no se estima plazo.
          </p>
        </>
      )}
    </section>
  )
}

/* ---------- Vista ---------- */

export function Direccion() {
  const { loading, error, data, reload } = useDireccionData()

  if (loading && !data) return <p style={{ fontFamily: SANS, color: C.muted }}>Cargando indicadores…</p>
  if (error)
    return (
      <div role="alert" style={{ fontFamily: SANS, color: STATUS.critico.color }}>
        <p>No se pudieron cargar los indicadores: {error.message}</p>
        <button onClick={reload}>Reintentar</button>
      </div>
    )

  const { wells, alerts, loadedAt } = data
  const readings = wells.flatMap((w) => [
    { well: w.name, label: 'TDS', unit: 'mg/L', ...w.tds },
    { well: w.name, label: 'Caudal de extracción', unit: 'm³/h', ...w.caudal },
  ])
  const worst = readings.reduce((m, r) => (STATUS[r.status].rank > STATUS[m].rank ? r.status : m), 'sin_dato')
  const flagged = readings.filter((r) => STATUS[r.status].rank >= 2)
  const headline = {
    critico: 'Hay indicadores en nivel crítico',
    atencion: 'Hay indicadores en atención',
    normal: 'Operación dentro de umbrales',
    sin_dato: 'Sin datos suficientes para evaluar',
  }[worst]

  return (
    <div style={{ color: C.ink }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, margin: 0 }}>Dirección técnica</h1>
        <span style={{ fontFamily: SANS, fontSize: 13, color: C.muted }}>
          Actualizado {loadedAt.toLocaleString('es-PE')}{' '}
          <button onClick={reload} style={{ marginLeft: 8, cursor: 'pointer' }}>Actualizar</button>
        </span>
      </header>

      <section
        aria-label="Estado general"
        style={{
          marginTop: 20,
          background: C.paper,
          borderLeft: `8px solid ${STATUS[worst].color}`,
          borderRadius: 8,
          border: `1px solid ${C.sandDeep}`,
          padding: '16px 20px',
        }}
      >
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 24 }}>{headline}</p>
        <div style={{ marginTop: 6 }}>
          <StatusTag status={worst} />
        </div>
        {flagged.length > 0 && (
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontFamily: SANS, fontSize: 14 }}>
            {flagged.map((r, i) => (
              <li key={i}>
                {r.well} · {r.label}: {fmt(r.value, r.unit === 'm³/h' ? 1 : 0)} {r.unit} ({STATUS[r.status].label.toLowerCase()})
              </li>
            ))}
          </ul>
        )}
        <p style={{ margin: '12px 0 0', fontFamily: SANS, fontSize: 14, color: C.muted }}>
          Alertas abiertas: {alerts.open}
          {alerts.critical > 0 && ` · ${alerts.critical} crítica${alerts.critical > 1 ? 's' : ''}`}
        </p>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
        {wells.map((w) => (
          <article key={w.id} style={{ background: C.paper, border: `1px solid ${C.sandDeep}`, borderRadius: 10, padding: 20 }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 20, margin: 0 }}>
              {w.name} <span style={{ fontFamily: SANS, fontSize: 13, color: C.muted }}>{w.code}</span>
            </h2>
            <Indicator title="TDS" reading={w.tds} unit="mg/L" />
            <Indicator title="Caudal de extracción" reading={w.caudal} unit="m³/h" />
          </article>
        ))}
      </div>

      <Projection wells={wells} />
    </div>
  )
}
