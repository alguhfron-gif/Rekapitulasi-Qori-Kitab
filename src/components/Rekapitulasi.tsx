import React, { useState, useMemo, useEffect } from 'react';
import {
  Peserta,
  AttendanceRecord,
  MonthlyActiveDays,
  RekapPesertaItem,
  TINGKAT_MAJLIS_LIST,
  MAJLIS_OPTIONS,
  AttendanceStatus,
  AttendanceReason,
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
  Trash2,
  CalendarRange,
  Moon,
  Pencil,
  PlusCircle,
  LayoutDashboard,
  CheckCircle2,
  CalendarCheck,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import { ActiveTab } from './Navbar';

interface RekapitulasiProps {
  mode?: 'rekap' | 'detail';
  pesertaList: Peserta[];
  records: AttendanceRecord[];
  activeDaysSetting: MonthlyActiveDays;
  onDeleteRecord: (id: string) => void;
  onDeletePeserta?: (id: string) => void;
  onDeleteMultipleRecords?: (ids: string[]) => void;
  onSaveActiveDays?: (activeDays: MonthlyActiveDays) => void;
  onEditPeserta?: (updatedPeserta: Peserta) => void;
  onSaveRecord?: (recordData: Omit<AttendanceRecord, 'id' | 'timestamp'>) => void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

type FilterPreset = 'today' | 'this_week' | 'this_month' | 'hijri' | 'custom';

export const Rekapitulasi: React.FC<RekapitulasiProps> = ({
  mode = 'rekap',
  pesertaList,
  records,
  activeDaysSetting,
  onDeleteRecord,
  onDeletePeserta,
  onDeleteMultipleRecords,
  onSaveActiveDays,
  onEditPeserta,
  onSaveRecord,
  onNavigateTab,
}) => {
  // Global filter states
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(getTodayString());
  const [selectedHijriMonth, setSelectedHijriMonth] = useState<number>(3); // Rabi'ul Awwal default
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [filterMajlis, setFilterMajlis] = useState<string>('ALL');
  const activeView = mode;

  // Search & Pagination for Tab 1: Tabel Rekapitulasi Per Orang
  const [searchRekap, setSearchRekap] = useState<string>('');
  const [entriesPerPageRekap, setEntriesPerPageRekap] = useState<number>(10);
  const [currentPageRekap, setCurrentPageRekap] = useState<number>(1);

  // Search & Pagination for Tab 2: Tabel Riwayat Detail Sesi
  const [searchDetail, setSearchDetail] = useState<string>('');
  const [entriesPerPageDetail, setEntriesPerPageDetail] = useState<number>(10);
  const [currentPageDetail, setCurrentPageDetail] = useState<number>(1);

  // Bulk selection in Tab 2
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Modals
  const [editingPeserta, setEditingPeserta] = useState<Peserta | null>(null);
  const [pesertaForm, setPesertaForm] = useState<{
    idPps: string;
    nama: string;
    dom: string;
    kelas: string;
    majlis: string;
    jabatan: string;
  }>({ idPps: '', nama: '', dom: '', kelas: '', majlis: '', jabatan: '' });

  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [recordForm, setRecordForm] = useState<{
    tanggal: string;
    status: AttendanceStatus;
    alasan: AttendanceReason;
    keterangan: string;
  }>({
    tanggal: getTodayString(),
    status: 'Hadir',
    alasan: '',
    keterangan: '',
  });

  // Selected peserta for individual detail modal & export
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
      return r.tanggal >= dateRange.startDate && r.tanggal <= dateRange.endDate;
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

  // Unique list of majlis
  const majlisList = useMemo(() => {
    const set = new Set<string>();
    pesertaList.forEach((p) => {
      if (p.majlis) set.add(p.majlis);
    });
    return Array.from(set).sort();
  }, [pesertaList]);

  // Period keys for saving and querying active days
  const gregorianKey = useMemo(() => {
    const parts = dateRange.startDate.split('-');
    return `${parts[0]}-${parts[1]}`;
  }, [dateRange.startDate]);

  const hijriKey = useMemo(() => {
    return `1448-${String(selectedHijriMonth).padStart(2, '0')}`;
  }, [selectedHijriMonth]);

  const periodKey = filterPreset === 'hijri' ? hijriKey : gregorianKey;

  // Base calculated working days for the filtered range
  const baseCalculatedDays = useMemo(() => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    let workDays = 0;
    const cur = new Date(start);
    while (cur <= end) {
      if (cur.getDay() !== 0) { // Senin - Sabtu
        workDays++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(1, workDays);
  }, [dateRange.startDate, dateRange.endDate]);

  // Current effective active days: stored override or base calculated
  const storedOverride = activeDaysSetting[periodKey] ?? activeDaysSetting[gregorianKey];
  const effectiveActiveDays = storedOverride !== undefined ? storedOverride : baseCalculatedDays;

  // Local state for active days input
  const [activeDaysInput, setActiveDaysInput] = useState<number>(effectiveActiveDays);

  // Synchronize local input whenever effectiveActiveDays or period changes
  useEffect(() => {
    setActiveDaysInput(effectiveActiveDays);
  }, [effectiveActiveDays, periodKey]);

  // Handler for user adjusting active days (e.g. at end of month)
  // When active days change, all alfa and attendance percentages recalculate instantly!
  const handleUpdateActiveDays = (newDays: number) => {
    const clamped = Math.max(1, Math.min(31, Math.round(newDays)));
    setActiveDaysInput(clamped);
    if (onSaveActiveDays) {
      const updated: MonthlyActiveDays = {
        ...activeDaysSetting,
        [periodKey]: clamped,
        [gregorianKey]: clamped,
        [hijriKey]: clamped,
      };
      onSaveActiveDays(updated);
    }
    setToastMessage(
      `Hari aktif periode ${dateRange.label} disesuaikan menjadi ${clamped} hari. Seluruh alfa & persentase otomatis terhitung ulang!`
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Compute Rekap Items per Peserta
  // Formula: Alfa = Hari Aktif - Hadir - Sakit - Izin
  // When effectiveActiveDays changes, this memoized array recalculates immediately!
  const rekapData: RekapPesertaItem[] = useMemo(() => {
    return pesertaList.map((peserta) => {
      const pRecords = filteredRecords.filter((r) => r.idPps === peserta.idPps);
      const hadir = pRecords.filter((r) => r.status === 'Hadir').length;
      const sakit = pRecords.filter((r) => r.status === 'Sakit').length;
      const izin = pRecords.filter((r) => r.status === 'Izin').length;

      const calculatedAlfa = Math.max(0, effectiveActiveDays - hadir - sakit - izin);
      const persentaseKehadiran =
        effectiveActiveDays > 0 ? Math.min(100, (hadir / effectiveActiveDays) * 100) : 0;
      const persentaseRounded10 = Math.round(persentaseKehadiran / 10) * 10;
      const trendPanah: 'up' | 'flat' | 'down' =
        persentaseKehadiran >= 90 ? 'up' : persentaseKehadiran >= 70 ? 'flat' : 'down';

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
        dom: peserta.dom || '-',
        kelas: peserta.kelas,
        majlis: peserta.majlis || 'Majlis Utama',
        jabatan: peserta.jabatan,
        hariAktif: effectiveActiveDays,
        hadir,
        sakit,
        izin,
        alfa: calculatedAlfa,
        persentaseKehadiran,
        persentaseRounded10,
        trendPanah,
        detailTanggalIzin,
        detailAlasan,
      };
    });
  }, [pesertaList, filteredRecords, effectiveActiveDays]);

  // Tab 1: Filtered Rekap Data by Search & Kelas & Majlis
  const filteredRekapData = useMemo(() => {
    return rekapData.filter((item) => {
      const query = searchRekap.trim().toLowerCase();
      const matchSearch =
        query === '' ||
        item.nama.toLowerCase().includes(query) ||
        item.idPps.toLowerCase().includes(query) ||
        (item.dom && item.dom.toLowerCase().includes(query)) ||
        (item.majlis && item.majlis.toLowerCase().includes(query));
      const matchKelas = filterKelas === 'ALL' || item.kelas === filterKelas;
      const matchMajlis = filterMajlis === 'ALL' || item.majlis === filterMajlis;
      return matchSearch && matchKelas && matchMajlis;
    });
  }, [rekapData, searchRekap, filterKelas, filterMajlis]);

  // Tab 1: Pagination Calculations
  const totalItemsRekap = filteredRekapData.length;
  const totalPagesRekap = Math.max(1, Math.ceil(totalItemsRekap / entriesPerPageRekap));
  const validPageRekap = Math.min(currentPageRekap, totalPagesRekap);
  const startIdxRekap = (validPageRekap - 1) * entriesPerPageRekap;
  const endIdxRekap = Math.min(startIdxRekap + entriesPerPageRekap, totalItemsRekap);
  const paginatedRekapData = useMemo(() => {
    return filteredRekapData.slice(startIdxRekap, endIdxRekap);
  }, [filteredRekapData, startIdxRekap, endIdxRekap]);

  // Tab 2: Filtered Detail Records by Search & Kelas & Majlis
  const filteredDetailRecords = useMemo(() => {
    return filteredRecords.filter((rec) => {
      const query = searchDetail.trim().toLowerCase();
      const matchSearch =
        query === '' ||
        rec.nama.toLowerCase().includes(query) ||
        rec.idPps.toLowerCase().includes(query) ||
        (rec.dom && rec.dom.toLowerCase().includes(query)) ||
        (rec.majlis && rec.majlis.toLowerCase().includes(query)) ||
        (rec.alasan && rec.alasan.toLowerCase().includes(query)) ||
        (rec.keterangan && rec.keterangan.toLowerCase().includes(query));
      const matchKelas = filterKelas === 'ALL' || rec.kelas === filterKelas;
      const matchMajlis = filterMajlis === 'ALL' || rec.majlis === filterMajlis;
      return matchSearch && matchKelas && matchMajlis;
    });
  }, [filteredRecords, searchDetail, filterKelas, filterMajlis]);

  // Tab 2: Pagination Calculations
  const totalItemsDetail = filteredDetailRecords.length;
  const totalPagesDetail = Math.max(1, Math.ceil(totalItemsDetail / entriesPerPageDetail));
  const validPageDetail = Math.min(currentPageDetail, totalPagesDetail);
  const startIdxDetail = (validPageDetail - 1) * entriesPerPageDetail;
  const endIdxDetail = Math.min(startIdxDetail + entriesPerPageDetail, totalItemsDetail);
  const paginatedDetailRecords = useMemo(() => {
    return filteredDetailRecords.slice(startIdxDetail, endIdxDetail);
  }, [filteredDetailRecords, startIdxDetail, endIdxDetail]);

  // Open Edit Peserta Modal
  const handleOpenEditPeserta = (p: Peserta) => {
    setEditingPeserta(p);
    setPesertaForm({
      idPps: p.idPps,
      nama: p.nama,
      dom: p.dom || '',
      kelas: p.kelas,
      majlis: p.majlis || 'Majlis Utama',
      jabatan: p.jabatan,
    });
  };

  // Save Edited Peserta
  const handleSaveEditPeserta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeserta || !onEditPeserta) return;

    if (!pesertaForm.nama.trim() || !pesertaForm.idPps.trim()) {
      alert('Nama asatidz dan ID PPS wajib diisi.');
      return;
    }

    const updated: Peserta = {
      ...editingPeserta,
      nama: pesertaForm.nama.trim(),
      idPps: pesertaForm.idPps.trim(),
      dom: pesertaForm.dom.trim() || '-',
      kelas: pesertaForm.kelas,
      majlis: pesertaForm.majlis.trim() || 'Majlis Utama',
      jabatan: pesertaForm.jabatan.trim(),
    };

    onEditPeserta(updated);
    setEditingPeserta(null);
  };

  // Open Edit Record Modal
  const handleOpenEditRecord = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setRecordForm({
      tanggal: rec.tanggal,
      status: rec.status,
      alasan: rec.alasan || '',
      keterangan: rec.keterangan || '',
    });
  };

  // Save Edited Record
  const handleSaveEditRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !onSaveRecord) return;

    onSaveRecord({
      tanggal: recordForm.tanggal,
      idPps: editingRecord.idPps,
      nama: editingRecord.nama,
      dom: editingRecord.dom || '-',
      kelas: editingRecord.kelas,
      majlis: editingRecord.majlis || 'Majlis Utama',
      jabatan: editingRecord.jabatan,
      status: recordForm.status,
      alasan: recordForm.status === 'Hadir' ? '' : recordForm.alasan,
      keterangan: recordForm.keterangan.trim(),
    });

    setEditingRecord(null);
  };

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
      {/* Top Filter & Date Range Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {activeView === 'rekap' ? (
                <>
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <span>Rekapitulasi Per Orang</span>
                </>
              ) : (
                <>
                  <CalendarRange className="h-5 w-5 text-emerald-600" />
                  <span>Riwayat Detail Sesi</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeView === 'rekap'
                ? 'Rekapitulasi kehadiran asatidz, total kehadiran, izin, sakit, alfa, persentase kehadiran, dan ekspor data'
                : 'Catatan riwayat setiap sesi presensi asatidz harian lengkap dengan status kehadiran, alasan, dan keterangan'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Navigation Links */}
            {onNavigateTab && (
              <button
                type="button"
                id="btn-nav-to-input"
                onClick={() => onNavigateTab('input')}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
                title="Beralih ke form input presensi cepat"
              >
                <CalendarCheck className="h-4 w-4 text-emerald-700" />
                <span>Input Presensi</span>
              </button>
            )}

            {/* Export Excel Button */}
            <button
              type="button"
              id="btn-open-export"
              onClick={() => setExportModalOpen(true)}
              className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export ke Excel</span>
            </button>
          </div>
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
                  onClick={() => {
                    setFilterPreset(tab.id as FilterPreset);
                    setCurrentPageRekap(1);
                    setCurrentPageDetail(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
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
              onChange={(e) => {
                setSelectedHijriMonth(parseInt(e.target.value, 10));
                setCurrentPageRekap(1);
                setCurrentPageDetail(1);
              }}
              className="px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-semibold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setCurrentPageRekap(1);
                  setCurrentPageDetail(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-600 font-medium">Sampai:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setCurrentPageRekap(1);
                  setCurrentPageDetail(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Filter Kelas & Majlis */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <Filter className="h-4 w-4 text-slate-400 shrink-0" />
            <span>Filter Kelas:</span>
          </div>
          <select
            id="filter-kelas-rekap"
            value={filterKelas}
            onChange={(e) => {
              setFilterKelas(e.target.value);
              setCurrentPageRekap(1);
              setCurrentPageDetail(1);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 cursor-pointer"
          >
            <option value="ALL">Semua Kelas ({classesList.length})</option>
            {classesList.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium ml-2">
            <span>Filter Majlis:</span>
          </div>
          <select
            id="filter-majlis-rekap"
            value={filterMajlis}
            onChange={(e) => {
              setFilterMajlis(e.target.value);
              setCurrentPageRekap(1);
              setCurrentPageDetail(1);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 cursor-pointer"
          >
            <option value="ALL">Semua Majlis ({majlisList.length})</option>
            {majlisList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 ml-auto">
            Menampilkan data periode: <strong>{dateRange.label}</strong>
          </span>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-200 hover:text-white ml-2 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* BANNER PENYESUAIAN HARI AKTIF DI AKHIR BULAN / PERIODE */}
      <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-600/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CalendarCheck className="h-4 w-4" />
            </span>
            <h3 className="font-bold text-sm sm:text-base text-white">
              Penyesuaian Hari Aktif Periode: <span className="text-emerald-300">{dateRange.label}</span>
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Sesuaikan jumlah hari aktif di akhir bulan (misal ada libur mendadak/acara pondok). Begitu angka diubah, kolom <strong>Alfa</strong>, <strong>% Kehadiran</strong>, dan seluruh kalkulasi otomatis berubah serentak.
          </p>
        </div>

        {/* Interactive Controls */}
        <div className="flex items-center gap-2.5 flex-wrap bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10 self-start md:self-auto">
          <span className="text-xs text-slate-200 font-semibold pl-1">Hari Aktif:</span>
          <div className="flex items-center bg-slate-900/80 rounded-lg border border-slate-700 overflow-hidden">
            <button
              type="button"
              id="btn-decrement-active-days"
              onClick={() => handleUpdateActiveDays(effectiveActiveDays - 1)}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-bold transition cursor-pointer"
              title="Kurang 1 hari"
            >
              -
            </button>
            <input
              type="number"
              id="input-active-days-rekap"
              min={1}
              max={31}
              value={activeDaysInput}
              onChange={(e) => setActiveDaysInput(Number(e.target.value))}
              onBlur={() => handleUpdateActiveDays(activeDaysInput)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateActiveDays(activeDaysInput);
                }
              }}
              className="w-14 text-center bg-transparent text-emerald-300 font-mono font-bold text-sm focus:outline-none focus:bg-slate-800 py-1"
            />
            <button
              type="button"
              id="btn-increment-active-days"
              onClick={() => handleUpdateActiveDays(effectiveActiveDays + 1)}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-bold transition cursor-pointer"
              title="Tambah 1 hari"
            >
              +
            </button>
          </div>

          <button
            type="button"
            id="btn-apply-active-days"
            onClick={() => handleUpdateActiveDays(activeDaysInput)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
          >
            Terapkan
          </button>

          {effectiveActiveDays !== baseCalculatedDays && (
            <button
              type="button"
              id="btn-reset-to-calendar-days"
              onClick={() => handleUpdateActiveDays(baseCalculatedDays)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
              title={`Kembalikan ke hitungan kalender standar (${baseCalculatedDays} hari)`}
            >
              Standar ({baseCalculatedDays} hr)
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TABEL REKAPITULASI PER ORANG                                              */}
      {/* ========================================================================= */}
      {activeView === 'rekap' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* HEADER: FITUR DROPDOWN SHOW ENTRIES & SEARCH BOX */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* 1. Dropdown Show Entries di pojok kiri atas */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <label htmlFor="entries-rekap" className="text-slate-600">
                Tampilkan
              </label>
              <select
                id="entries-rekap"
                value={entriesPerPageRekap}
                onChange={(e) => {
                  setEntriesPerPageRekap(Number(e.target.value));
                  setCurrentPageRekap(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-600">data</span>
            </div>

            {/* 2. Search Box di pojok kanan atas */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                id="search-rekap-box"
                placeholder="Cari Nama / ID PPS..."
                value={searchRekap}
                onChange={(e) => {
                  setSearchRekap(e.target.value);
                  setCurrentPageRekap(1);
                }}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Sub-info bar */}
          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
            <span>
              Perhitungan Hari Aktif:{' '}
              <strong className="text-slate-800">{effectiveActiveDays} hari</strong> • Rumus Alfa:{' '}
              <code className="bg-white px-1.5 py-0.5 rounded border border-slate-300 font-mono text-rose-700 font-bold">
                Hari Aktif - Hadir - Sakit - Izin
              </code>
            </span>
            <span className="hidden sm:inline text-slate-500">
              Klik nama untuk detail kehadiran individual
            </span>
          </div>

          {/* Tabel Konten Tab 1 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/90 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th className="py-3 px-3">ID PPS</th>
                  <th className="py-3 px-4">Nama Asatidz</th>
                  <th className="py-3 px-3">DOM</th>
                  <th className="py-3 px-3">Kelas</th>
                  <th className="py-3 px-3">Majlis</th>
                  <th className="py-3 px-3 text-center">Hari Aktif</th>
                  <th className="py-3 px-3 text-center text-emerald-700 font-bold">Hadir</th>
                  <th className="py-3 px-3 text-center text-amber-700 font-bold">Sakit</th>
                  <th className="py-3 px-3 text-center text-blue-700 font-bold">Izin</th>
                  <th className="py-3 px-3 text-center text-rose-700 font-bold">Alfa</th>
                  <th className="py-3 px-3 text-center">% Kehadiran</th>
                  {/* KOLOM EDIT DI TABEL REKAPITULASI */}
                  <th className="py-3 px-3 text-center">Edit</th>
                  <th className="py-3 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRekapData.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-10 text-center text-slate-400">
                      Tidak ada data asatidz yang cocok dengan pencarian atau filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRekapData.map((item, idx) => {
                    const rowNumber = startIdxRekap + idx + 1;
                    const persentaseRounded = Math.round(item.persentaseKehadiran / 10) * 10;
                    const arrowIcon =
                      item.persentaseKehadiran >= 90
                        ? '▲'
                        : item.persentaseKehadiran >= 70
                        ? '▬'
                        : '▼';

                    return (
                      <tr
                        key={item.idPps}
                        className="hover:bg-slate-50/80 transition cursor-pointer"
                        onClick={() => {
                          const p = pesertaList.find((x) => x.idPps === item.idPps);
                          if (p) setSelectedPesertaForDetail(p);
                        }}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-medium">
                          {rowNumber}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono">
                            {item.idPps}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {item.nama}
                          <span className="block text-[11px] font-normal text-slate-500">
                            {item.jabatan}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            {item.dom || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                          {item.kelas}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold">
                            {item.majlis || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-600">
                          {item.hariAktif}
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-emerald-700">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                            {item.hadir}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-700">
                          <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                            {item.sakit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-blue-700">
                          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                            {item.izin}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-rose-700">
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
                        <td className="py-3 px-3 text-center font-bold whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black ${
                              item.persentaseKehadiran >= 85
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.persentaseKehadiran >= 70
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span>{arrowIcon}</span>
                            <span>{persentaseRounded}%</span>
                          </span>
                        </td>

                        {/* KOLOM EDIT DATA */}
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const p = pesertaList.find((x) => x.idPps === item.idPps);
                              if (p) handleOpenEditPeserta(p);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
                            title="Edit data asatidz ini"
                          >
                            <Pencil className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Edit</span>
                          </button>
                        </td>

                        {/* KOLOM AKSI (DETAIL & EXPORT) */}
                        <td
                          className="py-3 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const p = pesertaList.find((x) => x.idPps === item.idPps);
                                if (p) setSelectedPesertaForDetail(p);
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Lihat Rincian Riwayat"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExport(item.idPps)}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="Export Excel Asatidz Ini"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            {onDeletePeserta && (
                              <button
                                type="button"
                                onClick={() => {
                                  const p = pesertaList.find((x) => x.idPps === item.idPps);
                                  if (p && confirm(`Hapus data asatidz ${p.nama} (${p.idPps}) dari sistem?`)) {
                                    onDeletePeserta(p.id);
                                    setToastMessage(`Data asatidz ${p.nama} berhasil dihapus.`);
                                    setTimeout(() => setToastMessage(null), 3500);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Hapus Asatidz Ini"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 3. PAGINATION DI BAWAH TABEL TAB 1 */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Info Pagination Bahasa Indonesia */}
            <div className="text-slate-600 font-medium">
              {totalItemsRekap === 0 ? (
                <span>Menampilkan 0 data</span>
              ) : (
                <span>
                  Menampilkan <strong>{startIdxRekap + 1}</strong> sampai{' '}
                  <strong>{endIdxRekap}</strong> dari <strong>{totalItemsRekap}</strong> data
                </span>
              )}
            </div>

            {/* Tombol Navigasi Pagination */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-rekap-prev"
                onClick={() => setCurrentPageRekap((p) => Math.max(1, p - 1))}
                disabled={currentPageRekap <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                &lt;&lt; Sebelumnya
              </button>

              <span className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-800">
                Halaman {validPageRekap} dari {totalPagesRekap}
              </span>

              <button
                type="button"
                id="btn-rekap-next"
                onClick={() => setCurrentPageRekap((p) => Math.min(totalPagesRekap, p + 1))}
                disabled={currentPageRekap >= totalPagesRekap}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                Selanjutnya &gt;&gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TABEL RIWAYAT DETAIL SESI                                                 */}
      {/* ========================================================================= */}
      {activeView === 'detail' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* HEADER: FITUR DROPDOWN SHOW ENTRIES & SEARCH BOX */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* 1. Dropdown Show Entries di pojok kiri atas */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <label htmlFor="entries-detail" className="text-slate-600">
                Tampilkan
              </label>
              <select
                id="entries-detail"
                value={entriesPerPageDetail}
                onChange={(e) => {
                  setEntriesPerPageDetail(Number(e.target.value));
                  setCurrentPageDetail(1);
                }}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-slate-600">data</span>
            </div>

            {/* 2. Search Box di pojok kanan atas */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                id="search-detail-box"
                placeholder="Cari Nama / ID PPS..."
                value={searchDetail}
                onChange={(e) => {
                  setSearchDetail(e.target.value);
                  setCurrentPageDetail(1);
                }}
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Sub-info bar with bulk delete & filter actions */}
          <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Catatan riwayat sesi presensi individual periode: <strong>{dateRange.label}</strong>
              </span>
              <span className="text-slate-500">
                (Total: <strong>{totalItemsDetail} catatan</strong>)
              </span>
            </div>

            {/* Delete controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {selectedRecordIds.length > 0 && (
                <div className="flex items-center gap-2 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 animate-fade-in">
                  <span className="text-xs font-bold text-rose-700">
                    {selectedRecordIds.length} terpilih
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Apakah Anda yakin ingin menghapus ${selectedRecordIds.length} catatan presensi terpilih?`
                        )
                      ) {
                        if (onDeleteMultipleRecords) {
                          onDeleteMultipleRecords(selectedRecordIds);
                        } else {
                          selectedRecordIds.forEach((id) => onDeleteRecord(id));
                        }
                        setSelectedRecordIds([]);
                        setToastMessage(
                          `${selectedRecordIds.length} catatan presensi berhasil dihapus.`
                        );
                        setTimeout(() => setToastMessage(null), 3500);
                      }
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Terpilih</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRecordIds([])}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}

              {filteredDetailRecords.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA ${filteredDetailRecords.length} catatan presensi yang tampil pada periode "${dateRange.label}"?`
                      )
                    ) {
                      const ids = filteredDetailRecords.map((r) => r.id);
                      if (onDeleteMultipleRecords) {
                        onDeleteMultipleRecords(ids);
                      } else {
                        ids.forEach((id) => onDeleteRecord(id));
                      }
                      setSelectedRecordIds([]);
                      setToastMessage(
                        `Semua (${ids.length}) catatan pada periode ${dateRange.label} berhasil dibersihkan.`
                      );
                      setTimeout(() => setToastMessage(null), 3500);
                    }
                  }}
                  className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Hapus semua riwayat presensi yang sedang tampil sesuai filter"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hapus Semua Sesuai Filter ({filteredDetailRecords.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Tabel Konten Tab 2 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        paginatedDetailRecords.length > 0 &&
                        paginatedDetailRecords.every((r) => selectedRecordIds.includes(r.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newIds = new Set(selectedRecordIds);
                          paginatedDetailRecords.forEach((r) => newIds.add(r.id));
                          setSelectedRecordIds(Array.from(newIds));
                        } else {
                          const pageIds = new Set(paginatedDetailRecords.map((r) => r.id));
                          setSelectedRecordIds(
                            selectedRecordIds.filter((id) => !pageIds.has(id))
                          );
                        }
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      title="Pilih semua baris di halaman ini"
                    />
                  </th>
                  <th className="py-3 px-3 w-12 text-center">No</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">ID PPS</th>
                  <th className="py-3 px-4">Nama Asatidz</th>
                  <th className="py-3 px-3">DOM</th>
                  <th className="py-3 px-3">Kelas</th>
                  <th className="py-3 px-3">Majlis</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Alasan</th>
                  <th className="py-3 px-4">Keterangan</th>
                  {/* KOLOM EDIT DI TABEL RIWAYAT DETAIL */}
                  <th className="py-3 px-3 text-center">Edit</th>
                  <th className="py-3 px-3 text-center">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDetailRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-10 text-center text-slate-400">
                      Tidak ada catatan presensi pada rentang waktu atau pencarian ini.
                    </td>
                  </tr>
                ) : (
                  paginatedDetailRecords.map((rec, idx) => {
                    const rowNumber = startIdxDetail + idx + 1;
                    const isSelected = selectedRecordIds.includes(rec.id);
                    const statusBadge = {
                      Hadir: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                      Sakit: 'bg-amber-100 text-amber-800 border-amber-300',
                      Izin: 'bg-blue-100 text-blue-800 border-blue-300',
                      Alfa: 'bg-rose-100 text-rose-800 border-rose-300',
                    }[rec.status];

                    return (
                      <tr
                        key={rec.id}
                        className={`transition ${
                          isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRecordIds([...selectedRecordIds, rec.id]);
                              } else {
                                setSelectedRecordIds(
                                  selectedRecordIds.filter((id) => id !== rec.id)
                                );
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 text-center text-slate-400 font-medium">
                          {rowNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {formatIndonesianDate(rec.tanggal)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono">
                            {rec.idPps}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {rec.nama}
                          <span className="block text-[11px] font-normal text-slate-500">
                            {rec.jabatan}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            {rec.dom || '-'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                          {rec.kelas}
                        </td>
                        <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold">
                            {rec.majlis || '-'}
                          </span>
                        </td>
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

                        {/* KOLOM EDIT RECORD */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRecord(rec)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
                            title="Edit tanggal, status, atau keterangan presensi ini"
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-700" />
                            <span>Edit</span>
                          </button>
                        </td>

                        {/* KOLOM HAPUS */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Hapus catatan presensi ${rec.nama} tanggal ${rec.tanggal}?`
                                )
                              ) {
                                onDeleteRecord(rec.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
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

          {/* 3. PAGINATION DI BAWAH TABEL TAB 2 */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Info Pagination Bahasa Indonesia */}
            <div className="text-slate-600 font-medium">
              {totalItemsDetail === 0 ? (
                <span>Menampilkan 0 data</span>
              ) : (
                <span>
                  Menampilkan <strong>{startIdxDetail + 1}</strong> sampai{' '}
                  <strong>{endIdxDetail}</strong> dari <strong>{totalItemsDetail}</strong> data
                </span>
              )}
            </div>

            {/* Tombol Navigasi Pagination */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-detail-prev"
                onClick={() => setCurrentPageDetail((p) => Math.max(1, p - 1))}
                disabled={currentPageDetail <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                &lt;&lt; Sebelumnya
              </button>

              <span className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-100 text-xs font-bold text-slate-800">
                Halaman {validPageDetail} dari {totalPagesDetail}
              </span>

              <button
                type="button"
                id="btn-detail-next"
                onClick={() => setCurrentPageDetail((p) => Math.min(totalPagesDetail, p + 1))}
                disabled={currentPageDetail >= totalPagesDetail}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-slate-700 transition cursor-pointer shadow-2xs"
              >
                Selanjutnya &gt;&gt;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT DATA ASATIDZ / PESERTA                                      */}
      {/* ========================================================================= */}
      {editingPeserta && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Pencil className="h-5 w-5 text-emerald-600" />
                Edit Data Asatidz
              </h3>
              <button
                type="button"
                onClick={() => setEditingPeserta(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditPeserta} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ID PPS <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pesertaForm.idPps}
                  onChange={(e) => setPesertaForm({ ...pesertaForm, idPps: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Asatidz <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pesertaForm.nama}
                  onChange={(e) => setPesertaForm({ ...pesertaForm, nama: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  DOM (Domisili / Asal Daerah)
                </label>
                <input
                  type="text"
                  value={pesertaForm.dom}
                  onChange={(e) => setPesertaForm({ ...pesertaForm, dom: e.target.value })}
                  placeholder="Contoh: Bangkalan, Sampang, Asrama Al-Ghazali, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  4. Kelas <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pesertaForm.kelas}
                  onChange={(e) => setPesertaForm({ ...pesertaForm, kelas: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
                >
                  {TINGKAT_MAJLIS_LIST.map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  5. Majlis <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pesertaForm.majlis}
                  onChange={(e) => setPesertaForm({ ...pesertaForm, majlis: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
                >
                  {MAJLIS_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  6. Tugas / Jabatan Ngaji
                </label>
                <input
                  type="text"
                  value={pesertaForm.jabatan}
                  onChange={(e) => setPesertaForm({ ...pesertaForm, jabatan: e.target.value })}
                  placeholder="Contoh: Guru Kitab Taqrib, Mustahiq, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
                {onDeletePeserta && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Hapus data asatidz ${pesertaForm.nama} (${pesertaForm.idPps}) dari sistem?`
                        )
                      ) {
                        const p = pesertaList.find((x) => x.idPps === pesertaForm.idPps);
                        if (p) onDeletePeserta(p.id);
                        setEditingPeserta(null);
                        setToastMessage(`Data asatidz ${pesertaForm.nama} berhasil dihapus.`);
                        setTimeout(() => setToastMessage(null), 3500);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Hapus Asatidz</span>
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingPeserta(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT CATATAN PRESENSI                                            */}
      {/* ========================================================================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Pencil className="h-5 w-5 text-blue-600" />
                  Edit Catatan Presensi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingRecord.nama} ({editingRecord.idPps})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditRecord} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tanggal Presensi</label>
                <input
                  type="date"
                  required
                  value={recordForm.tanggal}
                  onChange={(e) => setRecordForm({ ...recordForm, tanggal: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Kehadiran</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Hadir', 'Sakit', 'Izin', 'Alfa'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRecordForm({ ...recordForm, status: st })}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        recordForm.status === st
                          ? st === 'Hadir'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : st === 'Sakit'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : st === 'Izin'
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {recordForm.status !== 'Hadir' && recordForm.status !== 'Alfa' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alasan</label>
                  <select
                    value={recordForm.alasan}
                    onChange={(e) =>
                      setRecordForm({ ...recordForm, alasan: e.target.value as AttendanceReason })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white cursor-pointer"
                  >
                    <option value="">Pilih Alasan...</option>
                    <option value="Sakit">Sakit</option>
                    <option value="Izin Bepergian">Izin Bepergian</option>
                    <option value="Alasan Lain">Alasan Lain</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={recordForm.keterangan}
                  onChange={(e) => setRecordForm({ ...recordForm, keterangan: e.target.value })}
                  placeholder="Catatan tambahan bila ada..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      editingRecord &&
                      confirm(
                        `Hapus catatan presensi tanggal ${editingRecord.tanggal} (${editingRecord.nama})?`
                      )
                    ) {
                      onDeleteRecord(editingRecord.id);
                      setEditingRecord(null);
                      setToastMessage(`Catatan presensi berhasil dihapus.`);
                      setTimeout(() => setToastMessage(null), 3500);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus Catatan</span>
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan Perubahan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EXPORT EXCEL OPTIONS                                             */}
      {/* ========================================================================= */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-600" />
                Export Rekap ke File Excel
              </h3>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-700 block">Kolom yang diexport:</span>
                <p className="text-slate-500 mt-1">
                  ID PPS, Nama Asatidz, DOM, Tingkat Majelis, Jabatan, Hari Aktif, Hadir, Sakit, Izin, Alfa, % Kehadiran, Detail Tanggal Izin, Detail Alasan
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
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-export"
                onClick={() => handleExport(singleExportPesertaId)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Unduh File Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INDIVIDUAL ATTENDANCE DETAIL FOR A TEACHER                       */}
      {/* ========================================================================= */}
      {selectedPesertaForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedPesertaForDetail.nama}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                    {selectedPesertaForDetail.idPps}
                  </span>
                  {selectedPesertaForDetail.dom && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                      DOM: {selectedPesertaForDetail.dom}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Kelas: {selectedPesertaForDetail.kelas} • Majlis: {selectedPesertaForDetail.majlis || '-'} • Jabatan: {selectedPesertaForDetail.jabatan}
                </p>
                <p className="text-xs text-emerald-800 font-semibold mt-1">
                  Periode: {dateRange.label}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport(selectedPesertaForDetail.idPps)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPesertaForDetail(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold p-1 text-lg cursor-pointer"
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
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded font-bold border ${statusColor}`}>
                              {r.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPesertaForDetail(null);
                                handleOpenEditRecord(r);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                              title="Edit presensi ini"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Hapus catatan presensi ${formatIndonesianDate(r.tanggal)}?`
                                  )
                                ) {
                                  onDeleteRecord(r.id);
                                  setToastMessage(`Catatan presensi berhasil dihapus.`);
                                  setTimeout(() => setToastMessage(null), 3500);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                              title="Hapus presensi ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
