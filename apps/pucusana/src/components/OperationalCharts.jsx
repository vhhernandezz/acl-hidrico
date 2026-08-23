import React, { useEffect, useState } from 'react';
import { useWells } from '../hooks/useWells';
import { useParameterByCode } from '../hooks/useParameterByCode';
import { ParameterHourlyChart } from './ParameterHourlyChart';
import './OperationalCharts.css';

const NIVEL_PARAMETER_CODE = 'NIVEL_AGUA';
const CAUDAL_PARAMETER_CODE = 'CAUDAL_EXTRACCION';

const NIVEL_HOURS_WINDOW = 48;   // telemetría continua del datalogger
const CAUDAL_HOURS_WINDOW = 168; // 7 días: el caudal se ingresa manualmente, con menor frecuencia

/**
 * OperationalCharts (Sesión 2-B)
 * Panel operativo con dos gráficos horarios en vivo, mismo patrón y misma
 * conexión Realtime que CEHourlyChart (Sesión 2-A): Nivel de Napa
 * (telemetría continua) y Caudal de Extracción (ingreso manual).
 * Un solo selector de pozo controla ambos gráficos a la vez.
 */
export function OperationalCharts() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');

  const {
    parameter: nivelParameter,
    loading: loadingNivelParam,
    notFound: nivelNotFound,
  } = useParameterByCode(NIVEL_PARAMETER_CODE);

  const {
    parameter: caudalParameter,
    loading: loadingCaudalParam,
    notFound: caudalNotFound,
  } = useParameterByCode(CAUDAL_PARAMETER_CODE);

  useEffect(() => {
    if (!wellId && wells.length > 0) setWellId(wells[0].id);
  }, [wells, wellId]);

  const loadingCatalog = loadingWells || loadingNivelParam || loadingCaudalParam;

  if (loadingCatalog) {
    return (
      <div className="opc-card">
        <p className="opc-status-text">Cargando…</p>
      </div>
    );
  }

  if (nivelNotFound || caudalNotFound) {
    return (
      <div className="opc-card opc-card--error" role="alert">
        <p className="opc-status-text">
          Faltan parámetros en el catálogo:
          {nivelNotFound ? ' NIVEL_AGUA' : ''}
          {nivelNotFound && caudalNotFound ? ' y' : ''}
          {caudalNotFound ? ' CAUDAL_EXTRACCION' : ''}.
        </p>
      </div>
    );
  }

  return (
    <section className="opc-card">
      <header className="opc-card-header">
        <div>
          <span className="opc-eyebrow">Dashboard operador</span>
          <h2 className="opc-title">Nivel de napa y caudal de extracción</h2>
        </div>
      </header>

      <div className="opc-controls">
        <label htmlFor="opc-well-select" className="opc-label">Pozo</label>
        <select
          id="opc-well-select"
          className="opc-select"
          value={wellId}
          onChange={(e) => setWellId(e.target.value)}
        >
          {wells.map((well) => (
            <option key={well.id} value={well.id}>{well.code} — {well.name}</option>
          ))}
        </select>
      </div>

      <ParameterHourlyChart
        wellId={wellId}
        parameter={nivelParameter}
        color="#0f5c5a"
        hoursWindow={NIVEL_HOURS_WINDOW}
        emptyHint="Verifica que el datalogger esté reportando."
      />

      <ParameterHourlyChart
        wellId={wellId}
        parameter={caudalParameter}
        color="#4f8a4f"
        hoursWindow={CAUDAL_HOURS_WINDOW}
        emptyHint="El caudal se registra manualmente — usa el formulario de ingreso."
      />
    </section>
  );
}
