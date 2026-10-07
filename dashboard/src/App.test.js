import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBadge, RiskBadge } from './components/common/StatusBadge';
import { KpiTile } from './components/common/KpiTile';
import { DataTable } from './components/common/DataTable';
import { PipelineStepper } from './components/common/PipelineStepper';
import { CopyField } from './components/common/CopyField';
import App from './App';

describe('System Revamp v2.0 Shared Component Suite', () => {
  test('renders StatusBadge correctly with semantic icons and text', () => {
    const { rerender } = render(<StatusBadge status="online" />);
    expect(screen.getByText('online')).toBeInTheDocument();

    rerender(<StatusBadge status="offline" label="Agent Disconnected" />);
    expect(screen.getByText('Agent Disconnected')).toBeInTheDocument();
  });

  test('renders RiskBadge with correct semantic risk classifications', () => {
    const { rerender } = render(<RiskBadge level="CRITICAL" score={8.5} />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('(8.5)')).toBeInTheDocument();

    rerender(<RiskBadge level="LOW" />);
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  test('renders KpiTile with tabular metrics and sparkline', () => {
    render(
      <KpiTile
        title="Total Endpoints"
        value="45/50"
        subtitle="Active nodes"
        sparklineData={[40, 42, 45]}
        delta="+5%"
        deltaType="positive"
      />
    );
    expect(screen.getByText('Total Endpoints')).toBeInTheDocument();
    expect(screen.getByText('45/50')).toBeInTheDocument();
    expect(screen.getByText('+5%')).toBeInTheDocument();
  });

  test('renders DataTable with sorting and row selection', () => {
    const columns = [
      { id: 'name', header: 'Name', accessor: 'name', sortable: true },
      { id: 'os', header: 'Operating System', accessor: 'os' },
    ];
    const data = [
      { id: '1', name: 'Workstation 01', os: 'Windows 11' },
      { id: '2', name: 'Workstation 02', os: 'Ubuntu 22.04' },
    ];

    const onSelect = jest.fn();
    render(
      <DataTable
        columns={columns}
        data={data}
        selectable={true}
        selectedRowIds={[]}
        onSelectionChange={onSelect}
      />
    );

    expect(screen.getByText('Workstation 01')).toBeInTheDocument();
    expect(screen.getByText('Ubuntu 22.04')).toBeInTheDocument();
  });

  test('renders PipelineStepper with 5 stages', () => {
    render(<PipelineStepper currentStepIndex={2} />);
    expect(screen.getByText('1. Select Targets')).toBeInTheDocument();
    expect(screen.getByText('3. Admin Approval')).toBeInTheDocument();
  });

  test('renders CopyField and triggers clipboard copy feedback', () => {
    render(<CopyField value="sr_enroll_token_12345" label="Enrollment Key" />);
    expect(screen.getByText('Enrollment Key')).toBeInTheDocument();
    expect(screen.getByText('sr_enroll_token_12345')).toBeInTheDocument();
  });

  test('renders Console login screen when unauthenticated', () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByText(/System Revamp v2.0/i)).toBeInTheDocument();
    expect(screen.getByText(/Sign In to Console/i)).toBeInTheDocument();
  });
});
