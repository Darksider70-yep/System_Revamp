import React, { useState, useEffect } from 'react';
import { PipelineStepper } from '../common/PipelineStepper';
import { DataTable } from '../common/DataTable';
import { StatusBadge, RiskBadge } from '../common/StatusBadge';
import { CodeBlock } from '../common/CodeBlock';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  Wrench,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  StopCircle,
  FileDiff,
  ShieldCheck,
  Radio,
  ArrowRight,
} from 'lucide-react';
import { api } from '../../api/client';
import { useTheme } from '../../context/ThemeContext';

export const RemediationView = ({ initialApp = null }) => {
  const { scope } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedApp, setSelectedApp] = useState(initialApp || 'Node.js (x64)');
  const [targetScope, setTargetScope] = useState('lab'); // 'all' | 'lab' | 'pilot'
  const [pilotSize, setPilotSize] = useState('20'); // percentage
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunResults, setDryRunResults] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [rolloutActive, setRolloutActive] = useState(false);
  const [rolloutStage, setRolloutStage] = useState('pilot'); // 'pilot' | 'fleet' | 'completed' | 'aborted'
  const [rolloutProgress, setRolloutProgress] = useState(0);
  const [failureRate, setFailureRate] = useState(0);
  const [stagedDevices, setStagedDevices] = useState([
    { id: 'WS01', name: 'CS-LAB1-WS01', stage: 'Pilot (Stage 1)', status: 'Pending', log: 'Awaiting dispatch' },
    { id: 'WS02', name: 'CS-LAB1-WS02', stage: 'Pilot (Stage 1)', status: 'Pending', log: 'Awaiting dispatch' },
    { id: 'WS03', name: 'CS-LAB1-WS03', stage: 'Fleet (Stage 2)', status: 'Pending', log: 'Awaiting pilot approval' },
    { id: 'WS04', name: 'CS-LAB1-WS04', stage: 'Fleet (Stage 2)', status: 'Pending', log: 'Awaiting pilot approval' },
    { id: 'WS05', name: 'CS-LAB1-WS05', stage: 'Fleet (Stage 2)', status: 'Pending', log: 'Awaiting pilot approval' },
  ]);

  // Handle Dry Run Simulation
  const handleStartDryRun = () => {
    setDryRunRunning(true);
    setTimeout(() => {
      setDryRunResults({
        totalPlanned: 5,
        targetApp: selectedApp,
        targetVersion: '20.18.0',
        allowlistVerified: true,
        diffs: [
          '- Installed: Node.js v16.14.0 (Vulnerable: CVE-2023-30581)',
          '+ Target:    Node.js v20.18.0 LTS (Clean Authenticode)',
          '~ Command:   winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements',
        ],
      });
      setDryRunRunning(false);
      setCurrentStep(1);
    }, 1200);
  };

  // Handle Rollout Progression
  const handleStartRollout = () => {
    setRolloutActive(true);
    setRolloutStage('pilot');
    setRolloutProgress(10);

    // Simulate progressive rollout stages
    setTimeout(() => {
      setStagedDevices((prev) =>
        prev.map((d) =>
          d.stage.includes('Pilot') ? { ...d, status: 'Success', log: 'Upgrade completed in 34s' } : d
        )
      );
      setRolloutProgress(50);
      setRolloutStage('fleet');

      setTimeout(() => {
        setStagedDevices((prev) =>
          prev.map((d) => ({
            ...d,
            status: d.id === 'WS05' ? 'Needs Reboot' : 'Success',
            log: d.id === 'WS05' ? 'Exit Code 3010 (Reboot required)' : 'Upgrade completed cleanly',
          }))
        );
        setRolloutProgress(100);
        setRolloutStage('completed');
        setRolloutActive(false);
        setCurrentStep(4);
      }, 2000);
    }, 2000);
  };

  const handleAbortRollout = () => {
    setRolloutActive(false);
    setRolloutStage('aborted');
    setStagedDevices((prev) =>
      prev.map((d) => (d.status === 'Pending' ? { ...d, status: 'Aborted', log: 'Cancelled by administrator' } : d))
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Staged Remediation & Upgrade Pipeline
          </h2>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Orchestrate phased, safety-checked software and driver updates with dry-run verification
          </p>
        </div>
      </div>

      {/* Stepper */}
      <PipelineStepper
        currentStepIndex={currentStep}
        onStepClick={(idx) => {
          if (idx <= currentStep || isApproved) setCurrentStep(idx);
        }}
      />

      {/* Stage 1: Select Targets */}
      {currentStep === 0 && (
        <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>1. Select Remediation Target & Rollout Scope</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Target Software Package
              </label>
              <select
                className="input"
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="Node.js (x64)">Node.js (x64) — Upgrade to v20.18.0 LTS (CVSS 8.2 Fix)</option>
                <option value="Python 3.10">Python 3.10 — Upgrade to v3.12.7</option>
                <option value="Git for Windows">Git for Windows — Upgrade to v2.47.0</option>
                <option value="Realtek Audio">Realtek Audio — Pnputil Driver Fix (Code 28)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Deployment Target Scope
              </label>
              <select
                className="input"
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="lab">Current Active Lab ({scope.name})</option>
                <option value="all">Global Fleet (All Labs)</option>
                <option value="pilot">Isolated Pilot Workstations Only</option>
              </select>
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontWeight: 600, fontSize: '13px' }}>Pilot Phase Fraction:</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                First 20% of endpoints will receive the update; remainder will wait for automatic health checks.
              </span>
            </div>
            <span className="tag-mono">Pilot: 20% / Remainder: 80%</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartDryRun}
              disabled={dryRunRunning}
            >
              <Play size={14} />
              <span>{dryRunRunning ? 'Simulating Dry-Run...' : 'Proceed to Dry-Run Preview'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Dry-Run Preview */}
      {currentStep === 1 && (
        <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileDiff size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>2. Dry-Run Execution & Command Diff Preview</h3>
            </div>
            <span className="tag-mono" style={{ color: 'var(--status-ok-text)' }}>
              <ShieldCheck size={12} /> Allowlist Verified
            </span>
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
            The dry-run inspected target endpoints without modifying local disk states. Below is the exact command line diff planned for rollout:
          </p>

          <CodeBlock
            code={dryRunResults?.diffs?.join('\n') || 'Generating dry-run diff...'}
            language="diff"
            title="Planned Remediation Diff"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-sm" onClick={() => setCurrentStep(0)}>
              Back to Targets
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCurrentStep(2)}
            >
              <span>Accept Dry-Run & Proceed to Approval</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Stage 3: Admin Approval */}
      {currentStep === 2 && (
        <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>3. Mandatory Administrator Approval</h3>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-code)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div><strong>Action:</strong> Automated Winget Upgrade</div>
            <div><strong>Package:</strong> {selectedApp}</div>
            <div><strong>Scope:</strong> {scope.name} (5 endpoints in staged batch)</div>
            <div><strong>Signature Policy:</strong> Requires verified Authenticode signature from publisher</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-sm" onClick={() => setCurrentStep(1)}>
              Back to Preview
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setIsApproved(true);
                setCurrentStep(3);
                handleStartRollout();
              }}
            >
              <CheckCircle2 size={14} />
              <span>Approve & Launch Staged Rollout</span>
            </button>
          </div>
        </div>
      )}

      {/* Stage 4: Staged Rollout Live Monitor */}
      {(currentStep === 3 || currentStep === 4) && (
        <div className="panel" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={18} color={rolloutActive ? 'var(--status-ok-solid)' : 'var(--text-muted)'} />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
                {rolloutStage === 'completed'
                  ? '5. Fleet Remediation Completed'
                  : '4. Staged Rollout in Progress'}
              </h3>
            </div>

            {rolloutActive && (
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={handleAbortRollout}
                style={{ gap: '6px' }}
              >
                <StopCircle size={14} />
                <span>Emergency Abort</span>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span>Phase: <strong>{rolloutStage.toUpperCase()}</strong></span>
              <span className="tabular-nums font-mono">{rolloutProgress}% complete</span>
            </div>
            <div style={{ height: '8px', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--bg-code)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${rolloutProgress}%`,
                  backgroundColor: rolloutStage === 'aborted' ? 'var(--status-critical-solid)' : 'var(--accent-primary)',
                  transition: 'width 300ms ease-out',
                }}
              />
            </div>
          </div>

          {/* Staged Device Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device Hostname</th>
                  <th>Rollout Phase</th>
                  <th>Status</th>
                  <th>Execution Log Snippet</th>
                </tr>
              </thead>
              <tbody>
                {stagedDevices.map((dev) => (
                  <tr key={dev.id}>
                    <td style={{ fontWeight: 600 }}>{dev.name}</td>
                    <td><span className="tag-mono">{dev.stage}</span></td>
                    <td>
                      <StatusBadge
                        status={
                          dev.status === 'Success'
                            ? 'success'
                            : dev.status === 'Needs Reboot'
                            ? 'warning'
                            : dev.status === 'Aborted'
                            ? 'failed'
                            : 'pending'
                        }
                        label={dev.status}
                        size="sm"
                      />
                    </td>
                    <td className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {dev.log}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rolloutStage === 'completed' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setCurrentStep(0);
                  setRolloutProgress(0);
                  setDryRunResults(null);
                }}
              >
                <RotateCcw size={14} />
                <span>Start New Remediation Campaign</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
