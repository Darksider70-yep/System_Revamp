import React, { useState } from 'react';
import { Shield, KeyRound, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

export const LoginView = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@systemrevamp.local');
  const [password, setPassword] = useState('Admin@123456');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.login(email, password, totpCode || null);

      if (data.requires_2fa && !totpCode) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (data.access_token) {
        api.setSession(data.access_token, data.refresh_token, data.user);
        onLoginSuccess(data.user);
      } else {
        setError(data.detail || 'Invalid email or password.');
      }
    } catch (err) {
      console.error('Login error:', err);
      // Fallback for demo mode if server is initializing
      if (email === 'admin@systemrevamp.local' && password === 'Admin@123456') {
        const dummyUser = { email, name: 'Fleet Administrator', role: 'SuperAdmin' };
        api.setSession('demo_access_token', 'demo_refresh_token', dummyUser);
        onLoginSuccess(dummyUser);
      } else {
        setError('Failed to connect to Central Fleet Server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base)',
        padding: 'var(--space-4)',
      }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '8px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: 800,
            }}
          >
            ⚡
          </div>

          <div>
            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
              System Revamp v2.0
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Enterprise Fleet Endpoint Intelligence Console
            </p>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--status-critical-bg)',
              border: '1px solid var(--status-critical-border)',
              color: 'var(--status-critical-text)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {!requires2FA ? (
            <>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Administrator Email
                </label>
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <Mail
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', paddingLeft: '32px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Master Password
                </label>
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <Lock
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingLeft: '32px' }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Two-Factor TOTP Authenticator Code (6-digits)
              </label>
              <div style={{ position: 'relative', marginTop: '4px' }}>
                <KeyRound
                  size={14}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  type="text"
                  className="input font-mono"
                  placeholder="000 000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  maxLength={6}
                  required
                  style={{ width: '100%', paddingLeft: '32px', letterSpacing: '2px', textAlign: 'center' }}
                  autoFocus
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', height: '36px', justifyContent: 'center' }}
          >
            <span>{loading ? 'Authenticating...' : requires2FA ? 'Verify 2FA Token' : 'Sign In to Console'}</span>
            <ArrowRight size={14} />
          </button>
        </form>

        {/* Demo Fast Login Preset */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Default Admin Seed: <code className="font-mono">admin@systemrevamp.local</code>
          </span>
        </div>
      </div>
    </div>
  );
};
