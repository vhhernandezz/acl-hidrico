import React from 'react';
import ReactDOM from 'react-dom/client';
import { AlarmasActivasPanel } from './components/AlarmasActivasPanel';

// Sesión 3-B: primer componente real del Hub. Todavía no hay router ni
// layout propio del Hub (eso es una sesión futura, análoga a OperatorLayout
// pero para el Hub) — se monta el panel directo para poder probarlo.

function App() {
  return (
    <main style={{ padding: '2rem 1rem' }}>
      <AlarmasActivasPanel />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
