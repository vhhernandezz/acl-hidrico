import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useWells } from '../hooks/useWells';
import { useConsultorReadings } from '../hooks/useConsultorReadings';
import './ConsultorView.css';

function toExportRows(rawRows) {
  return rawRows.map((r) => ({
    pozo: r.wells?.code ?? '',
    pozo_nombre: r.wells?.name ?? '',
    parametro: r.parameters?.code ?? '',
    valor: r.value,
    unidad: r.parameters?.unit ?? '',
    fecha: new Date(r.recorded_at).toISOString(),
    fuente: r.source,
  }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ConsultorView() {
  const { wells, loading: loadingWells } = useWells();
  const [wellId, setWellId] = useState('');
  const [parameterId, setParameterId] = useState('');
  const [parameters, setParameters] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Catálogo de parámetros para el filtro (carga una sola vez)
  React.useEffect(() => {
    import('../lib/supabaseClient').then(({ supabase }) => {
      supabase.from('parameters').select('id, code, name').order('name').then(({ data }) => {
        setParameters(data ?? []);
      });
    });
  }, []);

  const filters = {
    wellId: wellId || undefined,
    parameterId: parameterId || undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  };

  const { rows, totalCount, page, setPage, pageCount, loading, error, fetchAllForExport } =
    useConsultorReadings(filters);

  async function handleExport(format) {
    setExporting(true);
    setExportError(null);
    try {
      const all = await fetchAllForExport();
      const exportRows = toExportRows(all);
      const timestamp = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csv = Papa.unparse(exportRows);
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `lecturas_pucusana_${timestamp}.csv`);
      } else {
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lecturas');
        XLSX.writeFile(wb, `lecturas_pucusana_${timestamp}.xlsx`);
      }
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="cv-panel">
      <header className="cv-panel-header">
        <div>
          <span className="cv-eyebrow">Datos crudos</span>
          <h2 className="cv-title">Lecturas — Pucusana</h2>
        </div>
        <span className="cv-count">{totalCount.toLocaleString('es-PE')} lectura{totalCount === 1 ? '' : 's'}</span>
      </header>

      <div className="cv-filters">
        <div className="cv-filter-field">
          <label className="cv-filter-label" htmlFor="cv-well">Pozo</label>
          <select id="cv-well" className="cv-select" value={wellId} onChange={(e) => setWellId(e.target.value)} disabled={loadingWells}>
            <option value="">Todos</option>
            {wells.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
          </select>
        </div>

        <div className="cv-filter-field">
          <label className="cv-filter-label" htmlFor="cv-param">Parámetro</label>
          <select id="cv-param" className="cv-select" value={parameterId} onChange={(e) => setParameterId(e.target.value)}>
            <option value="">Todos</option>
            {parameters.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="cv-filter-field">
          <label className="cv-filter-label" htmlFor="cv-from">Desde</label>
          <input id="cv-from" type="date" className="cv-date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>

        <div className="cv-filter-field">
          <label className="cv-filter-label" htmlFor="cv-to">Hasta</label>
          <input id="cv-to" type="date" className="cv-date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="cv-export-row">
        <button type="button" className="cv-export-btn" onClick={() => handleExport('csv')} disabled={exporting || totalCount === 0}>
          {exporting ? 'Exportando…' : '⬇ Exportar CSV'}
        </button>
        <button type="button" className="cv-export-btn" onClick={() => handleExport('xlsx')} disabled={exporting || totalCount === 0}>
          {exporting ? 'Exportando…' : '⬇ Exportar Excel'}
        </button>
        <span className="cv-export-note">Exporta TODAS las filas que coinciden con los filtros, no solo la página visible.</span>
      </div>

      {exportError && <p className="cv-banner cv-banner--error" role="alert">No se pudo exportar: {exportError}</p>}
      {error && <p className="cv-banner cv-banner--error" role="alert">No se pudo cargar: {error}</p>}

      {loading && <p className="cv-status-text">Cargando…</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="cv-status-text">Sin lecturas con estos filtros.</p>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="cv-table-wrap">
            <table className="cv-table">
              <thead>
                <tr>
                  <th>Pozo</th>
                  <th>Parámetro</th>
                  <th>Valor</th>
                  <th>Fecha</th>
                  <th>Fuente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.wells?.code}</td>
                    <td>{r.parameters?.name}</td>
                    <td className="cv-value-cell">{r.value} <span className="cv-unit">{r.parameters?.unit}</span></td>
                    <td>{new Date(r.recorded_at).toLocaleString('es-PE')}</td>
                    <td className="cv-source-cell">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cv-pagination">
            <button type="button" className="cv-page-btn" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              ← Anterior
            </button>
            <span className="cv-page-info">Página {page + 1} de {pageCount}</span>
            <button type="button" className="cv-page-btn" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>
              Siguiente →
            </button>
          </div>
        </>
      )}
    </section>
  );
}
