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
          maxWidth: '420px',
          padding: 'var(--space-6)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-card)', // 20px
          boxShadow: 'var(--shadow-modal)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          animation: 'modalPop 180ms ease-out',
        }}
      >
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-container)', // 14px
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-inverse)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <Shield size={24} strokeWidth={2.5} />
          </div>

          <div>
            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              System Revamp v2.0
            </h1>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
              Enterprise Fleet Endpoint Intelligence Console
            </p>
          </div>
        </div>

        {setupRequired && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-container)',
              backgroundColor: 'var(--status-info-bg)',
              border: '1px solid var(--status-info-border)',
              color: 'var(--status-info-text)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
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
              padding: '10px 14px',
              borderRadius: 'var(--radius-container)',
              backgroundColor: 'var(--status-critical-bg)',
              border: '1px solid var(--status-critical-border)',
              color: 'var(--status-critical-text)',
              fontSize: 'var(--text-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={14} />
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
                style={{ width: '100%', marginTop: '4px' }}
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
                style={{ width: '100%', marginTop: '4px' }}
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
                style={{ width: '100%', marginTop: '4px' }}
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
                style={{ width: '100%', marginTop: '4px' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: 'var(--space-2)', height: '38px', justifyContent: 'center' }}
            >
              <span>{loading ? 'Initializing...' : 'Complete Initial Setup'}</span>
              <ArrowRight size={14} />
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
                  <div style={{ position: 'relative', marginTop: '4px' }}>
                    <Mail
                      size={14}
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
                      placeholder="admin@example.edu"
                      required
                      style={{ width: '100%', paddingLeft: '34px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative', marginTop: '4px' }}>
                    <Lock
                      size={14}
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
                      style={{ width: '100%', paddingLeft: '34px' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Two-Factor Authentication Code (TOTP)
                </label>
                <div style={{ position: 'relative', marginTop: '4px' }}>
                  <KeyRound
                    size={14}
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
                    style={{ width: '100%', paddingLeft: '34px', letterSpacing: '0.2em' }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ marginTop: 'var(--space-2)', height: '38px', justifyContent: 'center' }}
            >
              <span>{loading ? 'Authenticating...' : requires2FA ? 'Verify Code' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
