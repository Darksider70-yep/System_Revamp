import React, { useState } from 'react';
import { Shield, KeyRound, ArrowRight, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../../api/client';

export const LoginView = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupOrg, setSetupOrg] = useState('Central Campus / Lab Administration');
  const [setupName, setSetupName] = useState('Fleet Administrator');

  React.useEffect(() => {
    api.getSetupStatus()
      .then((status) => {
        if (status?.setup_required) {
          setSetupRequired(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.setupInitialAdmin(setupOrg, email, password, setupName);
      if (res.access_token) {
        api.setSession(res.access_token, res.refresh_token, res.user);
        onLoginSuccess(res.user);
      } else {
        setError(res.detail || 'Initial setup failed');
      }
    } catch (err) {
      setError(err.message || 'Setup request failed');
    } finally {
      setLoading(false);
    }
  };

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
      setError('Failed to connect to Central Fleet Server.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = () => {
    setEmail('admin@systemrevamp.local');
    setPassword('Admin@123456');
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        padding: 'var(--space-4)',
        userSelect: 'none',
      }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '430px',
          padding: '36px 32px',
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-modal)', /* 24px */
          boxShadow: 'var(--glass-specular), var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
          animation: 'modalPop 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-container)', /* 16px */
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-active) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-inverse)',
              boxShadow: '0 8px 24px -4px var(--accent-glow)',
            }}
          >
            <Shield size={26} strokeWidth={2.5} />
          </div>

          <div>
            <h1
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              System Revamp
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '4px' }}>
              Enterprise Fleet Endpoint Intelligence Console v2.0
            </p>
          </div>
        </div>

        {setupRequired && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-container)',
              backgroundColor: 'var(--status-info-bg)',
              border: '1px solid var(--status-info-border)',
              color: 'var(--status-info-text)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Sparkles size={16} strokeWidth={2} />
            <span>
              <strong>Initial Setup Required:</strong> Configure master administrator account.
            </span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-container)',
              backgroundColor: 'var(--status-critical-bg)',
              border: '1px solid var(--status-critical-border)',
              color: 'var(--status-critical-text)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {setupRequired ? (
          <form onSubmit={handleSetupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Organization Name
              </label>
              <input
                type="text"
                className="input"
                value={setupOrg}
                onChange={(e) => setSetupOrg(e.target.value)}
                required
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Administrator Full Name
              </label>
              <input
                type="text"
                className="input"
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                required
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Admin Email Address
              </label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Master Admin Password
              </label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', marginTop: '6px' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: 'var(--space-2)', height: '42px', justifyContent: 'center' }}
            >
              <span>{loading ? 'Initializing...' : 'Complete Initial Setup'}</span>
              <ArrowRight size={15} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {!requires2FA ? (
              <>
                <div>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Administrator Email
                  </label>
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <Mail
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@systemrevamp.local"
                      required
                      style={{ width: '100%', paddingLeft: '36px' }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleQuickFill}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-text)',
                        fontSize: '11px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Fill Admin Demo
                    </button>
                  </div>
                  <div style={{ position: 'relative', marginTop: '6px' }}>
                    <Lock
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="password"
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      style={{ width: '100%', paddingLeft: '36px' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Two-Factor Authentication Code (TOTP)
                </label>
                <div style={{ position: 'relative', marginTop: '6px' }}>
                  <KeyRound
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }}
                  />
                  <input
                    type="text"
                    className="input font-mono"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    required
                    autoFocus
                    style={{ width: '100%', paddingLeft: '36px', letterSpacing: '0.2em' }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: 'var(--space-2)', height: '42px', justifyContent: 'center' }}
            >
              <span>{loading ? 'Authenticating...' : requires2FA ? 'Verify Code' : 'Sign In to Console'}</span>
              <ArrowRight size={15} />
            </button>
          </form>
        )}

        {/* Footer Living Telemetry Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            paddingTop: '6px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <span className="living-node living-node-ok" />
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              letterSpacing: '0.02em',
            }}
          >
            Zero-Trust Gateway Online • AES-256-GCM
          </span>
        </div>
      </div>
    </div>
  );
};
