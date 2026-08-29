import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperatorLayout } from './components/OperatorLayout';
import { CaudalReadingForm } from './components/CaudalReadingForm';
import { IngestionStatusPanel } from './components/IngestionStatusPanel';
import { ThresholdConfig } from './components/ThresholdConfig';

// Sesión 3-C: se agrega el Configurador de Umbrales, montado aparte
// (herramienta técnica, no forma parte del dashboard del operador).

function App() {
  return (
    <>
      <OperatorLayout />
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ThresholdConfig />
        <IngestionStatusPanel />
        <CaudalReadingForm />
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
