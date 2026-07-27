import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useWells } from '../hooks/useWells';
import { useCaudalParameter } from '../hooks/useCaudalParameter';
import './CaudalReadingForm.css';

/** Devuelve el valor por defecto para un <input type="datetime-local"> = ahora, en hora local. */
function nowForDatetimeLocalInput() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  const local = new Date(now.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

const STATUS = {
  IDLE: 'idle',
  SUBMITTING: 'submitting',
  SUCCESS: 'success',
  ERROR: 'error',
};

export function CaudalReadingForm() {
  const { wells, loading: loadingWells, error: wellsError } = useWells();
  const {
    parameter,
    loading: loadingParameter,
    error: parameterError,
    notFound: parameterNotFound,
  } = useCaudalParameter();

  const [wellId, setWellId] = useState('');
  const [recordedAt, setRecordedAt] = useState(nowForDatetimeLocalInput());
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(STATUS.IDLE);
  const [submitError, setSubmitError] = useState(null);

  const isReady = !loadingWells && !loadingParameter && !parameterNotFound && !wellsError && !parameterError;
  const canSubmit = isReady && wellId !== '' && value !== '' && recordedAt !== '' && status !== STATUS.SUBMITTING;

  const unitLabel = parameter?.unit ?? '';

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit || !parameter) return;

    setStatus(STATUS.SUBMITTING);
    setSubmitError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData?.session?.user;

    if (!currentUser) {
      setStatus(STATUS.ERROR);
      setSubmitError('No hay una sesión activa. Inicia sesión para registrar lecturas.');
      return;
    }

    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      setStatus(STATUS.ERROR);
      setSubmitError('El caudal debe ser un número válido.');
      return;
    }

    const { error: insertError } = await supabase.from('readings').insert({
      well_id: wellId,
      parameter_id: parameter.id,
      recorded_at: new Date(recordedAt).toISOString(),
      value: numericValue,
      source: 'manual',
      notes: notes.trim() || null,
      created_by: currentUser.id,
    });

    if (insertError) {
      setStatus(STATUS.ERROR);
      setSubmitError(insertError.message);
      return;
    }

    setStatus(STATUS.SUCCESS);
    setValue('');
    setNotes('');
    setRecordedAt(nowForDatetimeLocalInput());
    // wellId se mantiene: en campo es común registrar varias lecturas seguidas del mismo pozo.
  }

  if (loadingWells || loadingParameter) {
    return (
      <div className="caudal-form-card" role="status" aria-live="polite">
        <p className="caudal-form-status-text">Cargando pozos y parámetros…</p>
      </div>
    );
  }

  if (wellsError || parameterError) {
    return (
      <div className="caudal-form-card caudal-form-card--error" role="alert">
        <p className="caudal-form-status-text">
          No se pudo cargar el formulario: {wellsError || parameterError}
        </p>
      </div>
    );
  }

  if (parameterNotFound) {
    return (
      <div className="caudal-form-card caudal-form-card--error" role="alert">
        <p className="caudal-form-status-text">
          El parámetro de caudal (código <code>CAUDAL_EXTRACCION</code>) no está configurado en el
          catálogo. Pide al administrador que lo agregue en la tabla <code>parameters</code>.
        </p>
      </div>
    );
  }

  return (
    <form className="caudal-form-card" onSubmit={handleSubmit} noValidate>
      <header className="caudal-form-header">
        <span className="caudal-form-eyebrow">Registro de campo</span>
        <h2 className="caudal-form-title">Ingreso manual de caudal</h2>
      </header>

      <div className="caudal-form-field">
        <label htmlFor="well" className="caudal-form-label">Pozo</label>
        <select
          id="well"
          className="caudal-form-select"
          value={wellId}
          onChange={(e) => setWellId(e.target.value)}
          required
        >
          <option value="" disabled>Selecciona un pozo</option>
          {wells.map((well) => (
            <option key={well.id} value={well.id}>
              {well.code} — {well.name}
            </option>
          ))}
        </select>
        {wells.length === 0 && (
          <p className="caudal-form-hint">
            No hay pozos activos registrados aún. Verifica el seed de datos de Pucusana.
          </p>
        )}
      </div>

      <div className="caudal-form-field">
        <label htmlFor="recordedAt" className="caudal-form-label">Fecha y hora de medición</label>
        <input
          id="recordedAt"
          type="datetime-local"
          className="caudal-form-input"
          value={recordedAt}
          onChange={(e) => setRecordedAt(e.target.value)}
          required
        />
      </div>

      <div className="caudal-form-field">
        <label htmlFor="value" className="caudal-form-label">
          Caudal {unitLabel && <span className="caudal-form-unit">({unitLabel})</span>}
        </label>
        <input
          id="value"
          type="number"
          inputMode="decimal"
          step="any"
          className="caudal-form-input caudal-form-input--numeric"
          placeholder="0.00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
      </div>

      <div className="caudal-form-field">
        <label htmlFor="notes" className="caudal-form-label">
          Notas <span className="caudal-form-optional">(opcional)</span>
        </label>
        <textarea
          id="notes"
          className="caudal-form-textarea"
          rows={2}
          placeholder="Observaciones de la medición, si aplica"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {status === STATUS.ERROR && (
        <p className="caudal-form-banner caudal-form-banner--error" role="alert">
          No se pudo registrar: {submitError}
        </p>
      )}
      {status === STATUS.SUCCESS && (
        <p className="caudal-form-banner caudal-form-banner--success" role="status">
          Lectura registrada correctamente.
        </p>
      )}

      <button type="submit" className="caudal-form-submit" disabled={!canSubmit}>
        {status === STATUS.SUBMITTING ? 'Registrando…' : 'Registrar lectura'}
      </button>
    </form>
  );
}
