import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperatorLayout } from './components/OperatorLayout';
import { CaudalReadingForm } from './components/CaudalReadingForm';
import { IngestionStatusPanel } from './components/IngestionStatusPanel';
import { ThresholdConfig } from './components/ThresholdConfig';
import { HistoricalChart } from './components/HistoricalChart';
import { ModelComparison } from './components/ModelComparison';

// Sesión 4-B: se agrega el comparador observado vs. proyección del modelo.
// Sin datos de proyección cargados todavía, se muestra solo lo observado
// con un aviso — normal hasta que exista el estudio hidrogeológico.

function App() {
  return (
    <>
      <OperatorLayout />
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ModelComparison />
        <HistoricalChart />
        <ThresholdConfig />
        <IngestionStatusPanel />
        <CaudalReadingForm />
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
