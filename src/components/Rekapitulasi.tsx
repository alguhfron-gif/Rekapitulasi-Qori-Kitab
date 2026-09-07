import React, { useState, useMemo } from 'react';
import {
  Peserta,
  AttendanceRecord,
  MonthlyActiveDays,
  RekapPesertaItem,
} from '../types';
import {
  HIJRI_MONTHS,
  getDateRangeForFilter,
  formatIndonesianDate,
  getTodayString,
} from '../utils/dateHelper';
import { exportRekapToExcel } from '../utils/excel';
import {
  Download,
  Search,
  Filter,
  Calendar,
  Eye,
  User,
  CheckCircle2,
  Trash2,
  CalendarRange,
  Moon,
  ListFilter,
} from 'lucide-react';

interface RekapitulasiProps {
  pesertaList: Peserta[];
  records: AttendanceRecord[];
  activeDaysSetting: MonthlyActiveDays;
  onDeleteRecord: (id: string) => void;
}

type FilterPreset = 'today' | 'this_week' | 'this_month' | 'hijri' | 'custom';

export const Rekapitulasi: React.FC<RekapitulasiProps> = ({
  pesertaList,
  records,
  activeDaysSetting,
  onDeleteRecord,
}) => {
  // Filter states
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayString());
  const [selectedHijriMonth, setSelectedHijriMonth] = useState<number>(3); // Rabi'ul Awwal default
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [activeView, setActiveView] = useState<'rekap' | 'detail'>('rekap');

  // Selected peserta for individual export or detail modal
  const [selectedPesertaForDetail, setSelectedPesertaForDetail] = useState<Peserta | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [singleExportPesertaId, setSingleExportPesertaId] = useState<string>('ALL');

  // Compute active date range based on filter preset
  const dateRange = useMemo(() => {
    return getDateRangeForFilter(filterPreset, {
      customStart: customStartDate,
      customEnd: customEndDate,
      hijriMonthId: selectedHijriMonth,
      hijriYear: 1448,
    });
  }, [filterPreset, customStartDate, customEndDate, selectedHijriMonth]);

  // Filter records within date range
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchDate = r.tanggal >= dateRange.startDate && r.tanggal <= dateRange.endDate;
      return matchDate;
    });
  }, [records, dateRange]);

  // Unique list of classes
  const classesList = useMemo(() => {
    const set = new Set<string>();
    pesertaList.forEach((p) => {
      if (p.kelas) set.add(p.kelas);
    });
    return Array.from(set).sort();
  }, [pesertaList]);

  // Calculate default active days for the filtered range
  const estimatedActiveDays = useMemo(() => {
    // If filtering by "this_month", use month key
    const parts = dateRange.startDate.split('-');
    const yearMonth = `${parts[0]}-${parts[1]}`;
    if (activeDaysSetting[yearMonth]) {
      return activeDaysSetting[yearMonth];
    }

    // Otherwise calculate total days in range approximately (excluding Sundays)
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    let workDays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() !== 0) {
        // exclude Sunday
        workDays++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, workDays);
  }, [dateRange, activeDaysSetting]);

  // Compute Rekap Items per Peserta
  // Formula: Alfa = Hari Aktif - Hadir - Sakit - Izin
  const rekapData: RekapPesertaItem[] = useMemo(() => {
    return pesertaList.map((peserta) => {
      const pRecords = filteredRecords.filter((r) => r.idPps === peserta.idPps);
      const hadir = pRecords.filter((r) => r.status === 'Hadir').length;
      const sakit = pRecords.filter((r) => r.status === 'Sakit').length;
      const izin = pRecords.filter((r) => r.status === 'Izin').length;

      // User requested formula: Alfa = Hari Aktif - Hadir - Sakit - Izin
      const calculatedAlfa = Math.max(0, estimatedActiveDays - hadir - sakit - izin);

      // Percentage: (Hadir / Hari Aktif) * 100
      const persentaseKehadiran =
        estimatedActiveDays > 0 ? Math.min(100, (hadir / estimatedActiveDays) * 100) : 0;

      // Detail tanggal izin & alasan
      const izinSakitRecords = pRecords.filter((r) => r.status !== 'Hadir');
      const detailTanggalIzin = izinSakitRecords
        .map((r) => `${r.tanggal.slice(5)} (${r.status}${r.alasan ? `: ${r.alasan}` : ''})`)
        .join(', ');

      const detailAlasan = izinSakitRecords
        .map((r) => {
          let str = `${r.status}: ${r.alasan || '-'}`;
          if (r.keterangan) str += ` [${r.keterangan}]`;
          return str;
        })
        .join('; ');

      return {
        idPps: peserta.idPps,
        nama: peserta.nama,
        kelas: peserta.kelas,
        jabatan: peserta.jabatan,
        hariAktif: estimatedActiveDays,
        hadir,
        sakit,
        izin,
        alfa: calculatedAlfa,
        persentaseKehadiran,
        detailTanggalIzin,
        detailAlasan,
      };
    });
  }, [pesertaList, filteredRecords, estimatedActiveDays]);

  // Filter rekapData by search and class
  const filteredRekapData = useMemo(() => {
    return rekapData.filter((item) => {
      const matchSearch =
        item.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.idPps.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKelas = filterKelas === 'ALL' || item.kelas === filterKelas;
      return matchSearch && matchKelas;
    });
  }, [rekapData, searchQuery, filterKelas]);

  // Filter detail records by search and class
  const filteredDetailRecords = useMemo(() => {
    return filteredRecords.filter((rec) => {
      const matchSearch =
        rec.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.idPps.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKelas = filterKelas === 'ALL' || rec.kelas === filterKelas;
      return matchSearch && matchKelas;
    });
  }, [filteredRecords, searchQuery, filterKelas]);

  // Handle Export to Excel
  const handleExport = (pesertaId = 'ALL') => {
    let itemsToExport = filteredRekapData;
    let label = dateRange.label;

    if (pesertaId !== 'ALL') {
      itemsToExport = filteredRekapData.filter((i) => i.idPps === pesertaId);
      const p = pesertaList.find((x) => x.idPps === pesertaId);
      label = `${p ? p.nama : pesertaId}_${label}`;
    }

    exportRekapToExcel(itemsToExport, 'Rekap_Presensi_MTK', label);
    setExportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarRange className="h-5 w-5 text-emerald-600" />
              Rekapitulasi & Riwayat Presensi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Filter tanggal fleksibel, hitung otomatis alfa dan ekspor ke Excel
            </p>
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            id="btn-open-export"
            onClick={() => setExportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm transition"
          >
            <Download className="h-4 w-4" />
            <span>Export ke Excel</span>
          </button>
        </div>

        {/* 1. Date Filter Presets */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pilih Rentang Waktu:
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'this_week', label: 'Minggu Ini' },
              { id: 'this_month', label: 'Bulan Ini' },
              { id: 'hijri', label: 'Pilih Bulan Hijriah', icon: Moon },
              { id: 'custom', label: 'Rentang Manual', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = filterPreset === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  id={`filter-preset-${tab.id}`}
                  onClick={() => setFilterPreset(tab.id as FilterPreset)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                    isSelected
                      ? 'bg-emerald-700 text-white font-bold shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Conditional Sub-Filter: Hijri Month or Custom Range */}
        {filterPreset === 'hijri' && (
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center gap-3 animate-fade-in">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Moon className="h-4 w-4 text-emerald-700" />
              Pilih Bulan Hijriah (Tahun 1448 H):
            </span>
            <select
              value={selectedHijriMonth}
              onChange={(e) => setSelectedHijriMonth(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {HIJRI_MONTHS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}. {m.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-emerald-800 italic">
              Estimasi rentang: {dateRange.startDate} s/d {dateRange.endDate}
            </span>
          </div>
        )}

        {filterPreset === 'custom' && (
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-wrap items-center gap-3 animate-fade-in">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-700" />
              Rentang Tanggal Manual:
            </span>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-600 font-medium">Dari:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-600 font-medium">Sampai:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Search and Class Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-100">
          <div className="sm:col-span-8 relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              id="search-rekap"
              placeholder="Cari nama asatidz atau ID PPS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div className="sm:col-span-4 relative">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                id="filter-kelas-rekap"
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              >
                <option value="ALL">Semua Kelas/Majelis</option>
                {classesList.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher: Tabel Rekapitulasi vs Tabel Riwayat Detail */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="view-tab-rekap"
            onClick={() => setActiveView('rekap')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeView === 'rekap'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ListFilter className="h-4 w-4" />
            <span>Tabel Rekapitulasi Per Orang ({filteredRekapData.length})</span>
          </button>

          <button
            type="button"
            id="view-tab-detail"
            onClick={() => setActiveView('detail')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
              activeView === 'detail'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Tabel Riwayat Detail Sesi ({filteredDetailRecords.length})</span>
          </button>
        </div>

        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          Periode: <strong>{dateRange.label}</strong>
        </span>
      </div>

      {/* View 1: Tabel Rekapitulasi Per Orang */}
      {activeView === 'rekap' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Rumus Alfa:{' '}
              <code className="bg-white px-2 py-0.5 rounded border border-slate-300 font-mono text-rose-700 font-bold">
                Hari Aktif ({estimatedActiveDays}) - Hadir - Sakit - Izin
              </code>
            </span>
            <span>Klik baris untuk melihat riwayat individual</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-3">ID PPS</th>
                  <th className="py-3 px-4">Nama Asatidz</th>
                  <th className="py-3 px-3">Kelas</th>
                  <th className="py-3 px-3 text-center">Hari Aktif</th>
                  <th className="py-3 px-3 text-center text-emerald-700 font-bold">Hadir</th>
                  <th className="py-3 px-3 text-center text-amber-700 font-bold">Sakit</th>
                  <th className="py-3 px-3 text-center text-blue-700 font-bold">Izin</th>
                  <th className="py-3 px-3 text-center text-rose-700 font-bold">Alfa</th>
                  <th className="py-3 px-3 text-center">% Kehadiran</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRekapData.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      Tidak ada data asatidz yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredRekapData.map((item, idx) => {
                    const isPerfect = item.alfa === 0 && item.izin === 0;
                    return (
                      <tr
                        key={item.idPps}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                        onClick={() => {
                          const p = pesertaList.find((x) => x.idPps === item.idPps);
                          if (p) setSelectedPesertaForDetail(p);
                        }}
                      >
                        <td className="py-3.5 px-3 text-center text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs">
                            {item.idPps}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {item.nama}
                          <span className="block text-[11px] font-normal text-slate-500">
                            {item.jabatan}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 font-medium">{item.kelas}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-600">
                          {item.hariAktif}
                        </td>
                        <td className="py-3.5 px-3 text-center font-extrabold text-emerald-700">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                            {item.hadir}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-amber-700">
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                            {item.sakit}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-blue-700">
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                            {item.izin}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-extrabold text-rose-700">
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              item.alfa > 0
                                ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          >
                            {item.alfa}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                              item.persentaseKehadiran >= 85
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.persentaseKehadiran >= 70
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.persentaseKehadiran.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                const p = pesertaList.find((x) => x.idPps === item.idPps);
                                if (p) setSelectedPesertaForDetail(p);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition"
                              title="Lihat Detail Riwayat"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExport(item.idPps)}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition"
                              title="Export Excel Peserta Ini"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Tabel Riwayat Detail Sesi */}
      {activeView === 'detail' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Menampilkan {filteredDetailRecords.length} catatan presensi pada rentang {dateRange.label}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">ID PPS</th>
                  <th className="py-3 px-4">Nama Asatidz</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDetailRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada catatan presensi pada rentang waktu ini.
                    </td>
                  </tr>
                ) : (
                  filteredDetailRecords.map((rec) => {
                    const statusBadge = {
                      Hadir: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                      Sakit: 'bg-amber-100 text-amber-800 border-amber-300',
                      Izin: 'bg-blue-100 text-blue-800 border-blue-300',
                      Alfa: 'bg-rose-100 text-rose-800 border-rose-300',
                    }[rec.status];

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {formatIndonesianDate(rec.tanggal)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs">
                            {rec.idPps}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {rec.nama}
                          <span className="block text-[11px] font-normal text-slate-500">
                            {rec.jabatan}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">{rec.kelas}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge}`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-medium">
                          {rec.alasan || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 italic text-xs max-w-xs truncate">
                          {rec.keterangan || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus catatan presensi ${rec.nama} tanggal ${rec.tanggal}?`)) {
                                onDeleteRecord(rec.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Export Options (Semua Peserta vs 1 Peserta) */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" />
                Export Rekap ke File Excel
              </h3>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700 block">Kolom yang diexport:</span>
                <p className="text-slate-500 mt-1">
                  ID PPS, Nama, Kelas, Jabatan, Hari Aktif, Hadir, Sakit, Izin, Alfa, Detail Tanggal Izin, Detail Alasan
                </p>
                <div className="mt-2 text-emerald-800 font-semibold">
                  Periode: {dateRange.label}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Pilih Peserta yang Ingin Diexport:
                </label>
                <select
                  value={singleExportPesertaId}
                  onChange={(e) => setSingleExportPesertaId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Peserta ({filteredRekapData.length} Orang)</option>
                  {pesertaList.map((p) => (
                    <option key={p.idPps} value={p.idPps}>
                      {p.idPps} - {p.nama} ({p.kelas})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-export"
                onClick={() => handleExport(singleExportPesertaId)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
              >
                <Download className="h-4 w-4" />
                <span>Unduh File Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Individual Attendance Detail for a Teacher */}
      {selectedPesertaForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedPesertaForDetail.nama}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold">
                    {selectedPesertaForDetail.idPps}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Kelas: {selectedPesertaForDetail.kelas} • Jabatan: {selectedPesertaForDetail.jabatan}
                </p>
                <p className="text-xs text-emerald-800 font-semibold mt-1">
                  Periode: {dateRange.label}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport(selectedPesertaForDetail.idPps)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPesertaForDetail(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold p-1 text-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catatan Kehadiran pada Periode Ini:
              </h4>

              {(() => {
                const individualRecords = filteredRecords.filter(
                  (r) => r.idPps === selectedPesertaForDetail.idPps
                );

                if (individualRecords.length === 0) {
                  return (
                    <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl text-xs">
                      Belum ada sesi presensi yang tercatat untuk asatidz ini pada rentang waktu ini.
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {individualRecords.map((r) => {
                      const statusColor = {
                        Hadir: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        Sakit: 'bg-amber-100 text-amber-800 border-amber-300',
                        Izin: 'bg-blue-100 text-blue-800 border-blue-300',
                        Alfa: 'bg-rose-100 text-rose-800 border-rose-300',
                      }[r.status];

                      return (
                        <div
                          key={r.id}
                          className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              {formatIndonesianDate(r.tanggal)}
                            </span>
                            {(r.alasan || r.keterangan) && (
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                <strong>Alasan:</strong> {r.alasan || '-'}{' '}
                                {r.keterangan && `(${r.keterangan})`}
                              </div>
                            )}
                          </div>
                          <span className={`px-2.5 py-1 rounded font-bold border ${statusColor}`}>
                            {r.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
