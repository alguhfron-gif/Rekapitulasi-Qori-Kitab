import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

interface InputPresensiProps {
  pesertaList: Peserta[];
  records: AttendanceRecord[];
  holidays: HolidaySettings;
  onSaveRecord: (record: Omit<AttendanceRecord, 'id' | 'timestamp'>) => void;
  onDeleteRecord: (recordId: string) => void;
  onBulkMarkHadir: (tanggal: string, unrecordedPeserta: Peserta[]) => void;
}

export const InputPresensi: React.FC<InputPresensiProps> = ({
  pesertaList,
  records,
  holidays,
  onSaveRecord,
  onDeleteRecord,
  onBulkMarkHadir,
}) => {
  const [tanggal, setTanggal] = useState<string>(getTodayString());
  const [idPpsInput, setIdPpsInput] = useState<string>('');
  const [matchedPeserta, setMatchedPeserta] = useState<Peserta | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>('Hadir');
  const [alasan, setAlasan] = useState<AttendanceReason>('Sakit');
  const [keterangan, setKeterangan] = useState<string>('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showPickerModal, setShowPickerModal] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');

  const idInputRef = useRef<HTMLInputElement>(null);

  // Check holiday for selected date
  const holidayCheck = checkIsHoliday(tanggal, holidays);

  // Filter records for selected date
  const recordsOnDate = records.filter((r) => r.tanggal === tanggal);

  // Match peserta when idPpsInput changes
  useEffect(() => {
    const query = idPpsInput.trim().toLowerCase();
    if (!query) {
      setMatchedPeserta(null);
      return;
    }

    // Exact match or ID match
    const found = pesertaList.find(
      (p) =>
        p.idPps.toLowerCase() === query ||
        p.idPps.toLowerCase().replace(/[^a-z0-9]/g, '') === query.replace(/[^a-z0-9]/g, '')
    );

    if (found) {
      setMatchedPeserta(found);
      // Check if this peserta already has a record on this date
      const existing = recordsOnDate.find((r) => r.idPps === found.idPps);
      if (existing) {
        setStatus(existing.status);
        if (existing.alasan) setAlasan(existing.alasan);
        if (existing.keterangan) setKeterangan(existing.keterangan);
      }
    } else {
      setMatchedPeserta(null);
    }
  }, [idPpsInput, pesertaList, recordsOnDate]);

  // Handle enter key press on ID PPS input
  const handleIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (matchedPeserta) {
        // If matched and status is Hadir, can save directly
        handleSubmit();
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!matchedPeserta) {
      alert('Mohon pilih atau masukkan ID PPS asatidz yang terdaftar terlebih dahulu.');
      return;
    }

    const payload: Omit<AttendanceRecord, 'id' | 'timestamp'> = {
      tanggal,
      idPps: matchedPeserta.idPps,
      nama: matchedPeserta.nama,
      kelas: matchedPeserta.kelas,
      jabatan: matchedPeserta.jabatan,
      status,
      alasan: status !== 'Hadir' ? alasan : undefined,
      keterangan: status !== 'Hadir' ? keterangan.trim() : undefined,
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

    // Refocus ID PPS input
    if (idInputRef.current) {
      idInputRef.current.focus();
    }
  };

  // Unrecorded participants on this date
  const recordedIdPpsSet = new Set(recordsOnDate.map((r) => r.idPps));
  const unrecordedPeserta = pesertaList.filter((p) => !recordedIdPpsSet.has(p.idPps));

  // Quick stats on this date
  const hadirCount = recordsOnDate.filter((r) => r.status === 'Hadir').length;
  const sakitCount = recordsOnDate.filter((r) => r.status === 'Sakit').length;
  const izinCount = recordsOnDate.filter((r) => r.status === 'Izin').length;
  const alfaCount = recordsOnDate.filter((r) => r.status === 'Alfa').length;

  // Attendance rate on date
  const attendanceRate = recordsOnDate.length > 0
    ? ((hadirCount / recordsOnDate.length) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Top Stat Cards matching Sleek Interface */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 shrink-0">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Total Peserta</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{pesertaList.length}</p>
          <p className="text-xs text-blue-500 mt-2 font-medium">Asatidz MTK terdaftar</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Tercatat Hari Ini</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900">{recordsOnDate.length}</p>
          <p className="text-xs text-slate-500 mt-2">
            Sisa: <span className="font-semibold text-slate-700">{unrecordedPeserta.length}</span> asatidz
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Hadir Hari Ini</p>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{hadirCount}</p>
          <p className="text-xs text-slate-500 mt-2">Capaian: {attendanceRate}%</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
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
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-amber-800 uppercase tracking-wide">
                Peringatan: Ini Hari Libur
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200/80 text-amber-900 border border-amber-300">
                {holidayCheck.reason}
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Tanggal {formatIndonesianDate(tanggal)} terdaftar sebagai hari libur (
              {holidayCheck.type === 'rutin' ? 'Libur Rutin' : 'Libur Khusus'}). Presensi tetap dapat
              diinput jika ada jadwal pengajian/musyawarah tambahan.
            </p>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in border border-emerald-400">
          <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
          <span className="text-sm font-medium">{successToast}</span>
        </div>
      )}

      {/* Main Grid: Form on Left, Today's List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Input Presensi Cepat</h3>
                <p className="text-xs text-slate-500 mt-0.5">Masukkan ID PPS untuk input instan</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPickerModal(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition"
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

              {/* 2. ID PPS Input & Lookup */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  ID PPS
                </label>
                <div className="relative">
                  <input
                    ref={idInputRef}
                    type="text"
                    id="input-id-pps"
                    placeholder="Contoh: PPS-001 lalu tekan Enter"
                    value={idPpsInput}
                    onChange={(e) => setIdPpsInput(e.target.value)}
                    onKeyDown={handleIdKeyDown}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-lg font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none uppercase transition"
                    autoFocus
                  />
                  {matchedPeserta && (
                    <span className="absolute right-3 top-3 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Terdaftar
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tips: Masukkan ID lalu tekan <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono">Enter</kbd> untuk simpan instan.
                </p>
              </div>

              {/* Matched Participant Card */}
              {matchedPeserta ? (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-1">
                  <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Detail Peserta</p>
                  <p className="font-bold text-slate-800 text-lg leading-tight">{matchedPeserta.nama}</p>
                  <p className="text-sm text-slate-600">
                    {matchedPeserta.kelas} • {matchedPeserta.jabatan}
                  </p>
                </div>
              ) : idPpsInput.trim() !== '' ? (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                  <span>ID PPS &quot;{idPpsInput}&quot; belum terdaftar di Master Data.</span>
                  <button
                    type="button"
                    onClick={() => setShowPickerModal(true)}
                    className="font-semibold underline ml-2 shrink-0"
                  >
                    Buka Daftar
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
                        className={`py-2 px-3 rounded-lg font-bold text-sm transition text-center ${
                          isSelected
                            ? st === 'Hadir'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : st === 'Sakit'
                              ? 'bg-amber-500 text-white shadow-sm'
                              : st === 'Izin'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-rose-600 text-white shadow-sm'
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
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-fade-in">
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
                className={`w-full py-3.5 sm:py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-lg ${
                  matchedPeserta
                    ? 'bg-slate-900 text-white hover:bg-black shadow-slate-300 active:scale-[0.99]'
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Presensi Terdata ({tanggal})</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {recordsOnDate.length} dari {pesertaList.length} asatidz tercatat
                </p>
              </div>

              {/* Bulk mark remaining as Hadir */}
              {unrecordedPeserta.length > 0 && (
                <button
                  type="button"
                  id="btn-bulk-hadir"
                  onClick={() => {
                    if (
                      confirm(
                        `Tandai sisa ${unrecordedPeserta.length} asatidz yang belum tercatat sebagai "Hadir" pada tanggal ${tanggal}?`
                      )
                    ) {
                      onBulkMarkHadir(tanggal, unrecordedPeserta);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5 transition"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  Tandai Sisa ({unrecordedPeserta.length}) Hadir
                </button>
              )}
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
                  {recordsOnDate.map((rec) => {
                    const statusBadge = {
                      Hadir: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      Sakit: 'bg-amber-50 text-amber-700 border-amber-200',
                      Izin: 'bg-blue-50 text-blue-700 border-blue-200',
                      Alfa: 'bg-rose-50 text-rose-700 border-rose-200',
                    }[rec.status];

                    return (
                      <div
                        key={rec.id}
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
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{rec.kelas}</span>
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
                              if (confirm(`Hapus catatan presensi untuk ${rec.nama}?`)) {
                                onDeleteRecord(rec.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
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
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
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
              {pesertaList
                .filter(
                  (p) =>
                    p.nama.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    p.idPps.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    p.kelas.toLowerCase().includes(modalSearch.toLowerCase())
                )
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setIdPpsInput(p.idPps);
                      setMatchedPeserta(p);
                      setShowPickerModal(false);
                      if (idInputRef.current) idInputRef.current.focus();
                    }}
                    className="w-full text-left p-3 hover:bg-emerald-50/60 rounded-xl transition flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{p.nama}</span>
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-800">
                          {p.idPps}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {p.kelas} • {p.jabatan}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                      Pilih
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
