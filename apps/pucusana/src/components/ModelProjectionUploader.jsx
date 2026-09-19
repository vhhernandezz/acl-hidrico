import React, { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';
import './ModelProjectionUploader.css';

const REQUIRED_COLUMNS = ['well_code', 'parameter_code', 'model_name', 'scenario', 'projection_date', 'projected_value'];
const VALID_SCENARIOS = new Set(['optimista', 'base', 'pesimista']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateRows(rawRows, wellMap, paramMap) {
  const valid = [];
  const errors = [];

  rawRows.forEach((row, idx) => {
    const lineNum = idx + 2; // fila 1 es el header
    const rowErrors = [];

    const wellCode = (row.well_code || '').trim();
    const wellId = wellMap.get(wellCode);
    if (!wellId) rowErrors.push(`well_code '${wellCode}' no existe`);

    const paramCode = (row.parameter_code || '').trim();
    const paramId = paramMap.get(paramCode);
    if (!paramId) rowErrors.push(`parameter_code '${paramCode}' no existe`);

    const scenario = (row.scenario || '').trim();
    if (!VALID_SCENARIOS.has(scenario)) rowErrors.push(`scenario '${scenario}' inválido`);

    const dateStr = (row.projection_date || '').trim();
    if (!DATE_RE.test(dateStr)) rowErrors.push(`projection_date '${dateStr}' no es YYYY-MM-DD`);

    const value = Number(row.projected_value);
    if (Number.isNaN(value)) rowErrors.push(`projected_value '${row.projected_value}' no es numérico`);

    const modelName = (row.model_name || '').trim();
    if (!modelName) rowErrors.push('model_name vacío');

    if (rowErrors.length > 0) {
      errors.push(`Línea ${lineNum}: ${rowErrors.join('; ')}`);
      return;
    }

    valid.push({
      well_id: wellId,
      parameter_id: paramId,
      model_name: modelName,
      scenario,
      projection_date: dateStr,
      projected_value: value,
    });
  });

  return { valid, errors };
}

const STATUS = { IDLE: 'idle', PARSING: 'parsing', READY: 'ready', UPLOADING: 'uploading', DONE: 'done', ERROR: 'error' };

export function ModelProjectionUploader() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [fileName, setFileName] = useState('');
  const [validRows, setValidRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [uploadedCount, setUploadedCount] = useState(0);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStatus(STATUS.PARSING);
    setUploadError(null);
    setValidRows([]);
    setParseErrors([]);

    const { data: wells } = await supabase.from('wells').select('id, code');
    const { data: parameters } = await supabase.from('parameters').select('id, code');
    const wellMap = new Map((wells ?? []).map((w) => [w.code, w.id]));
    const paramMap = new Map((parameters ?? []).map((p) => [p.code, p.id]));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields ?? [];
        const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
        if (missing.length > 0) {
          setParseErrors([`Faltan columnas en el CSV: ${missing.join(', ')}`]);
          setStatus(STATUS.ERROR);
          return;
        }

        const { valid, errors } = validateRows(results.data, wellMap, paramMap);
        setValidRows(valid);
        setParseErrors(errors);
        setStatus(STATUS.READY);
      },
      error: (err) => {
        setParseErrors([`No se pudo leer el archivo: ${err.message}`]);
        setStatus(STATUS.ERROR);
      },
    });
  }

  async function handleUpload() {
    setStatus(STATUS.UPLOADING);
    setUploadError(null);

    const { data, error } = await supabase
      .from('model_projections')
      .upsert(validRows, { onConflict: 'well_id,parameter_id,model_name,scenario,projection_date' })
      .select('id');

    if (error) {
      setUploadError(error.message);
      setStatus(STATUS.ERROR);
      return;
    }

    setUploadedCount(data?.length ?? validRows.length);
    setStatus(STATUS.DONE);
  }

  return (
    <section className="mpu-card">
      <header className="mpu-card-header">
        <span className="mpu-eyebrow">Análisis y modelo</span>
        <h2 className="mpu-title">Cargar proyecciones (CSV)</h2>
      </header>

      <p className="mpu-hint">
        Formato esperado: <code>well_code,parameter_code,model_name,scenario,projection_date,projected_value</code>
      </p>

      <input
        type="file"
        accept=".csv"
        className="mpu-file-input"
        onChange={handleFileChange}
        disabled={status === STATUS.PARSING || status === STATUS.UPLOADING}
      />

      {fileName && <p className="mpu-filename">Archivo: {fileName}</p>}

      {status === STATUS.PARSING && <p className="mpu-status-text">Leyendo y validando…</p>}

      {parseErrors.length > 0 && (
        <div className="mpu-banner mpu-banner--error">
          <strong>{parseErrors.length} error{parseErrors.length === 1 ? '' : 'es'} encontrado{parseErrors.length === 1 ? '' : 's'}:</strong>
          <ul className="mpu-error-list">
            {parseErrors.slice(0, 15).map((e, i) => <li key={i}>{e}</li>)}
            {parseErrors.length > 15 && <li>… y {parseErrors.length - 15} más</li>}
          </ul>
        </div>
      )}

      {(status === STATUS.READY || status === STATUS.UPLOADING) && validRows.length > 0 && (
        <>
          <p className="mpu-summary">
            {validRows.length} fila{validRows.length === 1 ? '' : 's'} válida{validRows.length === 1 ? '' : 's'}, listas para cargar.
          </p>
          <button
            type="button"
            className="mpu-upload-btn"
            onClick={handleUpload}
            disabled={status === STATUS.UPLOADING}
          >
            {status === STATUS.UPLOADING ? 'Cargando…' : `Cargar ${validRows.length} filas a Supabase`}
          </button>
        </>
      )}

      {uploadError && (
        <p className="mpu-banner mpu-banner--error">No se pudo cargar: {uploadError}</p>
      )}

      {status === STATUS.DONE && (
        <p className="mpu-banner mpu-banner--success">
          {uploadedCount} filas insertadas/actualizadas correctamente.
        </p>
      )}
    </section>
  );
}
