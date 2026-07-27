import React from 'react';
import ReactDOM from 'react-dom/client';
import { CaudalReadingForm } from './components/CaudalReadingForm';

// TODO Sesión futura: montar router + layout completo (login, navegación,
// dashboard). Por ahora se monta directo el formulario de la Sesión 1-A
// para poder probarlo de forma aislada.

function App() {
  return (
    <main style={{ padding: '2rem 1rem' }}>
      <CaudalReadingForm />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
