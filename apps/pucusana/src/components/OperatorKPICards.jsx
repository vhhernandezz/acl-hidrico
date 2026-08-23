import React, { useEffect, useState } from 'react';
import { useWells } from '../hooks/useWells';
import { useOperatorKPIs } from '../hooks/useOperatorKPIs';
import './OperatorKPICards.css';

const STATUS_META = {
  normal:      { label: 'Normal',       className: 'kpi-card--normal' },
  atencion:    { label: 'Atención',     className: 'kpi-card--atencion' },
  critico:     { label: 'Crítico',      className: 'kpi-card--critico' },
  sin_umbral:  { label: 'Sin umbral',   className: 'kpi-card--sin-umbral' },
};

function formatRelativeTime(dateIso) {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'hace instantes';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `hace ${diffD} d`;
}

function formatThresholdCaption(row) {
  if (row.threshold_warning == null && row.threshold_critical == null) {
    return 'Sin umbral definido aún';
  }
  const dir = row.direction === 'below' ? '≤' : '≥';
  const parts = [];
  if (row.threshold_warning != null) parts.push(`atención ${dir} ${row.threshold_warning}`);
  if (row.threshold_critical != null) parts.push(`crítico ${dir} ${row.threshold_critical}`);
  return `Umbral: ${parts.join(' · ')} ${row.parameter_unit}`;
}

function KPICard({ row }) {
  const meta = STATUS_META[row.status] ?? STATUS_META.sin_umbral;
  return (
    <div className={`kpi-card ${meta.className}`}>
      <div className="kpi-card-top">
        <span className="kpi-card-name">{row.parameter_name}</span>
        <span className="kpi-card-badge">{meta.label}</span>
      </div>
      <div className="kpi-card-value">
        {row.value ?? '—'} <span className="kpi-card-unit">{row.parameter_unit}</span>
      </div>
      <div className="kpi-card-caption">{formatThresholdCaption(row)}</div>
      <div className="kpi-card-footer">
        {row.recorded_at ? `Actualizado ${formatRelativeTime(row.recorded_at)}` : 'Sin lecturas aún'}
      </div>
    </div>
  );
}

export function OperatorKPICards() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');

  useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const { kpis, loading, error } = useOperatorKPIs(wellId);

  if (loadingWells) {
    return (
      <div className="kpi-panel">
        <p className="kpi-panel-status-text">Cargando…</p>
      </div>
    );
  }

  return (
    <section className="kpi-panel">
      <header className="kpi-panel-header">
        <div>
          <span className="kpi-panel-eyebrow">Dashboard operador</span>
          <h2 className="kpi-panel-title">Estado actual del pozo</h2>
        </div>
      </header>

      <div className="kpi-panel-controls">
        <label htmlFor="kpi-well-select" className="kpi-panel-label">Pozo</label>
        <select
          id="kpi-well-select"
          className="kpi-panel-select"
          value={wellId}
          onChange={(e) => setWellId(e.target.value)}
        >
          {wells.map((well) => (
            <option key={well.id} value={well.id}>{well.code} — {well.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="kpi-panel-banner" role="alert">No se pudo cargar el estado: {error}</p>
      )}

      {loading && <p className="kpi-panel-status-text">Cargando…</p>}

      {!loading && !error && (
        <div className="kpi-grid">
          {kpis.map((row) => (
            <KPICard key={row.parameter_code} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
