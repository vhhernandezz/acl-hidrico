import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperatorLayout } from './components/OperatorLayout';
import { CaudalReadingForm } from './components/CaudalReadingForm';
import { IngestionStatusPanel } from './components/IngestionStatusPanel';
import { ThresholdConfig } from './components/ThresholdConfig';
import { HistoricalChart } from './components/HistoricalChart';
import { ModelComparison } from './components/ModelComparison';
import { ModelProjectionUploader } from './components/ModelProjectionUploader';
import { ScenarioBuilder } from './components/ScenarioBuilder';

// Sesión 4-D: constructor de escenarios interactivo, versión mejorada del
// prototipo — conectado a datos reales (última lectura + umbral real) en
// vez de los valores ficticios que tenía el HTML original.

function App() {
  return (
    <>
      <OperatorLayout />
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ScenarioBuilder />
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
