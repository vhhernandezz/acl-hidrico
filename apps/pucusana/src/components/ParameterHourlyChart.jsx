import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useParameterHourlyData } from '../hooks/useParameterHourlyData';
import './ParameterHourlyChart.css';

const REALTIME_STATUS_META = {
  conectando: { label: 'Conectando…', dotClass: 'phc-dot--gris' },
  conectado:  { label: 'En vivo',      dotClass: 'phc-dot--verde' },
  error:      { label: 'Sin conexión en vivo', dotClass: 'phc-dot--rojo' },
};

function formatHourLabel(hourIso) {
  return new Date(hourIso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function makeTooltip(unit) {
  return function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    return (
      <div className="phc-tooltip">
        <div className="phc-tooltip-hour">{formatHourLabel(label)}</div>
        <div className="phc-tooltip-value">{point.avgValue} {unit}</div>
        <div className="phc-tooltip-count">{point.count} lectura{point.count === 1 ? '' : 's'} en esa hora</div>
      </div>
    );
  };
}

/**
 * ParameterHourlyChart
 * Bloque genérico y reutilizable: título + selector implícito de pozo
 * (recibido por props, controlado desde afuera) + gráfico de línea horario
 * en vivo. Usado por OperationalCharts.jsx (Sesión 2-B) para Nivel de Napa
 * y Caudal de Extracción, con el mismo patrón que CEHourlyChart (2-A).
 *
 * Props:
 *  - wellId: id del pozo seleccionado (controlado desde el padre)
 *  - parameter: { id, code, name, unit } ya resuelto (via useParameterByCode)
 *  - color: color de la línea (hex)
 *  - hoursWindow: ventana de horas a mostrar (default 48)
 *  - emptyHint: texto opcional cuando no hay datos, para explicar por qué
 */
export function ParameterHourlyChart({ wellId, parameter, color = '#0f5c5a', hoursWindow = 48, emptyHint }) {
  const { hourlyData, rawCount, loading, error, realtimeStatus } = useParameterHourlyData(
    wellId,
    parameter?.id,
    parameter?.code,
    hoursWindow
  );

  const statusMeta = REALTIME_STATUS_META[realtimeStatus] ?? REALTIME_STATUS_META.conectando;
  const CustomTooltip = makeTooltip(parameter?.unit ?? '');

  return (
    <div className="phc-block">
      <header className="phc-block-header">
        <div>
          <h3 className="phc-block-title">{parameter?.name ?? '—'}</h3>
          <span className="phc-block-window-note">
            Últimas {hoursWindow} h · {rawCount} lecturas crudas
          </span>
        </div>
        <span className="phc-realtime-indicator">
          <span className={`phc-dot ${statusMeta.dotClass}`} aria-hidden="true" />
          {statusMeta.label}
        </span>
      </header>

      {error && (
        <p className="phc-banner phc-banner--error" role="alert">
          No se pudo cargar la serie: {error}
        </p>
      )}

      {loading && (
        <p className="phc-status-text">Cargando serie…</p>
      )}

      {!loading && !error && hourlyData.length === 0 && (
        <p className="phc-status-text">
          Sin lecturas de {parameter?.name?.toLowerCase() ?? 'este parámetro'} en las últimas {hoursWindow} horas.
          {emptyHint ? ` ${emptyHint}` : ''}
        </p>
      )}

      {!loading && hourlyData.length > 0 && (
        <div className="phc-plot">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={hourlyData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9e3d4" />
              <XAxis
                dataKey="hourIso"
                tickFormatter={formatHourLabel}
                tick={{ fontSize: 11, fill: '#5b6b6a' }}
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#5b6b6a' }}
                label={{ value: parameter?.unit ?? '', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5b6b6a' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="avgValue"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 2, fill: color }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
