import React from 'react';
import { Check, Clock, AlertTriangle } from 'lucide-react';

export const PipelineStepper = ({
  steps = [
    { id: 'targets', label: '1. Select Targets' },
    { id: 'dryrun', label: '2. Dry-Run Preview' },
    { id: 'approval', label: '3. Admin Approval' },
    { id: 'rollout', label: '4. Staged Rollout' },
    { id: 'results', label: '5. Fleet Results' },
  ],
  currentStepIndex = 0,
  onStepClick = null,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-2) var(--space-4)',
        gap: 'var(--space-2)',
        overflowX: 'auto',
      }}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isUpcoming = index > currentStepIndex;

        return (
          <React.Fragment key={step.id}>
            <div
              onClick={() => onStepClick && onStepClick(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isCurrent ? 'var(--accent-subtle)' : 'transparent',
                border: isCurrent ? '1px solid var(--accent-border)' : '1px solid transparent',
                cursor: onStepClick ? 'pointer' : 'default',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: isCompleted
                    ? 'var(--status-ok-solid)'
                    : isCurrent
                    ? 'var(--accent-primary)'
                    : 'var(--border-default)',
                  color: '#ffffff',
                }}
              >
                {isCompleted ? <Check size={12} strokeWidth={3} /> : index + 1}
              </div>

              <span
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent
                    ? 'var(--accent-text)'
                    : isCompleted
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                }}
              >
                {step.label}
              </span>
            </div>

            {index < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  minWidth: '16px',
                  height: '1px',
                  backgroundColor: isCompleted ? 'var(--status-ok-solid)' : 'var(--border-subtle)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
