import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function AdminReportMonitoring() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState([]);
  const [stats, setStats] = useState({
    totalReports: 0,
    submittedReports: 0,
    draftReports: 0
  });

  // Load branches
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const { data } = await supabase
          .from('branches')
          .select('code, name')
          .order('name');
        setBranches(data || []);
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    };
    loadBranches();
  }, []);

  // Load reports
  useEffect(() => {
    loadReports();
  }, [filterBranch, filterDate]);

  const loadReports = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('daily_reports')
        .select(`
          id,
          branch_code,
          report_date,
          report_number,
          unit_name,
          manager_name,
          status,
          created_at,
          created_by,
          otp_airline_percentage,
          dep_punctuality_percentage,
          arr_punctuality_percentage
        `);

      if (filterBranch) {
        query = query.eq('branch_code', filterBranch);
      }

      if (filterDate) {
        query = query.eq('report_date', filterDate);
      }

      const { data, error } = await query.order('report_date', { ascending: false });

      if (error) throw error;

      setReports(data || []);

      // Calculate stats
      const submitted = (data || []).filter(r => r.status === 'submitted').length;
      const draft = (data || []).filter(r => r.status === 'draft').length;

      setStats({
        totalReports: data?.length || 0,
        submittedReports: submitted,
        draftReports: draft
      });
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportDetails = async (reportId) => {
    try {
      const { data, error } = await supabase
        .from('daily_reports')
        .select(`
          *,
          traffic_movements(*),
          hourly_traffic(*),
          operational_disruptions(*),
          communication_systems(*),
          incident_reports(*)
        `)
        .eq('id', reportId)
        .single();

      if (error) throw error;
      setSelectedReport(data);
    } catch (error) {
      console.error('Error loading report details:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Draft' },
      submitted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Submitted' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Approved' }
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (selectedReport) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedReport(null)}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← Kembali ke Daftar
        </button>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Section A */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">A. IDENTIFIKASI LAPORAN</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Nomor Laporan</p>
                <p className="font-medium">{selectedReport.report_number}</p>
              </div>
              <div>
                <p className="text-gray-600">Tanggal</p>
                <p className="font-medium">{selectedReport.report_date}</p>
              </div>
              <div>
                <p className="text-gray-600">Unit</p>
                <p className="font-medium">{selectedReport.unit_name}</p>
              </div>
              <div>
                <p className="text-gray-600">Manager</p>
                <p className="font-medium">{selectedReport.manager_name}</p>
              </div>
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-medium">{getStatusBadge(selectedReport.status)}</p>
              </div>
              <div>
                <p className="text-gray-600">Dibuat Oleh</p>
                <p className="font-medium text-xs">{selectedReport.created_by}</p>
              </div>
            </div>
          </div>

          {/* Section B */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">B. KONDISI OPERASIONAL</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Kondisi Umum:</span>
                <span className="font-medium">{selectedReport.condition_general_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">NOTAM:</span>
                <span className="font-medium">{selectedReport.condition_notam_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Restriksi:</span>
                <span className="font-medium">{selectedReport.condition_restriction_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">FIR/Sektor:</span>
                <span className="font-medium">{selectedReport.condition_fir_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cuaca:</span>
                <span className="font-medium">{selectedReport.condition_weather_status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Koordinasi Militer:</span>
                <span className="font-medium">{selectedReport.condition_military_status}</span>
              </div>
            </div>
          </div>

          {/* Section C - OTP Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">C. KINERJA KETEPATAN WAKTU</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-gray-600 text-sm">OTP Airline</p>
                <p className="text-2xl font-bold text-blue-600">{selectedReport.otp_airline_percentage}%</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-gray-600 text-sm">DEP Punctuality</p>
                <p className="text-2xl font-bold text-green-600">{selectedReport.dep_punctuality_percentage}%</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <p className="text-gray-600 text-sm">ARR Punctuality</p>
                <p className="text-2xl font-bold text-purple-600">{selectedReport.arr_punctuality_percentage}%</p>
              </div>
            </div>
          </div>

          {/* Section D - Communication */}
          {selectedReport.communication_systems && selectedReport.communication_systems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">D. SISTEM KOMUNIKASI</h3>
              <div className="space-y-2">
                {selectedReport.communication_systems.map((sys, idx) => (
                  <div key={idx} className="flex justify-between text-sm border-b border-gray-200 pb-2">
                    <span className="text-gray-700">{sys.system_name}</span>
                    <span className={`font-medium ${sys.status === 'Operational' ? 'text-green-600' : 'text-red-600'}`}>
                      {sys.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section E - Incidents */}
          {selectedReport.incident_reports && selectedReport.incident_reports.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">E. GANGGUAN & INSIDEN</h3>
              <div className="space-y-3">
                {selectedReport.incident_reports.map((inc, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 text-sm">
                    <div className="flex justify-between mb-2">
                      <strong>{inc.incident_type}</strong>
                      <span className="text-gray-600">{inc.incident_time}</span>
                    </div>
                    <p className="text-gray-700">Sistem: {inc.affected_system}</p>
                    <p className="text-gray-700">Durasi: {inc.duration_minutes} menit</p>
                    <p className="text-gray-700 mt-2">Tindak Lanjut: {inc.follow_up_action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section F - Catatan */}
          {selectedReport.operational_notes && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">F. CATATAN OPERASIONAL</h3>
              <p className="text-gray-700 p-3 bg-gray-50 rounded-lg text-sm">
                {selectedReport.operational_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Monitoring Daily Reports</h2>
        <p className="text-gray-600">Pantau laporan harian dari semua cabang</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Total Laporan</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalReports}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Submitted</p>
          <p className="text-3xl font-bold text-green-600">{stats.submittedReports}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-gray-600 text-sm">Draft</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.draftReports}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter Cabang</label>
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Cabang</option>
              {branches.map(branch => (
                <option key={branch.code} value={branch.code}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal</label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Cabang</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tanggal</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">No. Laporan</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Manager</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">OTP</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                  Tidak ada laporan
                </td>
              </tr>
            ) : (
              reports.map(report => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{report.branch_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{report.report_date}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{report.report_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{report.manager_name}</td>
                  <td className="px-6 py-4 text-sm">{getStatusBadge(report.status)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="font-medium text-blue-600">{report.otp_airline_percentage}%</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => loadReportDetails(report.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Lihat Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
