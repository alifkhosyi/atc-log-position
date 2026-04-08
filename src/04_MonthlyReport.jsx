import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function MonthlyReport() {
  const [yearMonth, setYearMonth] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Coming Soon</h3>
        <p className="text-blue-800 text-sm">
          Monthly Report (rekapitulasi laporan bulanan) sedang dalam tahap pengembangan.
          Fitur ini akan menampilkan ringkasan data traffic, operasional, dan komunikasi
          untuk seluruh bulan.
        </p>
      </div>

      {/* Placeholder Form */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Monthly Report - Placeholder</h2>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bulan & Tahun
          </label>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            disabled
            className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            <strong>Format Monthly Report akan meliputi:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            <li>Total traffic per kategori (Scheduled, Unscheduled, VIP, Cargo, Military, Helicopter, Training)</li>
            <li>Grafik tren traffic harian</li>
            <li>Ringkasan disruption/gangguan</li>
            <li>Status komunikasi sistem</li>
            <li>Ringkasan insiden dan tindak lanjut</li>
            <li>KPI: OTP, Punctuality, Incident Rate</li>
            <li>Comparison dengan bulan sebelumnya</li>
          </ul>
        </div>

        <div className="bg-gray-50 p-4 rounded border border-gray-200">
          <p className="text-xs text-gray-600">
            Database table <code>monthly_reports</code> sudah siap di Supabase.
            Implementasi akan dimulai setelah Daily Report selesai dan teruji.
          </p>
        </div>
      </div>
    </div>
  );
}
