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

// Sesión 5-B: login real. Desde la 5-A, RLS exige sesión autenticada —
// sin esto, la app no mostraba nada. Gate decide qué mostrar según haya
// o no sesión; el contenido real vive en AppContent.

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

function AppContent() {
  return (
    <>
      <TopBar />
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

function Gate() {
  const { session, loading, signIn } = useAuth();

  if (loading) {
    return <p style={{ padding: '2rem', fontFamily: 'system-ui' }}>Cargando…</p>;
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
