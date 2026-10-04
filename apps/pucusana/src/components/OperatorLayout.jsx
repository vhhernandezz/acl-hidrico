import React, { useState } from 'react';
import { OperatorKPICards } from './OperatorKPICards';
import { CEHourlyChart } from './CEHourlyChart';
import { OperationalCharts } from './OperationalCharts';
import { ConsultorView } from './ConsultorView';
import './OperatorLayout.css';

/**
 * OperatorLayout
 * Shell de header + sidebar + topbar. Desde la Sesión 5-C, el sidebar ya
 * no es 100% estático: "Monitoreo en vivo" y "Datos crudos" son vistas
 * intercambiables (activeView), el resto sigue bloqueado/placeholder.
 */

const LOCKED_NAV_ITEMS_PUCUSANA = [
  { label: 'Alertas', icon: '🔔' },
  { label: 'Análisis y modelo', icon: '📈' },
];

const LOCKED_PLANTS = ['Arequipa', 'Cusco', 'Iquitos', 'Trujillo', 'Zárate / Lima'];

function LockIcon() {
  return <span className="ol-lock-icon" aria-hidden="true">🔒</span>;
}

export function OperatorLayout() {
  const [activeView, setActiveView] = useState('live'); // 'live' | 'raw'

  return (
    <div className="ol-shell">
      <header className="ol-header">
        <div className="ol-logo">
          <div className="ol-logo-icon" aria-hidden="true">💧</div>
          <div>
            <div className="ol-logo-text">ACL Gestión Hídrica</div>
            <div className="ol-logo-sub">Arca Continental Lindley — Perú</div>
          </div>
        </div>
        <div className="ol-header-sep" />
        <div className="ol-header-title">Spoke Pucusana</div>
        <span className="ol-badge ol-badge-info">Operador</span>
      </header>

      <div className="ol-layout">
        <nav className="ol-sidebar">
          <div className="ol-nav-section">Planta Pucusana</div>
          <button
            type="button"
            className={`ol-nav-item ol-nav-item--button ${activeView === 'live' ? 'ol-nav-item--active' : ''}`}
            onClick={() => setActiveView('live')}
          >
            <span aria-hidden="true">📊</span> Monitoreo en vivo
          </button>
          <button
            type="button"
            className={`ol-nav-item ol-nav-item--button ${activeView === 'raw' ? 'ol-nav-item--active' : ''}`}
            onClick={() => setActiveView('raw')}
          >
            <span aria-hidden="true">🗄️</span> Datos crudos
          </button>
          {LOCKED_NAV_ITEMS_PUCUSANA.map((item) => (
            <div className="ol-nav-item ol-nav-item--locked" key={item.label} title="Próximamente">
              <span aria-hidden="true">{item.icon}</span> {item.label} <LockIcon />
            </div>
          ))}

          <div className="ol-nav-section">Otras plantas</div>
          {LOCKED_PLANTS.map((plant) => (
            <div className="ol-nav-item ol-nav-item--locked" key={plant} title="Aún no conectada">
              <LockIcon /> {plant}
            </div>
          ))}
        </nav>

        <main className="ol-main">
          <div className="ol-topbar">
            <div className="ol-topbar-title">
              {activeView === 'live' ? 'Monitoreo en vivo — Pucusana' : 'Datos crudos — Pucusana'}
            </div>
          </div>

          <div className="ol-content">
            {activeView === 'live' ? (
              <>
                <OperatorKPICards />
                <CEHourlyChart />
                <OperationalCharts />
              </>
            ) : (
              <ConsultorView />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
