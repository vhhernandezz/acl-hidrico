import React, { useState } from 'react';
import './LoginForm.css';

/**
 * LoginForm — genérico, reutilizable entre apps. No conoce Supabase
 * directamente: recibe `signIn(email, password)` como prop (viene de
 * useAuth(), ver createAuthContext.jsx), así que sirve igual para
 * Pucusana que para el Hub.
 */
export function LoginForm({ signIn, title = 'Iniciar sesión', subtitle }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : signInError.message
      );
    }
    setSubmitting(false);
  }

  return (
    <div className="lf-wrap">
      <form className="lf-card" onSubmit={handleSubmit}>
        <h1 className="lf-title">{title}</h1>
        {subtitle && <p className="lf-subtitle">{subtitle}</p>}

        <label className="lf-label" htmlFor="lf-email">Correo</label>
        <input
          id="lf-email"
          type="email"
          className="lf-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <label className="lf-label" htmlFor="lf-password">Contraseña</label>
        <input
          id="lf-password"
          type="password"
          className="lf-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && <p className="lf-error" role="alert">{error}</p>}

        <button type="submit" className="lf-submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
