import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Peserta,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceReason,
  HolidaySettings,
} from '../types';
import { checkIsHoliday, formatIndonesianDate, getTodayString } from '../utils/dateHelper';
import {
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Search,
  UserCheck,
  Clock,
  Trash2,
  Save,
  HelpCircle,
  Users,
  CheckSquare,
  X,
  Sparkles,
  ChevronDown,
  Check,
} from 'lucide-react';

interface InputPresensiProps {
  pesertaList: Peserta[];
  records: AttendanceRecord[];
  holidays: HolidaySettings;
  onSaveRecord: (record: Omit<AttendanceRecord, 'id' | 'timestamp'>) => void;
  onDeleteRecord: (recordId: string) => void;
  onDeleteAllRecordsOnDate?: (tanggal: string) => void;
  onBulkMarkHadir: (tanggal: string, unrecordedPeserta: Peserta[]) => void;
}

interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'primary' | 'success';
  onConfirm: () => void;
}

export const InputPresensi: React.FC<InputPresensiProps> = ({
  pesertaList = [],
  records = [],
  holidays,
  onSaveRecord,
  onDeleteRecord,
  onDeleteAllRecordsOnDate,
  onBulkMarkHadir,
}) => {
  const [tanggal, setTanggal] = useState<string>(() => {
    try {
      return getTodayString();
    } catch {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
  });

  const [idPpsInput, setIdPpsInput] = useState<string>('');
  const [matchedPeserta, setMatchedPeserta] = useState<Peserta | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>('Hadir');
  const [alasan, setAlasan] = useState<AttendanceReason>('Sakit');
  const [keterangan, setKeterangan] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [showPickerModal, setShowPickerModal] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  // In-app safe confirmation dialog state (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    variant: 'danger',
    onConfirm: () => {},
  });

  const idInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Safely check holiday for selected date
  const holidayCheck = useMemo(() => {
    try {
      return checkIsHoliday(tanggal, holidays) || { isHoliday: false };
    } catch {
      return { isHoliday: false };
    }
  }, [tanggal, holidays]);

  // Safe records array for selected date
  const recordsOnDate = useMemo(() => {
    if (!Array.isArray(records)) return [];
    return records.filter((r) => r && r.tanggal === tanggal);
  }, [records, tanggal]);

  // Safe list of peserta with all 6 columns guaranteed to be valid strings
  const safePesertaList = useMemo(() => {
    if (!Array.isArray(pesertaList)) return [];
    return pesertaList
      .filter((p): p is Peserta => Boolean(p && typeof p === 'object'))
      .map((p, idx) => ({
        id: p.id || `peserta-${p.idPps || idx}`,
        idPps: String(p.idPps || '').trim(),
        nama: String(p.nama || 'Tanpa Nama').trim(),
        dom: String(p.dom || '-').trim(),
        kelas: String(p.kelas || '-').trim(),
        majlis: String(p.majlis || 'Majlis Utama').trim(),
        jabatan: String(p.jabatan || '-').trim(),
      }));
  }, [pesertaList]);

  // Filter smart suggestions based on ID, Nama, Kelas, Majlis, DOM, Jabatan
  const suggestions = useMemo(() => {
    try {
      const q = (idPpsInput || '').trim().toLowerCase();
      if (!q || matchedPeserta) return [];

      const cleanQ = q.replace(/[^a-z0-9]/g, '');

      return safePesertaList
        .filter((p) => {
          if (!p) return false;
          const idStr = p.idPps.toLowerCase();
          const cleanId = idStr.replace(/[^a-z0-9]/g, '');
          const matchId = idStr.includes(q) || (cleanQ.length > 0 && cleanId.includes(cleanQ));
          const matchNama = p.nama.toLowerCase().includes(q);
          const matchKelas = p.kelas.toLowerCase().includes(q);
          const matchMajlis = p.majlis.toLowerCase().includes(q);
          const matchDom = p.dom.toLowerCase().includes(q);
          const matchJabatan = p.jabatan.toLowerCase().includes(q);

          return matchId || matchNama || matchKelas || matchMajlis || matchDom || matchJabatan;
        })
        .slice(0, 8); // Top 8 matching asatidz
    } catch (err) {
      console.error('Error computing suggestions:', err);
      return [];
    }
  }, [idPpsInput, safePesertaList, matchedPeserta]);

  // Safe check existing record for a participant on selected date
  const getExistingRecord = (pIdPps: string | undefined): AttendanceRecord | undefined => {
    if (!pIdPps) return undefined;
    const target = String(pIdPps).toLowerCase().trim();
    return recordsOnDate.find((r) => r && String(r.idPps || '').toLowerCase().trim() === target);
  };

  // Select participant and populate details
  const selectPeserta = (p: Peserta) => {
    try {
      if (!p) return;
      setMatchedPeserta(p);
      setIdPpsInput(`${p.nama || 'Tanpa Nama'} (${p.idPps || '-'})`);
      setShowSuggestions(false);
      setHighlightedIndex(0);

      const existing = getExistingRecord(p.idPps);
      if (existing) {
        setStatus(existing.status || 'Hadir');
        if (existing.alasan) setAlasan(existing.alasan);
        if (existing.keterangan) setKeterangan(existing.keterangan);
      } else {
        setStatus('Hadir');
        setAlasan('Sakit');
        setKeterangan('');
      }
    } catch (err) {
      console.error('Error selecting peserta:', err);
    }
  };

  // Clear matched participant to call another
  const handleClearSelection = () => {
    try {
      setMatchedPeserta(null);
      setIdPpsInput('');
      setStatus('Hadir');
      setAlasan('Sakit');
      setKeterangan('');
      setShowSuggestions(false);
      if (idInputRef.current) {
        idInputRef.current.focus();
      }
    } catch (err) {
      console.error('Error clearing selection:', err);
    }
  };

  // Auto-detect exact match when typing ID or unique match
  useEffect(() => {
    try {
      const query = (idPpsInput || '').trim().toLowerCase();
      if (!query || matchedPeserta) return;

      const cleanQuery = query.replace(/[^a-z0-9]/g, '');
      if (cleanQuery.length === 0) return;

      // Exact ID PPS match (e.g., from scanner or exact typing)
      const exactIdMatch = safePesertaList.find((p) => {
        if (!p || !p.idPps) return false;
        const idStr = p.idPps.toLowerCase().trim();
        const cleanId = idStr.replace(/[^a-z0-9]/g, '');
        return idStr === query || (cleanQuery.length >= 2 && cleanId === cleanQuery);
      });

      if (exactIdMatch) {
        selectPeserta(exactIdMatch);
      }
    } catch (err) {
      console.error('Error in auto-detect ID match:', err);
    }
  }, [idPpsInput, safePesertaList, matchedPeserta]);

  // Handle keyboard events (ArrowUp, ArrowDown, Enter, Escape)
  const handleIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = suggestions[highlightedIndex] || suggestions[0];
        if (selected) {
          selectPeserta(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchedPeserta) {
        handleSubmit();
      } else if (suggestions.length === 1) {
        selectPeserta(suggestions[0]);
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!matchedPeserta) {
      setErrorToast('Mohon pilih atau panggil asatidz yang terdaftar terlebih dahulu.');
      setTimeout(() => setErrorToast(null), 3500);
      return;
    }

    try {
      const payload: Omit<AttendanceRecord, 'id' | 'timestamp'> = {
        tanggal,
        idPps: matchedPeserta.idPps || '',
        nama: matchedPeserta.nama || '',
        dom: matchedPeserta.dom || '-',
        kelas: matchedPeserta.kelas || '',
        majlis: matchedPeserta.majlis || 'Majlis Utama',
        jabatan: matchedPeserta.jabatan || '',
        status: status || 'Hadir',
        alasan: status !== 'Hadir' ? alasan : undefined,
        keterangan: status !== 'Hadir' ? (keterangan || '').trim() : undefined,
      };

      onSaveRecord(payload);

      // Toast notification
      setSuccessToast(`Presensi ${matchedPeserta.nama} (${status}) tersimpan.`);
      setTimeout(() => setSuccessToast(null), 3000);

      // Reset input for fast continuous typing
      setIdPpsInput('');
      setMatchedPeserta(null);
      setStatus('Hadir');
      setAlasan('Sakit');
      setKeterangan('');
      setShowSuggestions(false);

      // Refocus ID PPS input
      if (idInputRef.current) {
        idInputRef.current.focus();
      }
    } catch (err) {
      console.error('Submit error:', err);
      setErrorToast('Terjadi kesalahan saat menyimpan presensi.');
      setTimeout(() => setErrorToast(null), 3500);
    }
  };

  // Unrecorded participants on this date
  const recordedIdPpsSet = useMemo(() => {
    return new Set(
      recordsOnDate
        .map((r) => (r && r.idPps ? String(r.idPps).toLowerCase().trim() : ''))
        .filter(Boolean)
    );
  }, [recordsOnDate]);

  const unrecordedPeserta = useMemo(() => {
    return safePesertaList.filter(
      (p) => p && !recordedIdPpsSet.has(String(p.idPps || '').toLowerCase().trim())
    );
  }, [safePesertaList, recordedIdPpsSet]);

  // Quick stats on this date
  const hadirCount = recordsOnDate.filter((r) => r && r.status === 'Hadir').length;
  const sakitCount = recordsOnDate.filter((r) => r && r.status === 'Sakit').length;
  const izinCount = recordsOnDate.filter((r) => r && r.status === 'Izin').length;
  const alfaCount = recordsOnDate.filter((r) => r && r.status === 'Alfa').length;

  // Attendance rate on date
  const attendanceRate =
    recordsOnDate.length > 0 ? ((hadirCount / recordsOnDate.length) * 100).toFixed(1) : '0.0';

  // Formatted date string for display
  const formattedSelectedDate = useMemo(() => {
    try {
      return formatIndonesianDate(tanggal);
    } catch {
      return tanggal;
    }
  }, [tanggal]);

  // Filtered list for Quick Pick Modal
  const modalFilteredPeserta = useMemo(() => {
    const s = (modalSearch || '').trim().toLowerCase();
    if (!s) return safePesertaList;
    return safePesertaList.filter((p) => {
      if (!p) return false;
      return (
        String(p.nama || '').toLowerCase().includes(s) ||
        String(p.idPps || '').toLowerCase().includes(s) ||
        String(p.kelas || '').toLowerCase().includes(s) ||
        (p.majlis && String(p.majlis).toLowerCase().includes(s)) ||
        (p.dom && String(p.dom).toLowerCase().includes(s)) ||
        (p.jabatan && String(p.jabatan).toLowerCase().includes(s))
      );
    });
  }, [safePesertaList, modalSearch]);

  return (
    <div className="space-y-6">
      {/* Top Stat Cards matching Sleek Interface */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 shrink-0">
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Total Peserta</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{safePesertaList.length}</p>
          <p className="text-xs text-blue-500 mt-2 font-medium">Asatidz MTK terdaftar</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Tercatat Hari Ini</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{recordsOnDate.length}</p>
          <p className="text-xs text-slate-500 mt-2">
            Sisa: <span className="font-semibold text-slate-700">{unrecordedPeserta.length}</span> asatidz
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Hadir Hari Ini</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{hadirCount}</p>
          <p className="text-xs text-slate-500 mt-2">Capaian: {attendanceRate}%</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Izin / Sakit / Alfa</p>
          <p className="text-2xl sm:text-3xl font-bold text-rose-500">{sakitCount + izinCount + alfaCount}</p>
          <p className="text-xs text-rose-400 mt-2 font-medium">
            {sakitCount} Sakit • {izinCount} Izin • {alfaCount} Alfa
          </p>
        </div>
      </div>

      {/* Top Banner / Holiday Alert */}
      {holidayCheck.isHoliday && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 shadow-2xs">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-800 uppercase tracking-wide">
                Peringatan: Ini Hari Libur
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                {holidayCheck.reason || 'Libur MTK'}
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Tanggal {formattedSelectedDate} terdaftar sebagai hari libur (
              {holidayCheck.type === 'rutin' ? 'Libur Rutin' : 'Libur Khusus'}). Presensi tetap dapat
              diinput jika ada jadwal pengajian/musyawarah tambahan.
            </p>
          </div>
        </div>
      )}

      {/* Notification Toast Messages */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-emerald-400 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
          <span className="text-sm font-medium">{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-rose-400 animate-fade-in">
          <AlertTriangle className="h-5 w-5 text-white shrink-0" />
          <span className="text-sm font-medium">{errorToast}</span>
        </div>
      )}

      {/* Main Grid: Form on Left, Today's List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Input Presensi Cepat</h3>
                <p className="text-xs text-slate-500 mt-0.5">Ketik ID PPS atau nama untuk input instan</p>
              </div>
              <button
                type="button"
                id="btn-open-picker-modal"
                onClick={() => setShowPickerModal(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition cursor-pointer"
              >
                <Users className="h-3.5 w-3.5" />
                Daftar Asatidz
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1">
              {/* 1. Tanggal Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Tanggal Presensi
                </label>
                <input
                  type="date"
                  id="input-tanggal-presensi"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition"
                  required
                />
              </div>

              {/* 2. ID PPS / Nama / Kelas / Majlis / Domisili Input & Auto-Lookup */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Panggil Asatidz (ID / Nama / Kelas / Majlis)
                  </label>
                  {matchedPeserta && (
                    <button
                      type="button"
                      id="btn-clear-selection"
                      onClick={handleClearSelection}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Ganti / Panggil Lain
                    </button>
                  )}
                </div>

                <div className="relative">
                  <div className="relative flex items-center">
                    <input
                      ref={idInputRef}
                      type="text"
                      id="input-id-pps"
                      placeholder="Ketik ID, Nama, Kelas, Majlis, atau Domisili..."
                      value={idPpsInput}
                      onChange={(e) => {
                        setIdPpsInput(e.target.value);
                        if (!matchedPeserta) {
                          setShowSuggestions(true);
                          setHighlightedIndex(0);
                        }
                      }}
                      onFocus={() => {
                        if (!matchedPeserta && idPpsInput.trim()) {
                          setShowSuggestions(true);
                        }
                      }}
                      onKeyDown={handleIdKeyDown}
                      className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-base text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition pr-10 ${
                        matchedPeserta
                          ? 'border-emerald-400 bg-emerald-50/30 font-semibold'
                          : 'border-slate-200'
                      }`}
                      autoFocus
                    />
                    {idPpsInput && (
                      <button
                        type="button"
                        id="btn-clear-input-text"
                        onClick={handleClearSelection}
                        className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                        title="Bersihkan input"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Suggestions List */}
                  {showSuggestions && suggestions.length > 0 && !matchedPeserta && (
                    <div
                      ref={suggestionsRef}
                      className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto"
                    >
                      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Ditemukan {suggestions.length} Asatidz:</span>
                        <span className="text-[10px] text-slate-400">Tekan Enter atau klik untuk pilih</span>
                      </div>
                      {suggestions.map((p, idx) => {
                        const isHighlighted = idx === highlightedIndex;
                        const existingRec = getExistingRecord(p?.idPps);
                        return (
                          <button
                            key={p?.id || idx}
                            type="button"
                            onClick={() => selectPeserta(p)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            className={`w-full text-left p-3 flex items-center justify-between gap-2 transition cursor-pointer ${
                              isHighlighted ? 'bg-emerald-50/80 text-emerald-950' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-slate-900">{p?.nama}</span>
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {p?.idPps}
                                </span>
                                {p?.dom && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    DOM: {p.dom}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700">Kelas: {p?.kelas}</span>
                                <span>•</span>
                                <span className="text-purple-700 font-medium">Majlis: {p?.majlis || '-'}</span>
                                <span>•</span>
                                <span className="text-slate-500">{p?.jabatan || '-'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {existingRec ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  {existingRec.status}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Panggil
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!matchedPeserta && (
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Tips: Cukup ketik nama (misal: <em>Ahmad</em>), ID (misal: <em>PPS-001</em>), kelas, atau majlis, sistem otomatis memanggil.
                  </p>
                )}
              </div>

              {/* Matched Participant Card (6 Kolom Lengkap Terpanggil) */}
              {matchedPeserta ? (
                <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-4 rounded-xl border border-emerald-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Asatidz Terpanggil
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Batal
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        2. NAMA ASATIDZ
                      </span>
                      <p className="font-extrabold text-slate-900 text-lg leading-tight">
                        {matchedPeserta.nama || 'Tanpa Nama'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                        1. ID PPS
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-emerald-700 text-white text-xs font-mono font-bold tracking-wide inline-block shadow-2xs">
                        {matchedPeserta.idPps || '-'}
                      </span>
                    </div>
                  </div>

                  {/* 6 Kolom Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-emerald-200/60 text-xs">
                    <div className="bg-white/70 p-2 rounded-lg border border-emerald-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">3. DOM</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {matchedPeserta.dom || '-'}
                      </span>
                    </div>
                    <div className="bg-white/70 p-2 rounded-lg border border-emerald-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">4. KELAS</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {matchedPeserta.kelas || '-'}
                      </span>
                    </div>
                    <div className="bg-white/70 p-2 rounded-lg border border-emerald-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">5. MAJLIS</span>
                      <span className="font-semibold text-purple-800 truncate block">
                        {matchedPeserta.majlis || '-'}
                      </span>
                    </div>
                    <div className="bg-white/70 p-2 rounded-lg border border-emerald-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">6. JABATAN</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {matchedPeserta.jabatan || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Info if already recorded today */}
                  {getExistingRecord(matchedPeserta.idPps) && (
                    <div className="text-xs bg-amber-100/80 border border-amber-300 text-amber-900 p-2 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>
                        Asatidz ini sudah tercatat hari ini (Status: <strong>{getExistingRecord(matchedPeserta.idPps)?.status}</strong>). Anda dapat memperbarui statusnya.
                      </span>
                    </div>
                  )}
                </div>
              ) : idPpsInput.trim() !== '' && suggestions.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                  <span>Tidak ditemukan data dengan kata kunci &quot;{idPpsInput}&quot;.</span>
                  <button
                    type="button"
                    onClick={() => setShowPickerModal(true)}
                    className="font-bold underline ml-2 shrink-0 text-rose-900 cursor-pointer"
                  >
                    Buka Daftar Asatidz
                  </button>
                </div>
              ) : null}

              {/* 3. Status Presensi Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Hadir', 'Sakit', 'Izin', 'Alfa'] as AttendanceStatus[]).map((st) => {
                    const isSelected = status === st;
                    return (
                      <button
                        type="button"
                        key={st}
                        id={`btn-status-${st.toLowerCase()}`}
                        onClick={() => setStatus(st)}
                        className={`py-2 px-3 rounded-lg font-bold text-sm transition text-center cursor-pointer ${
                          isSelected
                            ? st === 'Hadir'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : st === 'Sakit'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : st === 'Izin'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Alasan & Keterangan when Sakit/Izin/Alfa */}
              {status !== 'Hadir' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Alasan:
                    </label>
                    <select
                      id="select-alasan"
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value as AttendanceReason)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Sakit">Sakit</option>
                      <option value="Izin Bepergian">Izin Bepergian</option>
                      <option value="Alasan Lain">Alasan Lain</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                      Keterangan:
                    </label>
                    <input
                      type="text"
                      id="input-keterangan"
                      placeholder="Contoh: Sakit demam, tugas dakwah..."
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Submit Button matching Sleek Interface */}
              <button
                type="submit"
                id="btn-simpan-presensi"
                disabled={!matchedPeserta}
                className={`w-full py-3.5 sm:py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-md ${
                  matchedPeserta
                    ? 'bg-slate-900 text-white hover:bg-black shadow-slate-300 active:scale-[0.99] cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                SIMPAN PRESENSI
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Attendance on this date */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Presensi Terdata ({tanggal})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {recordsOnDate.length} dari {safePesertaList.length} asatidz tercatat
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Hapus Semua Presensi Hari Ini */}
                {recordsOnDate.length > 0 && onDeleteAllRecordsOnDate && (
                  <button
                    type="button"
                    id="btn-delete-all-today"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Hapus Seluruh Presensi Tanggal Ini?',
                        message: `Apakah Anda yakin ingin menghapus SEMUA catatan presensi (${recordsOnDate.length} asatidz) pada tanggal ${tanggal}? Tindakan ini akan mengosongkan presensi pada tanggal ini.`,
                        confirmLabel: 'Ya, Hapus Semua',
                        variant: 'danger',
                        onConfirm: () => {
                          onDeleteAllRecordsOnDate(tanggal);
                          setSuccessToast('Semua presensi tanggal ini telah dihapus.');
                          setTimeout(() => setSuccessToast(null), 3000);
                        },
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 flex items-center gap-1.5 transition cursor-pointer"
                    title="Hapus seluruh presensi tanggal ini"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    <span>Hapus Hari Ini ({recordsOnDate.length})</span>
                  </button>
                )}

                {/* Bulk mark remaining as Hadir */}
                {unrecordedPeserta.length > 0 && (
                  <button
                    type="button"
                    id="btn-bulk-hadir"
                    onClick={() => {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Tandai Sisa Asatidz Hadir?',
                        message: `Tandai sisa ${unrecordedPeserta.length} asatidz yang belum tercatat sebagai "Hadir" pada tanggal ${tanggal}?`,
                        confirmLabel: 'Tandai Hadir',
                        variant: 'success',
                        onConfirm: () => {
                          onBulkMarkHadir(tanggal, unrecordedPeserta);
                          setSuccessToast(`${unrecordedPeserta.length} asatidz berhasil ditandai Hadir.`);
                          setTimeout(() => setSuccessToast(null), 3000);
                        },
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Tandai Sisa ({unrecordedPeserta.length}) Hadir
                  </button>
                )}
              </div>
            </div>

            {/* List Table */}
            <div className="p-0 flex-1 overflow-y-auto max-h-[480px]">
              {recordsOnDate.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <HelpCircle className="h-10 w-10 mx-auto text-slate-300 stroke-1" />
                  <p className="text-sm font-semibold text-slate-600">
                    Belum ada presensi yang dicatat pada tanggal ini.
                  </p>
                  <p className="text-xs text-slate-400">
                    Gunakan form di samping untuk mulai mencatat presensi asatidz.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recordsOnDate.map((rec, rIdx) => {
                    const statusBadge =
                      (rec?.status && {
                        Hadir: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        Sakit: 'bg-amber-50 text-amber-700 border-amber-200',
                        Izin: 'bg-blue-50 text-blue-700 border-blue-200',
                        Alfa: 'bg-rose-50 text-rose-700 border-rose-200',
                      }[rec.status]) || 'bg-slate-50 text-slate-700 border-slate-200';

                    return (
                      <div
                        key={rec?.id || `rec-date-${rIdx}`}
                        className="p-4 hover:bg-slate-50/80 flex items-center justify-between gap-3 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {rec.nama}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {rec.idPps}
                            </span>
                            {rec.dom && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                DOM: {rec.dom}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{rec.kelas}</span>
                            <span>•</span>
                            <span className="text-purple-700 font-medium">Majlis: {rec.majlis}</span>
                            <span>•</span>
                            <span>{rec.jabatan}</span>
                          </div>
                          {(rec.alasan || rec.keterangan) && (
                            <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded mt-1 border border-amber-200/60 inline-block font-medium">
                              <strong>{rec.alasan}</strong>
                              {rec.keterangan ? `: ${rec.keterangan}` : ''}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${statusBadge}`}
                          >
                            {rec.status}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Hapus Catatan Presensi?',
                                message: `Hapus catatan presensi untuk ${rec.nama}?`,
                                confirmLabel: 'Hapus',
                                variant: 'danger',
                                onConfirm: () => {
                                  onDeleteRecord(rec.id);
                                  setSuccessToast(`Presensi ${rec.nama} dihapus.`);
                                  setTimeout(() => setSuccessToast(null), 3000);
                                },
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus presensi"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom Footer Summary */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Ringkasan Hari Ini:</span>
              <div className="flex items-center space-x-3 text-xs">
                <span>Hadir: <strong className="text-emerald-700">{hadirCount}</strong></span>
                <span>Sakit: <strong className="text-amber-700">{sakitCount}</strong></span>
                <span>Izin: <strong className="text-blue-700">{izinCount}</strong></span>
                <span>Alfa: <strong className="text-rose-700">{alfaCount}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Quick Pick Asatidz */}
      {showPickerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Pilih Asatidz dari Master Data</h3>
                <p className="text-xs text-slate-500">Klik nama untuk mengisi form input secara otomatis</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, ID PPS, atau kelas..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
              {modalFilteredPeserta.map((p, pIdx) => (
                <button
                  key={p.id || p.idPps || `modal-p-${pIdx}`}
                  type="button"
                  onClick={() => {
                    selectPeserta(p);
                    setShowPickerModal(false);
                    if (idInputRef.current) idInputRef.current.focus();
                  }}
                  className="w-full text-left p-3 hover:bg-emerald-50/60 rounded-xl transition flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{p.nama}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">
                        {p.idPps}
                      </span>
                      {p.dom && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                          DOM: {p.dom}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {p.kelas} • Majlis: {p.majlis} • {p.jabatan}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                    Pilih
                  </span>
                </button>
              ))}
              {modalFilteredPeserta.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Tidak ditemukan asatidz yang cocok dengan pencarian.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safe In-App Confirmation Modal (Replaces browser confirm) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {confirmDialog.variant === 'danger' ? (
                  <Trash2 className="w-5 h-5" />
                ) : (
                  <CheckSquare className="w-5 h-5" />
                )}
              </div>
              <h4 className="font-bold text-slate-900 text-base">{confirmDialog.title}</h4>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  action();
                }}
                className={`px-4 py-2 text-sm font-bold text-white rounded-xl shadow-xs transition cursor-pointer ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
