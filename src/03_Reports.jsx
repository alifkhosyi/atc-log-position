import React, { useState } from 'react';
import DailyReport from './DailyReport';
import MonthlyReport from './MonthlyReport';

export default function Reports() {
  const [activeReport, setActiveReport] = useState('daily');

  return (
    <div className="space-y-6">
      {/* Menu Tabs */}
      <div className="flex gap-4 border-b border-gray-300">
        <button
          onClick={() => setActiveReport('daily')}
          className={`px-6 py-3 font-medium text-base transition-colors ${
            activeReport === 'daily'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Daily Report
        </button>
        <button
          onClick={() => setActiveReport('monthly')}
          className={`px-6 py-3 font-medium text-base transition-colors ${
            activeReport === 'monthly'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Monthly Report (Coming Soon)
        </button>
      </div>

      {/* Content */}
      <div>
        {activeReport === 'daily' && <DailyReport />}
        {activeReport === 'monthly' && <MonthlyReport />}
      </div>
    </div>
  );
}
