import React from 'react';
import DailyReport from './DailyReport.js';
import MonthlyReport from './MonthlyReport.js';

export default function Reports() {
  const [activeTab, setActiveTab] = React.useState('daily');

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('daily')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'daily' ? '#2563eb' : 'transparent',
            color: activeTab === 'daily' ? 'white' : 'var(--fg)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Daily Report
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'monthly' ? '#2563eb' : 'transparent',
            color: activeTab === 'monthly' ? 'white' : 'var(--fg)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Monthly Report
        </button>
      </div>

      {activeTab === 'daily' && <DailyReport />}
      {activeTab === 'monthly' && <MonthlyReport />}
    </div>
  );
}
