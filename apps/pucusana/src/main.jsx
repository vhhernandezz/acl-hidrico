import React from 'react';
import ReactDOM from 'react-dom/client';
import { LoginForm } from '@acl-hidrico/core';
import { AuthProvider, useAuth } from './auth';
import { OperatorLayout } from './components/OperatorLayout';
import { CaudalReadingForm } from './components/CaudalReadingForm';
import { IngestionStatusPanel } from './components/IngestionStatusPanel';
import { ThresholdConfig } from './components/ThresholdConfig';
import { HistoricalChart } from './components/HistoricalChart';
import { ModelComparison } from './components/ModelComparison';
import { ModelProjectionUploader } from './components/ModelProjectionUploader';
import { ScenarioBuilder } from './components/ScenarioBuilder';

// Sesión 5-C: los componentes se montan según el rol. Esto es comodidad de
// UI (no mostrar pantallas que van a fallar), NO la barrera de seguridad:
// la barrera real es RLS en la base de datos. Si el rol no se puede
// determinar, no se monta nada sensible (falla cerrado).

const ROLES_CONFIGURAN = ['admin', 'director_tecnico'];
const ROLES_INGRESAN_LECTURAS = ['admin', 'director_tecnico', 'operador_planta'];

function TopBar() {
  const { user, profile, signOut } = useAuth();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      gap: '0.75rem', padding: '0.4rem 1rem', background: '#fff',
      borderBottom: '1px solid #e9e3d4', fontSize: '0.8rem', color: '#5b6b6a',
    }}>
      <span>{user?.email} {profile?.role ? `· ${profile.role}` : ''}</span>
      <button
        onClick={signOut}
        style={{
          padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: 600,
          color: '#0f5c5a', background: '#fff', border: '1px solid #0f5c5a',
          borderRadius: '0.35rem', cursor: 'pointer',
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}

function Mensaje({ children }) {
  return <p style={{ padding: '2rem', fontFamily: 'system-ui', color: '#5b6b6a' }}>{children}</p>;
}

function AppContent() {
  const { role, profile } = useAuth();

  if (!role) {
    return (
      <>
        <TopBar />
        <Mensaje>
          Cargando tu perfil… Si esto no avanza, tu usuario no tiene un rol asignado:
          avisa al administrador.
        </Mensaje>
      </>
    );
  }

  if (profile?.is_active === false) {
    return (
      <>
        <TopBar />
        <Mensaje>Tu cuenta está desactivada. Contacta al administrador.</Mensaje>
      </>
    );
  }

  const esConsultor = role === 'consultor_externo';
  const puedeConfigurar = ROLES_CONFIGURAN.includes(role);
  const puedeIngresarLecturas = ROLES_INGRESAN_LECTURAS.includes(role);

  return (
    <>
      <TopBar />
      <OperatorLayout />
      {!esConsultor && (
        <div style={{ padding: '2rem 1rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ScenarioBuilder />
          {puedeConfigurar && <ModelProjectionUploader />}
          <ModelComparison />
          <HistoricalChart />
          {puedeConfigurar && <ThresholdConfig />}
          <IngestionStatusPanel />
          {puedeIngresarLecturas && <CaudalReadingForm />}
        </div>
      )}
    </>
  );
}

function Gate() {
  const { session, loading, signIn } = useAuth();

  if (loading) {
    return <Mensaje>Cargando…</Mensaje>;
  }

  if (!session) {
    return <LoginForm signIn={signIn} title="ACL Gestión Hídrica" subtitle="Spoke Pucusana" />;
  }

  return <AppContent />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <Gate />
  </AuthProvider>
);
