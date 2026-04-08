import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function DailyReport() {
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentReport, setCurrentReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  const [formMode, setFormMode] = useState('create'); // create, edit, view
  const [submitStatus, setSubmitStatus] = useState(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState('section-a');

  // Section A - Identifikasi
  const [sectionA, setSectionA] = useState({
    reportNumber: '',
    periodStart: '0000',
    periodEnd: '2359',
    unitName: '',
    managerName: '',
    managerPosition: '',
    location: ''
  });

  // Section B - Kondisi Operasional
  const [sectionB, setSectionB] = useState({
    general: { status: 'OK', notes: '' },
    notam: { status: 'OK', notes: '' },
    restriction: { status: 'OK', notes: '' },
    fir: { status: 'OK', notes: '' },
    weather: { status: 'OK', notes: '' },
    military: { status: 'OK', notes: '' }
  });

  // Section C - Traffic Movement
  const [sectionC, setSectionC] = useState({
    movements: {
      scheduled: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 },
      unscheduled: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 },
      vip: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 },
      cargo: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 },
      military: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 },
      helicopter: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 },
      training: { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0, adv: 0, ext: 0, dla: 0, cnl: 0, ef: 0, cf: 0, rtb: 0, rta: 0, dvt: 0, ga: 0 }
    },
    hourlyTraffic: Array(24).fill(0),
    disruptions: [],
    otpMetrics: {
      airlinePercentage: 0,
      depPunctuality: 0,
      arrPunctuality: 0
    }
  });

  // Section D - Komunikasi
  const [sectionD, setSectionD] = useState({
    systems: {
      vhfPrimary: { status: 'Operational', notes: '' },
      vhfStandby: { status: 'Operational', notes: '' },
      hf: { status: 'Operational', notes: '' },
      aftn: { status: 'Operational', notes: '' },
      vccs: { status: 'Operational', notes: '' },
      vsat: { status: 'Operational', notes: '' },
      interphone: { status: 'Operational', notes: '' },
      recorder: { status: 'Operational', notes: '' }
    }
  });

  // Section E - Gangguan & Insiden
  const [sectionE, setSectionE] = useState({
    incidents: []
  });

  // Section F - Catatan
  const [sectionF, setSectionF] = useState({
    operationalNotes: ''
  });

  // Load user and branch info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: accountData } = await supabase
            .from('accounts')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (accountData) {
            setUserInfo(accountData);
            
            // Load branch info
            const { data: branchData } = await supabase
              .from('branches')
              .select('*')
              .eq('code', accountData.branch_code)
              .single();
            
            if (branchData) {
              setBranchInfo(branchData);
              setSectionA(prev => ({
                ...prev,
                unitName: branchData.name || '',
                location: branchData.city || ''
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      }
    };
    
    loadUserInfo();
  }, []);

  // Load existing report for the selected date
  useEffect(() => {
    if (!userInfo) return;
    
    const loadReport = async () => {
      try {
        setLoading(true);
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
          .eq('branch_code', userInfo.branch_code)
          .eq('report_date', reportDate)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading report:', error);
          setCurrentReport(null);
          setFormMode('create');
        } else if (data) {
          setCurrentReport(data);
          setFormMode(data.is_locked ? 'view' : 'edit');
          // Populate form dengan data yang ada
          populateFormFromData(data);
        } else {
          setCurrentReport(null);
          setFormMode('create');
          resetForm();
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportDate, userInfo]);

  const populateFormFromData = (data) => {
    // Section A
    setSectionA({
      reportNumber: data.report_number || '',
      periodStart: '0000',
      periodEnd: '2359',
      unitName: data.unit_name || '',
      managerName: data.manager_name || '',
      managerPosition: data.manager_position || '',
      location: data.location || ''
    });

    // Section B
    setSectionB({
      general: { status: data.condition_general_status || 'OK', notes: data.condition_general_notes || '' },
      notam: { status: data.condition_notam_status || 'OK', notes: data.condition_notam_notes || '' },
      restriction: { status: data.condition_restriction_status || 'OK', notes: data.condition_restriction_notes || '' },
      fir: { status: data.condition_fir_status || 'OK', notes: data.condition_fir_notes || '' },
      weather: { status: data.condition_weather_status || 'OK', notes: data.condition_weather_notes || '' },
      military: { status: data.condition_military_status || 'OK', notes: data.condition_military_notes || '' }
    });

    // Section C - Load from traffic_movements, etc.
    // (Implementation details untuk parsing traffic data)

    // Section D
    if (data.communication_systems && data.communication_systems.length > 0) {
      const systemsMap = {};
      data.communication_systems.forEach(sys => {
        const key = sys.system_name.toLowerCase().replace(/\s+/g, '');
        systemsMap[key] = { status: sys.status || 'Operational', notes: sys.notes || '' };
      });
      setSectionD({ systems: systemsMap });
    }

    // Section E
    if (data.incident_reports && data.incident_reports.length > 0) {
      setSectionE({
        incidents: data.incident_reports.map(inc => ({
          id: inc.id,
          time: inc.incident_time || '',
          type: inc.incident_type || '',
          system: inc.affected_system || '',
          duration: inc.duration_minutes || 0,
          action: inc.follow_up_action || '',
          notes: inc.notes || ''
        }))
      });
    }

    // Section F
    setSectionF({
      operationalNotes: data.operational_notes || ''
    });
  };

  const resetForm = () => {
    setSectionA({
      reportNumber: '',
      periodStart: '0000',
      periodEnd: '2359',
      unitName: branchInfo?.name || '',
      managerName: '',
      managerPosition: '',
      location: branchInfo?.city || ''
    });
    setSectionB({
      general: { status: 'OK', notes: '' },
      notam: { status: 'OK', notes: '' },
      restriction: { status: 'OK', notes: '' },
      fir: { status: 'OK', notes: '' },
      weather: { status: 'OK', notes: '' },
      military: { status: 'OK', notes: '' }
    });
    // Reset other sections similarly
  };

  const handleSaveReport = async () => {
    try {
      setLoading(true);
      setSubmitStatus(null);

      if (!userInfo) {
        setSubmitStatus({ type: 'error', message: 'User info not loaded' });
        return;
      }

      // Prepare data
      const reportData = {
        branch_code: userInfo.branch_code,
        report_date: reportDate,
        report_number: sectionA.reportNumber,
        unit_name: sectionA.unitName,
        manager_name: sectionA.managerName,
        manager_position: sectionA.managerPosition,
        location: sectionA.location,
        condition_general_status: sectionB.general.status,
        condition_general_notes: sectionB.general.notes,
        condition_notam_status: sectionB.notam.status,
        condition_notam_notes: sectionB.notam.notes,
        condition_restriction_status: sectionB.restriction.status,
        condition_restriction_notes: sectionB.restriction.notes,
        condition_fir_status: sectionB.fir.status,
        condition_fir_notes: sectionB.fir.notes,
        condition_weather_status: sectionB.weather.status,
        condition_weather_notes: sectionB.weather.notes,
        condition_military_status: sectionB.military.status,
        condition_military_notes: sectionB.military.notes,
        otp_airline_percentage: sectionC.otpMetrics.airlinePercentage,
        dep_punctuality_percentage: sectionC.otpMetrics.depPunctuality,
        arr_punctuality_percentage: sectionC.otpMetrics.arrPunctuality,
        operational_notes: sectionF.operationalNotes,
        created_by: userInfo.display_name,
        created_by_nik: userInfo.nik || '',
        created_by_position: sectionA.managerPosition,
        status: 'draft'
      };

      let reportId = currentReport?.id;

      if (formMode === 'create') {
        const { data, error } = await supabase
          .from('daily_reports')
          .insert([reportData])
          .select()
          .single();

        if (error) throw error;
        reportId = data.id;
        setCurrentReport(data);
        setFormMode('edit');
      } else {
        const { error } = await supabase
          .from('daily_reports')
          .update(reportData)
          .eq('id', currentReport.id);

        if (error) throw error;
      }

      // Save traffic movements (Section C)
      await saveSectionC(reportId);

      // Save communication systems (Section D)
      await saveSectionD(reportId);

      // Save incidents (Section E)
      await saveSectionE(reportId);

      setSubmitStatus({ type: 'success', message: 'Laporan tersimpan' });
      setTimeout(() => setSubmitStatus(null), 3000);
    } catch (error) {
      console.error('Error saving report:', error);
      setSubmitStatus({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const saveSectionC = async (reportId) => {
    try {
      // Delete existing traffic movements
      await supabase
        .from('traffic_movements')
        .delete()
        .eq('daily_report_id', reportId);

      // Insert new traffic movements
      const movements = [];
      Object.entries(sectionC.movements).forEach(([type, data]) => {
        movements.push({
          daily_report_id: reportId,
          movement_type: type.charAt(0).toUpperCase() + type.slice(1),
          ...data
        });
      });

      if (movements.length > 0) {
        await supabase.from('traffic_movements').insert(movements);
      }

      // Save hourly traffic
      await supabase
        .from('hourly_traffic')
        .delete()
        .eq('daily_report_id', reportId);

      const hourlyData = sectionC.hourlyTraffic.map((total, hour) => ({
        daily_report_id: reportId,
        hour_utc: hour,
        total_traffic: total
      }));

      if (hourlyData.length > 0) {
        await supabase.from('hourly_traffic').insert(hourlyData);
      }

      // Save disruptions
      await supabase
        .from('operational_disruptions')
        .delete()
        .eq('daily_report_id', reportId);

      if (sectionC.disruptions.length > 0) {
        const disruptionData = sectionC.disruptions.map(d => ({
          daily_report_id: reportId,
          disruption_type: d.type,
          duration_minutes: d.duration,
          description: d.description,
          impact: d.impact
        }));
        await supabase.from('operational_disruptions').insert(disruptionData);
      }
    } catch (error) {
      console.error('Error saving Section C:', error);
      throw error;
    }
  };

  const saveSectionD = async (reportId) => {
    try {
      // Delete existing communication systems
      await supabase
        .from('communication_systems')
        .delete()
        .eq('daily_report_id', reportId);

      // Insert new systems
      const systems = Object.entries(sectionD.systems).map(([key, data]) => ({
        daily_report_id: reportId,
        system_name: formatSystemName(key),
        status: data.status,
        notes: data.notes
      }));

      if (systems.length > 0) {
        await supabase.from('communication_systems').insert(systems);
      }
    } catch (error) {
      console.error('Error saving Section D:', error);
      throw error;
    }
  };

  const saveSectionE = async (reportId) => {
    try {
      // Delete existing incidents
      await supabase
        .from('incident_reports')
        .delete()
        .eq('daily_report_id', reportId);

      // Insert new incidents
      const incidentData = sectionE.incidents.map(inc => ({
        daily_report_id: reportId,
        incident_time: inc.time,
        incident_type: inc.type,
        affected_system: inc.system,
        duration_minutes: inc.duration,
        follow_up_action: inc.action,
        notes: inc.notes
      }));

      if (incidentData.length > 0) {
        await supabase.from('incident_reports').insert(incidentData);
      }
    } catch (error) {
      console.error('Error saving Section E:', error);
      throw error;
    }
  };

  const formatSystemName = (key) => {
    const map = {
      vhfprimary: 'VHF Primary',
      vhfstandby: 'VHF Standby',
      hf: 'HF',
      aftn: 'AFTN/AMHS',
      vccs: 'VCCS',
      vsat: 'VSAT',
      interphone: 'Interphone',
      recorder: 'Recorder'
    };
    return map[key] || key;
  };

  const handleAddIncident = () => {
    setSectionE({
      incidents: [...sectionE.incidents, {
        id: Date.now(),
        time: '',
        type: '',
        system: '',
        duration: 0,
        action: '',
        notes: ''
      }]
    });
  };

  const handleRemoveIncident = (id) => {
    setSectionE({
      incidents: sectionE.incidents.filter(inc => inc.id !== id)
    });
  };

  const handleUpdateIncident = (id, field, value) => {
    setSectionE({
      incidents: sectionE.incidents.map(inc =>
        inc.id === id ? { ...inc, [field]: value } : inc
      )
    });
  };

  // UI Components untuk section
  const renderSectionA = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">A. IDENTIFIKASI LAPORAN</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Laporan</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            disabled={formMode === 'view'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Laporan</label>
          <input
            type="text"
            placeholder="Contoh: RPT/WIII/20260408/001"
            value={sectionA.reportNumber}
            onChange={(e) => setSectionA({...sectionA, reportNumber: e.target.value})}
            disabled={formMode === 'view'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periode (UTC)</label>
          <div className="flex gap-2">
            <input
              type="time"
              value={sectionA.periodStart}
              onChange={(e) => setSectionA({...sectionA, periodStart: e.target.value})}
              disabled={formMode === 'view'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <span className="flex items-center">-</span>
            <input
              type="time"
              value={sectionA.periodEnd}
              onChange={(e) => setSectionA({...sectionA, periodEnd: e.target.value})}
              disabled={formMode === 'view'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <input
            type="text"
            value={sectionA.unitName}
            onChange={(e) => setSectionA({...sectionA, unitName: e.target.value})}
            disabled={formMode === 'view'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Manager Operasi</label>
          <input
            type="text"
            value={sectionA.managerName}
            onChange={(e) => setSectionA({...sectionA, managerName: e.target.value})}
            disabled={formMode === 'view'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lokasi</label>
          <input
            type="text"
            value={sectionA.location}
            onChange={(e) => setSectionA({...sectionA, location: e.target.value})}
            disabled={formMode === 'view'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
      </div>
    </div>
  );

  const renderSectionB = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">B. KONDISI OPERASIONAL UMUM</h3>
      
      <div className="space-y-3">
        {Object.entries(sectionB).map(([key, value]) => (
          <div key={key} className="border border-gray-200 rounded-lg p-3">
            <div className="flex justify-between items-start">
              <label className="text-sm font-medium text-gray-700">{formatConditionLabel(key)}</label>
              <select
                value={value.status}
                onChange={(e) => setSectionB({...sectionB, [key]: {...value, status: e.target.value}})}
                disabled={formMode === 'view'}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="OK">OK</option>
                <option value="Not OK">Not OK</option>
                <option value="N/A">N/A</option>
              </select>
            </div>
            <textarea
              value={value.notes}
              onChange={(e) => setSectionB({...sectionB, [key]: {...value, notes: e.target.value}})}
              disabled={formMode === 'view'}
              placeholder="Keterangan (jika diperlukan)"
              className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              rows="2"
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderSectionC = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">C. MOVEMENT TRAFFIC HARIAN</h3>
      
      {/* C.1: Traffic Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">Tipe</th>
              <th className="border border-gray-300 p-1 text-center" colSpan="2">DEP</th>
              <th className="border border-gray-300 p-1 text-center" colSpan="2">ARR</th>
              <th className="border border-gray-300 p-1 text-center">OVF</th>
              <th className="border border-gray-300 p-1 text-center">ADV</th>
              <th className="border border-gray-300 p-1 text-center">EXT</th>
              <th className="border border-gray-300 p-1 text-center">DLA</th>
              <th className="border border-gray-300 p-1 text-center">CNL</th>
              <th className="border border-gray-300 p-1 text-center">EF</th>
              <th className="border border-gray-300 p-1 text-center">CF</th>
              <th className="border border-gray-300 p-1 text-center">RTB</th>
              <th className="border border-gray-300 p-1 text-center">RTA</th>
              <th className="border border-gray-300 p-1 text-center">DVT</th>
              <th className="border border-gray-300 p-1 text-center">GA</th>
            </tr>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-1"></th>
              <th className="border border-gray-300 p-1 text-center text-xs">DOM</th>
              <th className="border border-gray-300 p-1 text-center text-xs">INT</th>
              <th className="border border-gray-300 p-1 text-center text-xs">DOM</th>
              <th className="border border-gray-300 p-1 text-center text-xs">INT</th>
              <th colSpan="11" className="text-center"></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(sectionC.movements).map(([type, data]) => (
              <tr key={type}>
                <td className="border border-gray-300 p-2 font-medium text-xs">{formatMovementType(type)}</td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.depDom} onChange={(e) => handleUpdateTrafficData(type, 'depDom', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.depInt} onChange={(e) => handleUpdateTrafficData(type, 'depInt', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.arrDom} onChange={(e) => handleUpdateTrafficData(type, 'arrDom', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.arrInt} onChange={(e) => handleUpdateTrafficData(type, 'arrInt', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.ovf} onChange={(e) => handleUpdateTrafficData(type, 'ovf', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.adv} onChange={(e) => handleUpdateTrafficData(type, 'adv', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.ext} onChange={(e) => handleUpdateTrafficData(type, 'ext', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.dla} onChange={(e) => handleUpdateTrafficData(type, 'dla', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.cnl} onChange={(e) => handleUpdateTrafficData(type, 'cnl', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.ef} onChange={(e) => handleUpdateTrafficData(type, 'ef', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.cf} onChange={(e) => handleUpdateTrafficData(type, 'cf', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.rtb} onChange={(e) => handleUpdateTrafficData(type, 'rtb', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.rta} onChange={(e) => handleUpdateTrafficData(type, 'rta', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.dvt} onChange={(e) => handleUpdateTrafficData(type, 'dvt', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
                <td className="border border-gray-300 p-1"><input type="number" min="0" value={data.ga} onChange={(e) => handleUpdateTrafficData(type, 'ga', parseInt(e.target.value))} disabled={formMode === 'view'} className="w-full text-center text-xs disabled:bg-gray-100" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* C.1: Hourly Traffic */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">C.1 Total Traffic Per Jam (UTC)</h4>
        <div className="grid grid-cols-6 gap-2">
          {sectionC.hourlyTraffic.map((value, hour) => (
            <div key={hour}>
              <label className="text-xs text-gray-600">{String(hour).padStart(2, '0')}:00</label>
              <input
                type="number"
                min="0"
                value={value}
                onChange={(e) => {
                  const newHourly = [...sectionC.hourlyTraffic];
                  newHourly[hour] = parseInt(e.target.value) || 0;
                  setSectionC({...sectionC, hourlyTraffic: newHourly});
                }}
                disabled={formMode === 'view'}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
          ))}
        </div>
      </div>

      {/* C.2: Operational Disruptions */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">C.2 Gangguan Operasional (BOS/BOC/Inconvenience)</h4>
        <div className="space-y-2">
          {sectionC.disruptions.map((disr, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={disr.type}
                  onChange={(e) => {
                    const newDisr = [...sectionC.disruptions];
                    newDisr[idx].type = e.target.value;
                    setSectionC({...sectionC, disruptions: newDisr});
                  }}
                  disabled={formMode === 'view'}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Pilih Jenis Gangguan</option>
                  <option value="BOS">BOS (Block Off Safety)</option>
                  <option value="BOC">BOC (Block Off Convection)</option>
                  <option value="Inconvenience">Inconvenience</option>
                </select>
                <input
                  type="number"
                  placeholder="Durasi (menit)"
                  value={disr.duration}
                  onChange={(e) => {
                    const newDisr = [...sectionC.disruptions];
                    newDisr[idx].duration = parseInt(e.target.value) || 0;
                    setSectionC({...sectionC, disruptions: newDisr});
                  }}
                  disabled={formMode === 'view'}
                  className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <textarea
                placeholder="Deskripsi"
                value={disr.description}
                onChange={(e) => {
                  const newDisr = [...sectionC.disruptions];
                  newDisr[idx].description = e.target.value;
                  setSectionC({...sectionC, disruptions: newDisr});
                }}
                disabled={formMode === 'view'}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                rows="2"
              />
              <button
                onClick={() => {
                  const newDisr = sectionC.disruptions.filter((_, i) => i !== idx);
                  setSectionC({...sectionC, disruptions: newDisr});
                }}
                disabled={formMode === 'view'}
                className="text-xs text-red-600 hover:text-red-800 disabled:text-gray-400"
              >
                Hapus
              </button>
            </div>
          ))}
          {formMode !== 'view' && (
            <button
              onClick={() => setSectionC({...sectionC, disruptions: [...sectionC.disruptions, {type: '', duration: 0, description: '', impact: ''}]})}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Tambah Gangguan
            </button>
          )}
        </div>
      </div>

      {/* C.3: OTP Metrics */}
      <div>
        <h4 className="font-semibold text-gray-800 mb-2">C.3 Kinerja Ketepatan Waktu (OTP)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-700">OTP Airline (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={sectionC.otpMetrics.airlinePercentage}
              onChange={(e) => setSectionC({...sectionC, otpMetrics: {...sectionC.otpMetrics, airlinePercentage: parseFloat(e.target.value)}})}
              disabled={formMode === 'view'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">DEP Punctuality (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={sectionC.otpMetrics.depPunctuality}
              onChange={(e) => setSectionC({...sectionC, otpMetrics: {...sectionC.otpMetrics, depPunctuality: parseFloat(e.target.value)}})}
              disabled={formMode === 'view'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">ARR Punctuality (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={sectionC.otpMetrics.arrPunctuality}
              onChange={(e) => setSectionC({...sectionC, otpMetrics: {...sectionC.otpMetrics, arrPunctuality: parseFloat(e.target.value)}})}
              disabled={formMode === 'view'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSectionD = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">D. LAPORAN KOMUNIKASI</h3>
      
      <div className="space-y-3">
        {Object.entries(sectionD.systems).map(([key, data]) => (
          <div key={key} className="border border-gray-200 rounded-lg p-3">
            <div className="flex justify-between items-start mb-2">
              <label className="font-medium text-gray-700">{formatSystemName(key)}</label>
              <select
                value={data.status}
                onChange={(e) => setSectionD({...sectionD, systems: {...sectionD.systems, [key]: {...data, status: e.target.value}}})}
                disabled={formMode === 'view'}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="Operational">Operational</option>
                <option value="Degraded">Degraded</option>
                <option value="Out of Service">Out of Service</option>
              </select>
            </div>
            <textarea
              value={data.notes}
              onChange={(e) => setSectionD({...sectionD, systems: {...sectionD.systems, [key]: {...data, notes: e.target.value}}})}
              disabled={formMode === 'view'}
              placeholder="Keterangan (jika ada)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              rows="2"
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderSectionE = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">E. GANGGUAN INSIDEN & TINDAK LANJUT</h3>
      
      <div className="space-y-3">
        {sectionE.incidents.map((incident) => (
          <div key={incident.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-600">Waktu UTC</label>
                <input
                  type="time"
                  value={incident.time}
                  onChange={(e) => handleUpdateIncident(incident.id, 'time', e.target.value)}
                  disabled={formMode === 'view'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Durasi (menit)</label>
                <input
                  type="number"
                  min="0"
                  value={incident.duration}
                  onChange={(e) => handleUpdateIncident(incident.id, 'duration', parseInt(e.target.value))}
                  disabled={formMode === 'view'}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Jenis Gangguan"
              value={incident.type}
              onChange={(e) => handleUpdateIncident(incident.id, 'type', e.target.value)}
              disabled={formMode === 'view'}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <input
              type="text"
              placeholder="Sistem Terdampak"
              value={incident.system}
              onChange={(e) => handleUpdateIncident(incident.id, 'system', e.target.value)}
              disabled={formMode === 'view'}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <textarea
              placeholder="Tindak Lanjut"
              value={incident.action}
              onChange={(e) => handleUpdateIncident(incident.id, 'action', e.target.value)}
              disabled={formMode === 'view'}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              rows="2"
            />
            <textarea
              placeholder="Keterangan"
              value={incident.notes}
              onChange={(e) => handleUpdateIncident(incident.id, 'notes', e.target.value)}
              disabled={formMode === 'view'}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              rows="2"
            />
            {formMode !== 'view' && (
              <button
                onClick={() => handleRemoveIncident(incident.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Hapus Insiden
              </button>
            )}
          </div>
        ))}
        {formMode !== 'view' && (
          <button
            onClick={handleAddIncident}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Tambah Insiden
          </button>
        )}
      </div>
    </div>
  );

  const renderSectionF = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">F. CATATAN OPERASIONAL</h3>
      
      <textarea
        value={sectionF.operationalNotes}
        onChange={(e) => setSectionF({operationalNotes: e.target.value})}
        disabled={formMode === 'view'}
        placeholder="Catatan operasional bebas (jika ada)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        rows="6"
      />
    </div>
  );

  const formatConditionLabel = (key) => {
    const map = {
      general: 'Kondisi Umum Ruang Udara',
      notam: 'NOTAM Aktif',
      restriction: 'Restriksi Airspace',
      fir: 'Status FIR/Sektor',
      weather: 'Kondisi Cuaca Signifikan (SIGMET)',
      military: 'Koordinasi Militer'
    };
    return map[key] || key;
  };

  const formatMovementType = (type) => {
    const map = {
      scheduled: 'Scheduled',
      unscheduled: 'Unscheduled',
      vip: 'VIP',
      cargo: 'Cargo',
      military: 'Military/State',
      helicopter: 'Helicopter',
      training: 'Training/Circuit'
    };
    return map[type] || type;
  };

  const handleUpdateTrafficData = (type, field, value) => {
    setSectionC({
      ...sectionC,
      movements: {
        ...sectionC.movements,
        [type]: {
          ...sectionC.movements[type],
          [field]: value
        }
      }
    });
  };

  if (!userInfo) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Daily Report - {branchInfo?.name}</h2>
        <div className="text-sm text-gray-600">
          Mode: <span className="font-semibold">{formMode === 'create' ? 'CREATE' : formMode === 'edit' ? 'EDIT' : 'VIEW'}</span>
        </div>
      </div>

      {/* Status Message */}
      {submitStatus && (
        <div className={`p-4 rounded-lg ${submitStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {submitStatus.message}
        </div>
      )}

      {/* Date Selector */}
      <div className="flex gap-2 mb-6">
        <input
          type="date"
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
          disabled={formMode === 'view' || loading}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => resetForm()}
          disabled={formMode === 'view' || loading}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto border-b border-gray-300">
        {['section-a', 'section-b', 'section-c', 'section-d', 'section-e', 'section-f'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        {activeTab === 'section-a' && renderSectionA()}
        {activeTab === 'section-b' && renderSectionB()}
        {activeTab === 'section-c' && renderSectionC()}
        {activeTab === 'section-d' && renderSectionD()}
        {activeTab === 'section-e' && renderSectionE()}
        {activeTab === 'section-f' && renderSectionF()}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        {formMode !== 'view' && (
          <>
            <button
              onClick={handleSaveReport}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Menyimpan...' : 'Simpan Laporan'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
