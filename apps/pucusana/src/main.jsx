import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperatorLayout } from './components/OperatorLayout';
import { CaudalReadingForm } from './components/CaudalReadingForm';
import { IngestionStatusPanel } from './components/IngestionStatusPanel';

// Sesión 2-D: la vista final del operador ya ensambla 2-A, 2-B y 2-C
// dentro de OperatorLayout (con su propio shell de header/sidebar/topbar).
// El formulario de caudal (1-A) y el panel de ingesta (1-D) se mantienen
// aparte por ahora, como herramientas de prueba/soporte — su integración
// definitiva al layout (¿dentro de "Monitoreo en vivo"? ¿ítem propio del
// sidebar?) queda pendiente de decidir en una sesión futura.

function App() {
  return (
    <>
      <OperatorLayout />
      <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <IngestionStatusPanel />
        <CaudalReadingForm />
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
