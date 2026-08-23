import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useWells } from '../hooks/useWells';
import { useParameterByCode } from '../hooks/useParameterByCode';
import { useCEHourlyData } from '../hooks/useCEHourlyData';
import './CEHourlyChart.css';

const CE_PARAMETER_CODE = 'CE';
const HOURS_WINDOW = 48;

const REALTIME_STATUS_META = {
  conectando: { label: 'Conectando…', dotClass: 'ce-dot--gris' },
  conectado:  { label: 'En vivo',      dotClass: 'ce-dot--verde' },
  error:      { label: 'Sin conexión en vivo', dotClass: 'ce-dot--rojo' },
};

function formatHourLabel(hourIso) {
  return new Date(hourIso).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="ce-tooltip">
      <div className="ce-tooltip-hour">{formatHourLabel(label)}</div>
      <div className="ce-tooltip-value">{point.avgCE} µS/cm</div>
      <div className="ce-tooltip-count">{point.count} lectura{point.count === 1 ? '' : 's'} en esa hora</div>
    </div>
  );
}

export function CEHourlyChart() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');

  const {
    parameter: ceParameter,
    loading: loadingParameter,
    notFound: parameterNotFound,
  } = useParameterByCode(CE_PARAMETER_CODE);

  // Selecciona el primer pozo automáticamente en cuanto cargan
  React.useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const { hourlyData, rawCount, loading: loadingData, error, realtimeStatus } = useCEHourlyData(
    wellId,
    ceParameter?.id,
    HOURS_WINDOW
  );

  const statusMeta = REALTIME_STATUS_META[realtimeStatus] ?? REALTIME_STATUS_META.conectando;

  if (loadingWells || loadingParameter) {
    return (
      <div className="ce-chart-card">
        <p className="ce-chart-status-text">Cargando…</p>
      </div>
    );
  }

  if (parameterNotFound) {
    return (
      <div className="ce-chart-card ce-chart-card--error" role="alert">
        <p className="ce-chart-status-text">
          El parámetro de conductividad (código <code>CE</code>) no está en el catálogo.
        </p>
      </div>
    );
  }

  return (
    <section className="ce-chart-card">
      <header className="ce-chart-header">
        <div>
          <span className="ce-chart-eyebrow">Dashboard operador</span>
          <h2 className="ce-chart-title">Conductividad eléctrica — promedio horario</h2>
        </div>
        <span className="ce-realtime-indicator">
          <span className={`ce-dot ${statusMeta.dotClass}`} aria-hidden="true" />
          {statusMeta.label}
        </span>
      </header>

      <div className="ce-chart-controls">
        <label htmlFor="ce-well-select" className="ce-chart-label">Pozo</label>
        <select
          id="ce-well-select"
          className="ce-chart-select"
          value={wellId}
          onChange={(e) => setWellId(e.target.value)}
        >
          {wells.map((well) => (
            <option key={well.id} value={well.id}>{well.code} — {well.name}</option>
          ))}
        </select>
        <span className="ce-chart-window-note">Últimas {HOURS_WINDOW} h · {rawCount} lecturas crudas</span>
      </div>

      {error && (
        <p className="ce-chart-banner ce-chart-banner--error" role="alert">
          No se pudo cargar la serie: {error}
        </p>
      )}

      {loadingData && (
        <p className="ce-chart-status-text">Cargando serie histórica…</p>
      )}

      {!loadingData && !error && hourlyData.length === 0 && (
        <p className="ce-chart-status-text">
          Sin lecturas de CE en las últimas {HOURS_WINDOW} horas para este pozo.
        </p>
      )}

      {!loadingData && hourlyData.length > 0 && (
        <div className="ce-chart-plot">
          <ResponsiveContainer width="100%" height={280}>
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
                label={{ value: 'µS/cm', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5b6b6a' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="avgCE"
                stroke="#0f5c5a"
                strokeWidth={2}
                dot={{ r: 2, fill: '#0f5c5a' }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
