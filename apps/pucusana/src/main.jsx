import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperatorLayout } from './components/OperatorLayout';
import { CaudalReadingForm } from './components/CaudalReadingForm';
import { IngestionStatusPanel } from './components/IngestionStatusPanel';
import { ThresholdConfig } from './components/ThresholdConfig';
import { HistoricalChart } from './components/HistoricalChart';
import { ModelComparison } from './components/ModelComparison';
import { ModelProjectionUploader } from './components/ModelProjectionUploader';

// Sesión 4-C: se agrega el cargador web de proyecciones (alternativa al
// script Python, para cargas rápidas puntuales desde el navegador).

function App() {
  return (
    <>
      <OperatorLayout />
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ModelProjectionUploader />
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
