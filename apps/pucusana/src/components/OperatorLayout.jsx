import React from 'react';
import { OperatorKPICards } from './OperatorKPICards';
import { CEHourlyChart } from './CEHourlyChart';
import { OperationalCharts } from './OperationalCharts';
import './OperatorLayout.css';

/**
 * OperatorLayout (Sesión 2-D)
 * Ensambla las Sesiones 2-A (CEHourlyChart), 2-B (OperationalCharts) y
 * 2-C (OperatorKPICards) en la vista final del operador, con el shell de
 * header + sidebar + topbar. Estructura fiel al prototipo aprobado por el
 * cliente (ACL_Hidrico_Prototipo_v2.html), adaptada a la paleta clara
 * actual (no al tema oscuro del prototipo — decisión de esta sesión).
 *
 * Cada gráfico/tarjeta sigue usando su propio selector de pozo (patrón ya
 * construido); la vista dual de ambos pozos a la vez, como muestra el
 * prototipo, queda pendiente para una sesión futura.
 *
 * Los ítems de sidebar sin construir (Alertas, Análisis y modelo, Datos
 * crudos, otras plantas) se muestran bloqueados, igual que en el
 * prototipo, para no prometer funcionalidad que aún no existe.
 */

const LOCKED_NAV_ITEMS_PUCUSANA = [
  { label: 'Alertas', icon: '🔔' },
  { label: 'Análisis y modelo', icon: '📈' },
  { label: 'Datos crudos', icon: '🗄️' },
];

const LOCKED_PLANTS = ['Arequipa', 'Cusco', 'Iquitos', 'Trujillo', 'Zárate / Lima'];

function LockIcon() {
  return <span className="ol-lock-icon" aria-hidden="true">🔒</span>;
}

export function OperatorLayout() {
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
        <div className="ol-header-title">Spoke Pucusana — Monitoreo en vivo</div>
        <span className="ol-badge ol-badge-info">Operador</span>
      </header>

      <div className="ol-layout">
        <nav className="ol-sidebar">
          <div className="ol-nav-section">Planta Pucusana</div>
          <div className="ol-nav-item ol-nav-item--active">
            <span aria-hidden="true">📊</span> Monitoreo en vivo
          </div>
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
            <div className="ol-topbar-title">Monitoreo en vivo — Pucusana</div>
          </div>

          <div className="ol-content">
            <OperatorKPICards />
            <CEHourlyChart />
            <OperationalCharts />
          </div>
        </main>
      </div>
    </div>
  );
}
