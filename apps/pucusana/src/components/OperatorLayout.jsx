import React, { useState } from 'react';
import { useAuth } from '../auth';
import { OperatorKPICards } from './OperatorKPICards';
import { CEHourlyChart } from './CEHourlyChart';
import { OperationalCharts } from './OperationalCharts';
import { ConsultorView } from './ConsultorView';
import { Direccion } from './Direccion';
import './OperatorLayout.css';

/**
 * OperatorLayout
 * Shell de header + sidebar + topbar. "Monitoreo en vivo" y "Datos crudos"
 * son vistas intercambiables. Desde la Sesión 5-C el layout conoce el rol:
 * el consultor externo ve SOLO "Datos crudos" (sin el monitoreo en vivo,
 * que muestra umbrales, ni los placeholders de otras plantas), y el badge
 * del header muestra el rol real en vez de un "Operador" fijo.
 * Sesión 5D: vista "Dirección técnica" (admin y director_tecnico). Como el
 * resto del filtrado por rol, es comodidad de UI; la barrera real es RLS.
 */

const LOCKED_NAV_ITEMS_PUCUSANA = [
  { label: 'Alertas', icon: '🔔' },
  { label: 'Análisis y modelo', icon: '📈' },
];

const LOCKED_PLANTS = ['Arequipa', 'Cusco', 'Iquitos', 'Trujillo', 'Zárate / Lima'];

const ROLES_DIRECCION = ['admin', 'director_tecnico'];

const TITULOS = {
  live: 'Monitoreo en vivo — Pucusana',
  raw: 'Datos crudos — Pucusana',
  direccion: 'Dirección técnica — Pucusana',
};

const ROLE_LABELS = {
  admin: 'Administrador',
  director_tecnico: 'Director técnico',
  operador_planta: 'Operador',
  visor: 'Visor',
  consultor_externo: 'Consultor externo',
};

function LockIcon() {
  return <span className="ol-lock-icon" aria-hidden="true">🔒</span>;
}

export function OperatorLayout() {
  const { role } = useAuth();
  const esConsultor = role === 'consultor_externo';
  const puedeVerDireccion = ROLES_DIRECCION.includes(role);
  const [activeView, setActiveView] = useState('live'); // 'live' | 'raw' | 'direccion'

  // El consultor siempre cae en 'raw', sin depender de estado inicial.
  // 'direccion' exige rol autorizado; si no, vuelve a 'live'.
  const vistaEfectiva = esConsultor
    ? 'raw'
    : activeView === 'direccion' && !puedeVerDireccion
      ? 'live'
      : activeView;

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
        <span className="ol-badge ol-badge-info">{ROLE_LABELS[role] ?? '—'}</span>
      </header>

      <div className="ol-layout">
        <nav className="ol-sidebar">
          <div className="ol-nav-section">Planta Pucusana</div>
          {!esConsultor && (
            <button
              type="button"
              className={`ol-nav-item ol-nav-item--button ${vistaEfectiva === 'live' ? 'ol-nav-item--active' : ''}`}
              onClick={() => setActiveView('live')}
            >
              <span aria-hidden="true">📊</span> Monitoreo en vivo
            </button>
          )}
          {puedeVerDireccion && (
            <button
              type="button"
              className={`ol-nav-item ol-nav-item--button ${vistaEfectiva === 'direccion' ? 'ol-nav-item--active' : ''}`}
              onClick={() => setActiveView('direccion')}
            >
              <span aria-hidden="true">🧭</span> Dirección técnica
            </button>
          )}
          <button
            type="button"
            className={`ol-nav-item ol-nav-item--button ${vistaEfectiva === 'raw' ? 'ol-nav-item--active' : ''}`}
            onClick={() => setActiveView('raw')}
          >
            <span aria-hidden="true">🗄️</span> Datos crudos
          </button>

          {!esConsultor && (
            <>
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
            </>
          )}
        </nav>

        <main className="ol-main">
          <div className="ol-topbar">
            <div className="ol-topbar-title">
              {TITULOS[vistaEfectiva]}
            </div>
          </div>

          <div className="ol-content">
            {vistaEfectiva === 'live' && (
              <>
                <OperatorKPICards />
                <CEHourlyChart />
                <OperationalCharts />
              </>
            )}
            {vistaEfectiva === 'direccion' && <Direccion />}
            {vistaEfectiva === 'raw' && <ConsultorView />}
          </div>
        </main>
      </div>
    </div>
  );
}
