import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useWells } from '../hooks/useWells';
import { useParameterByCode } from '../hooks/useParameterByCode';
import { useScenarioBaseData } from '../hooks/useScenarioBaseData';
import './ScenarioBuilder.css';

const TDS_PARAMETER_CODE = 'TDS';

// Mismos años relativos que el prototipo (offsets desde el año base):
// 0,2,5,8,11,14,17,20,25,30
const YEAR_OFFSETS = [0, 2, 5, 8, 11, 14, 17, 20, 25, 30];

const DEFAULT_RATE = 0.03; // usado solo si no hay suficiente histórico para estimar

// Presets idénticos al prototipo (ext%, mar 0-2, rec%, reg%)
const PRESETS = {
  pos:   { ext: 70,  mar: 0, rec: 10,  reg: 0 },
  reg:   { ext: 100, mar: 1, rec: 0,   reg: 15 },
  neg:   { ext: 100, mar: 2, rec: -20, reg: 40 },
  reset: { ext: 100, mar: 0, rec: 0,   reg: 0 },
};

const MAR_LABELS = ['RCP 4.5', 'RCP medio', 'RCP 8.5'];

/**
 * Motor de cálculo — misma estructura que el prototipo (tasa base
 * modificada aditivamente por cada supuesto), pero con baseValue,
 * baseYear y baseRate REALES en vez de hardcodeados.
 */
function calcTDS({ ext, mar, rec, reg }, baseValue, baseYear, baseRate) {
  const dExt = (100 - ext) * 0.0012;
  const dMar = mar * 0.008;
  const dRec = (rec / 100) * -0.015;
  const dReg = (reg / 100) * 0.012;

  // Antes forzaba un piso positivo (Math.max(0.001, ...)) que, con una
  // tasa base real negativa/baja, hacía que TODOS los escenarios cayeran
  // en el mismo valor mínimo — anulando cualquier diferencia entre ellos.
  // Ahora se permite una tasa negativa (proyección decreciente es válida
  // si el histórico real muestra esa tendencia), acotada a un rango
  // razonable para evitar resultados absurdos.
  const rate = Math.min(0.25, Math.max(-0.12, baseRate - dExt + dMar + dRec + dReg));

  return YEAR_OFFSETS.map((offset) => ({
    year: baseYear + offset,
    value: Math.round(baseValue * Math.pow(1 + rate, offset)),
  }));
}

function yearsToThreshold(series, threshold) {
  for (let i = 0; i < series.length; i++) {
    if (series[i].value >= threshold) {
      if (i === 0) return 0;
      const { year: y0, value: v0 } = series[i - 1];
      const { year: y1, value: v1 } = series[i];
      const frac = (threshold - v0) / (v1 - v0);
      return Math.round(y0 + frac * (y1 - y0) - series[0].year);
    }
  }
  return null; // no cruza el umbral dentro del horizonte proyectado
}

export function ScenarioBuilder() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');

  useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const { parameter: tdsParameter, loading: loadingParameter, notFound } = useParameterByCode(TDS_PARAMETER_CODE);

  const {
    baseValue, baseYear, threshold, baseRate,
    loading: loadingBase, error: baseError,
  } = useScenarioBaseData(wellId, tdsParameter?.id);

  const [sliders, setSliders] = useState(PRESETS.reset);

  function setSlider(key, value) {
    setSliders((s) => ({ ...s, [key]: Number(value) }));
  }

  function applyPreset(key) {
    setSliders(PRESETS[key]);
  }

  const effectiveRate = baseRate ?? DEFAULT_RATE;

  const seriesActivo = useMemo(() => {
    if (baseValue == null) return [];
    return calcTDS(sliders, baseValue, baseYear, effectiveRate);
  }, [sliders, baseValue, baseYear, effectiveRate]);

  const seriesPositivo = useMemo(
    () => (baseValue == null ? [] : calcTDS(PRESETS.pos, baseValue, baseYear, effectiveRate)),
    [baseValue, baseYear, effectiveRate]
  );
  const seriesRegular = useMemo(
    () => (baseValue == null ? [] : calcTDS(PRESETS.reg, baseValue, baseYear, effectiveRate)),
    [baseValue, baseYear, effectiveRate]
  );
  const seriesNegativo = useMemo(
    () => (baseValue == null ? [] : calcTDS(PRESETS.neg, baseValue, baseYear, effectiveRate)),
    [baseValue, baseYear, effectiveRate]
  );

  const chartData = useMemo(() => {
    return YEAR_OFFSETS.map((offset, i) => ({
      year: baseYear + offset,
      positivo: seriesPositivo[i]?.value,
      regular: seriesRegular[i]?.value,
      negativo: seriesNegativo[i]?.value,
      activo: seriesActivo[i]?.value,
    }));
  }, [seriesPositivo, seriesRegular, seriesNegativo, seriesActivo, baseYear]);

  const tdsMidHorizonte = seriesActivo[4]?.value; // offset +11 años
  const yearsToLimit = threshold != null ? yearsToThreshold(seriesActivo, threshold) : null;

  let riesgo = '—', riesgoColor = '#6b7574', accion = '—', badge = 'Escenario personalizado', badgeClass = 'sb-badge--warn';
  if (yearsToLimit != null) {
    if (yearsToLimit <= 8) {
      riesgo = '🔴 Crítico'; riesgoColor = '#b3422f';
      accion = 'Iniciar estudios de fuente alternativa. Revisar capacidad OI actual.';
      badge = 'Escenario negativo'; badgeClass = 'sb-badge--crit';
    } else if (yearsToLimit <= 15) {
      riesgo = '🟡 Moderado'; riesgoColor = '#93690f';
      accion = 'Instalar dataloggers y TER. Modelamiento numérico urgente.';
      badge = 'Escenario regular'; badgeClass = 'sb-badge--warn';
    } else {
      riesgo = '🟢 Bajo'; riesgoColor = '#2f6d4f';
      accion = 'Monitoreo continuo. Plan de gestión preventiva a 10 años.';
      badge = 'Escenario positivo'; badgeClass = 'sb-badge--ok';
    }
  } else {
    riesgo = '🟢 Bajo'; riesgoColor = '#2f6d4f';
    accion = 'No se proyecta cruce del umbral en 30 años con estos supuestos.';
    badge = 'Escenario positivo'; badgeClass = 'sb-badge--ok';
  }

  const matchedPreset = Object.entries(PRESETS).find(
    ([key, p]) => key !== 'reset' && p.ext === sliders.ext && p.mar === sliders.mar && p.rec === sliders.rec && p.reg === sliders.reg
  )?.[0];

  const loading = loadingWells || loadingParameter || loadingBase;

  if (loading) {
    return <div className="sb-card"><p className="sb-status-text">Cargando…</p></div>;
  }

  if (notFound) {
    return <div className="sb-card sb-card--error" role="alert"><p className="sb-status-text">El parámetro TDS no está en el catálogo.</p></div>;
  }

  if (baseError) {
    return <div className="sb-card sb-card--error" role="alert"><p className="sb-status-text">No se pudo cargar: {baseError}</p></div>;
  }

  if (baseValue == null || threshold == null) {
    return (
      <div className="sb-card sb-card--error" role="alert">
        <p className="sb-status-text">
          {baseValue == null && 'No hay ninguna lectura de TDS registrada para este pozo. '}
          {threshold == null && 'No hay umbral crítico de TDS configurado para este pozo (usa el Configurador de Umbrales, Sesión 3-C).'}
        </p>
      </div>
    );
  }

  return (
    <section className="sb-card">
      <header className="sb-card-header">
        <div>
          <span className="sb-eyebrow">Análisis y modelo</span>
          <h2 className="sb-title">Constructor de escenarios — TDS</h2>
        </div>
        <select className="sb-well-select" value={wellId} onChange={(e) => setWellId(e.target.value)}>
          {wells.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
        </select>
      </header>

      <p className="sb-data-note">
        Base: {baseValue.toLocaleString('es-PE')} mg/L (última lectura, {baseYear}) · Umbral crítico:{' '}
        {threshold.toLocaleString('es-PE')} mg/L (configurado en Umbrales) · Tasa base estimada:{' '}
        {baseRate != null ? `${(baseRate * 100).toFixed(1)}%/año (del histórico real)` : `${(DEFAULT_RATE * 100).toFixed(1)}%/año (sin histórico suficiente, valor por defecto)`}
      </p>

      <div className="sb-sliders-grid">
        <div className="sb-slider-field">
          <div className="sb-slider-label-row">
            <span>💧 Extracción planta</span>
            <span className="sb-slider-value">{sliders.ext}%</span>
          </div>
          <input type="range" min={60} max={100} step={5} value={sliders.ext} onChange={(e) => setSlider('ext', e.target.value)} className="sb-range" />
          <div className="sb-slider-minmax"><span>60% licencia</span><span>100% licencia</span></div>
        </div>

        <div className="sb-slider-field">
          <div className="sb-slider-label-row">
            <span>🌊 Nivel del mar</span>
            <span className="sb-slider-value">{MAR_LABELS[sliders.mar]}</span>
          </div>
          <input type="range" min={0} max={2} step={1} value={sliders.mar} onChange={(e) => setSlider('mar', e.target.value)} className="sb-range" />
          <div className="sb-slider-minmax"><span>RCP 4.5</span><span>RCP 8.5</span></div>
        </div>

        <div className="sb-slider-field">
          <div className="sb-slider-label-row">
            <span>🌧️ Recarga cuenca</span>
            <span className="sb-slider-value">{sliders.rec >= 0 ? '+' : ''}{sliders.rec}%</span>
          </div>
          <input type="range" min={-20} max={10} step={5} value={sliders.rec} onChange={(e) => setSlider('rec', e.target.value)} className="sb-range" />
          <div className="sb-slider-minmax"><span>−20%</span><span>+10%</span></div>
        </div>

        <div className="sb-slider-field">
          <div className="sb-slider-label-row">
            <span>🔗 Extracción regional</span>
            <span className="sb-slider-value">{sliders.reg > 0 ? '+' : ''}{sliders.reg}%</span>
          </div>
          <input type="range" min={0} max={40} step={5} value={sliders.reg} onChange={(e) => setSlider('reg', e.target.value)} className="sb-range" />
          <div className="sb-slider-minmax"><span>Sin crecim.</span><span>+40% / 10a</span></div>
        </div>
      </div>

      <div className="sb-presets-row">
        <span className="sb-presets-label">Presets:</span>
        <button type="button" className={`sb-preset-btn ${matchedPreset === 'pos' ? 'sb-preset-btn--active' : ''}`} onClick={() => applyPreset('pos')}>🟢 Positivo</button>
        <button type="button" className={`sb-preset-btn ${matchedPreset === 'reg' ? 'sb-preset-btn--active' : ''}`} onClick={() => applyPreset('reg')}>🟡 Regular</button>
        <button type="button" className={`sb-preset-btn ${matchedPreset === 'neg' ? 'sb-preset-btn--active' : ''}`} onClick={() => applyPreset('neg')}>🔴 Negativo</button>
        <button type="button" className="sb-preset-btn" onClick={() => applyPreset('reset')}>↺ Reset</button>
        <span className="sb-flex-spacer" />
        <span className={`sb-badge ${badgeClass}`}>{badge}</span>
      </div>

      <div className="sb-plot">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e9e3d4" />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#5b6b6a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#5b6b6a' }} label={{ value: 'mg/L', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#5b6b6a' }} />
            <Tooltip formatter={(v) => (v != null ? `${Number(v).toLocaleString('es-PE')} mg/L` : '—')} />
            <Legend wrapperStyle={{ fontSize: '0.72rem' }} />
            <Line type="monotone" dataKey="positivo" name="Positivo" stroke="#2f6d4f" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="regular" name="Regular" stroke="#93690f" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="negativo" name="Negativo" stroke="#b3422f" strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="activo" name="Activo (sliders)" stroke="#2563a8" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            <ReferenceLine y={threshold} stroke="#93690f" strokeDasharray="6 3" label={{ value: `Umbral (${threshold.toLocaleString('es-PE')})`, fontSize: 10, fill: '#93690f', position: 'insideTopRight' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="sb-kpi-grid">
        <div className="sb-kpi">
          <div className="sb-kpi-label">TDS proyectado +11 años</div>
          <div className="sb-kpi-value" style={{ color: riesgoColor }}>{tdsMidHorizonte?.toLocaleString('es-PE') ?? '—'}</div>
          <div className="sb-kpi-sub">mg/L · escenario activo</div>
        </div>
        <div className="sb-kpi">
          <div className="sb-kpi-label">Años al umbral crítico</div>
          <div className="sb-kpi-value" style={{ color: riesgoColor }}>{yearsToLimit != null ? `~${yearsToLimit}` : '+30'}</div>
          <div className="sb-kpi-sub">Escenario activo</div>
        </div>
        <div className="sb-kpi">
          <div className="sb-kpi-label">Riesgo operacional</div>
          <div className="sb-kpi-value sb-kpi-value--text" style={{ color: riesgoColor }}>{riesgo}</div>
        </div>
        <div className="sb-kpi">
          <div className="sb-kpi-label">Acción recomendada</div>
          <div className="sb-kpi-value sb-kpi-value--action">{accion}</div>
        </div>
      </div>
    </section>
  );
}
