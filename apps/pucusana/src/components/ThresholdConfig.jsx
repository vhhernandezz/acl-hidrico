import React, { useEffect, useState } from 'react';
import { useWells } from '../hooks/useWells';
import { useWellParametersConfig } from '../hooks/useWellParametersConfig';
import './ThresholdConfig.css';

const CATEGORY_LABELS = {
  intrusion_salina: 'Intrusión salina',
  calidad_fisicoquimica: 'Calidad fisicoquímica',
  nivel: 'Nivel',
  caudal: 'Caudal',
  otro: 'Otro',
};

const ROW_STATUS = { IDLE: 'idle', SAVING: 'saving', SAVED: 'saved', ERROR: 'error' };

function ThresholdRow({ row, onSave }) {
  const [draft, setDraft] = useState({
    is_monitored: row.is_monitored,
    threshold_warning: row.threshold_warning,
    threshold_critical: row.threshold_critical,
    direction: row.direction,
  });
  const [status, setStatus] = useState(ROW_STATUS.IDLE);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    setDraft({
      is_monitored: row.is_monitored,
      threshold_warning: row.threshold_warning,
      threshold_critical: row.threshold_critical,
      direction: row.direction,
    });
    setStatus(ROW_STATUS.IDLE);
  }, [row.is_monitored, row.threshold_warning, row.threshold_critical, row.direction]);

  const isDirty =
    draft.is_monitored !== row.is_monitored ||
    String(draft.threshold_warning) !== String(row.threshold_warning) ||
    String(draft.threshold_critical) !== String(row.threshold_critical) ||
    draft.direction !== row.direction;

  async function handleSave() {
    setStatus(ROW_STATUS.SAVING);
    setErrorMsg(null);
    try {
      await onSave(row.parameter_id, draft);
      setStatus(ROW_STATUS.SAVED);
      setTimeout(() => setStatus((s) => (s === ROW_STATUS.SAVED ? ROW_STATUS.IDLE : s)), 2000);
    } catch (e) {
      setStatus(ROW_STATUS.ERROR);
      setErrorMsg(e.message);
    }
  }

  return (
    <tr className={row.is_monitored ? '' : 'tc-row--unmonitored'}>
      <td>
        <span className="tc-param-name">{row.name}</span>
        <span className="tc-param-code">{row.code}</span>
      </td>
      <td>
        <input
          type="checkbox"
          checked={draft.is_monitored}
          onChange={(e) => setDraft((d) => ({ ...d, is_monitored: e.target.checked }))}
        />
      </td>
      <td>
        <select
          className="tc-select"
          value={draft.direction}
          onChange={(e) => setDraft((d) => ({ ...d, direction: e.target.value }))}
        >
          <option value="above">Arriba (≥)</option>
          <option value="below">Abajo (≤)</option>
        </select>
      </td>
      <td>
        <input
          type="number"
          step="any"
          className="tc-input"
          placeholder="—"
          value={draft.threshold_warning}
          onChange={(e) => setDraft((d) => ({ ...d, threshold_warning: e.target.value }))}
        />
      </td>
      <td>
        <input
          type="number"
          step="any"
          className="tc-input"
          placeholder="—"
          value={draft.threshold_critical}
          onChange={(e) => setDraft((d) => ({ ...d, threshold_critical: e.target.value }))}
        />
      </td>
      <td className="tc-unit-cell">{row.unit}</td>
      <td>
        <button
          type="button"
          className="tc-save-btn"
          disabled={!isDirty || status === ROW_STATUS.SAVING}
          onClick={handleSave}
        >
          {status === ROW_STATUS.SAVING ? 'Guardando…' : status === ROW_STATUS.SAVED ? 'Guardado ✓' : 'Guardar'}
        </button>
        {status === ROW_STATUS.ERROR && <div className="tc-row-error">{errorMsg}</div>}
      </td>
    </tr>
  );
}

export function ThresholdConfig() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');

  useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const { rows, loading, error, save } = useWellParametersConfig(wellId);

  const grouped = rows.reduce((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  return (
    <section className="tc-panel">
      <header className="tc-panel-header">
        <div>
          <span className="tc-eyebrow">Configuración técnica</span>
          <h2 className="tc-title">Umbrales de alerta por pozo</h2>
        </div>
      </header>

      <div className="tc-controls">
        <label htmlFor="tc-well-select" className="tc-label">Pozo</label>
        <select
          id="tc-well-select"
          className="tc-select"
          value={wellId}
          onChange={(e) => setWellId(e.target.value)}
          disabled={loadingWells}
        >
          {wells.map((well) => (
            <option key={well.id} value={well.id}>{well.code} — {well.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="tc-banner tc-banner--error" role="alert">No se pudo cargar: {error}</p>}
      {loading && <p className="tc-status-text">Cargando…</p>}

      {!loading && !error && Object.entries(grouped).map(([category, categoryRows]) => (
        <div key={category} className="tc-category-block">
          <h3 className="tc-category-title">{CATEGORY_LABELS[category] ?? category}</h3>
          <div className="tc-table-wrap">
            <table className="tc-table">
              <thead>
                <tr>
                  <th>Parámetro</th>
                  <th>Monitoreado</th>
                  <th>Dirección</th>
                  <th>Atención</th>
                  <th>Crítico</th>
                  <th>Unidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row) => (
                  <ThresholdRow key={row.parameter_id} row={row} onSave={save} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
