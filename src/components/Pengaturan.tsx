import React, { useState, useMemo } from 'react';
import { HolidaySettings, MonthlyActiveDays, SpecialHoliday } from '../types';
import {
  HIJRI_MONTHS,
  formatHijriFull,
  formatHijriShort,
  getHijriDateDetails,
  getHijriMonthCalendar,
  getTodayString,
} from '../utils/dateHelper';
import {
  Settings,
  Calendar,
  CalendarOff,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  RotateCcw,
  Clock,
  Info,
  Smartphone,
  Wifi,
  QrCode,
  Sparkles,
  Calculator,
  Cloud,
  RefreshCw,
} from 'lucide-react';

interface PengaturanProps {
  holidays: HolidaySettings;
  activeDays: MonthlyActiveDays;
  onSaveHolidays: (holidays: HolidaySettings) => void;
  onSaveActiveDays: (activeDays: MonthlyActiveDays) => void;
  onResetData: () => void;
  onOpenSyncModal?: () => void;
  syncStatus?: 'synced' | 'syncing' | 'offline';
  onSyncAllToFirebase?: () => Promise<void>;
  isSyncingAll?: boolean;
}

export const Pengaturan: React.FC<PengaturanProps> = ({
  holidays,
  activeDays,
  onSaveHolidays,
  onSaveActiveDays,
  onResetData,
  onOpenSyncModal,
  syncStatus = 'synced',
  onSyncAllToFirebase,
  isSyncingAll = false,
}) => {
  const todayDetails = getHijriDateDetails(getTodayString());

  // Hijri Month & Year State
  const [selectedHijriYear, setSelectedHijriYear] = useState<number>(todayDetails.hYear);
  const [selectedHijriMonth, setSelectedHijriMonth] = useState<number>(todayDetails.hMonth);

  const hijriKey = `${selectedHijriYear}-${String(selectedHijriMonth).padStart(2, '0')}`;

  // Automatic calendar calculation
  const autoCalendar = useMemo(() => {
    return getHijriMonthCalendar(selectedHijriYear, selectedHijriMonth, holidays.specialHolidays);
  }, [selectedHijriYear, selectedHijriMonth, holidays.specialHolidays]);

  // Input days count: defaults to auto-calculated active days count or stored override
  const [daysCountInput, setDaysCountInput] = useState<number>(
    activeDays[hijriKey] ?? autoCalendar.activeDaysCount
  );

  // Holiday special date form state
  const [holidayDate, setHolidayDate] = useState<string>(getTodayString());
  const [holidayDesc, setHolidayDesc] = useState<string>('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Update input when Hijri month or year changes
  const handleHijriMonthYearChange = (m: number, y: number) => {
    setSelectedHijriMonth(m);
    setSelectedHijriYear(y);
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const cal = getHijriMonthCalendar(y, m, holidays.specialHolidays);
    setDaysCountInput(activeDays[key] ?? cal.activeDaysCount);
  };

  // Save active days
  const handleSaveActiveDays = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...activeDays,
      [hijriKey]: Number(daysCountInput),
    };
    onSaveActiveDays(updated);
    showToast(
      `Hari aktif untuk ${autoCalendar.monthName} ${selectedHijriYear} H disimpan: ${daysCountInput} hari.`
    );
  };

  // Quick apply auto active days
  const handleApplyAutoDays = () => {
    setDaysCountInput(autoCalendar.activeDaysCount);
    const updated = {
      ...activeDays,
      [hijriKey]: autoCalendar.activeDaysCount,
    };
    onSaveActiveDays(updated);
    showToast(
      `Hitungan otomatis diterapkan untuk ${autoCalendar.monthName} ${selectedHijriYear} H: ${autoCalendar.activeDaysCount} hari aktif.`
    );
  };

  // Toggle routine holidays
  const handleToggleRoutine = (key: 'routineSeninMalam' | 'routineKamisMalam') => {
    const updated = {
      ...holidays,
      [key]: !holidays[key],
    };
    onSaveHolidays(updated);
    showToast('Pengaturan libur rutin berhasil diperbarui.');
  };

  // Add special holiday
  const handleAddSpecialHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayDesc.trim()) {
      alert('Mohon isi tanggal dan keterangan libur.');
      return;
    }

    const newHoliday: SpecialHoliday = {
      id: `hol-${Date.now()}`,
      tanggal: holidayDate,
      keterangan: holidayDesc.trim(),
    };

    const updated: HolidaySettings = {
      ...holidays,
      specialHolidays: [...holidays.specialHolidays, newHoliday].sort((a, b) =>
        a.tanggal.localeCompare(b.tanggal)
      ),
    };

    onSaveHolidays(updated);
    const hDetails = getHijriDateDetails(holidayDate);
    setHolidayDesc('');
    showToast(`Libur ${hDetails.fullFormatted} (${newHoliday.keterangan}) berhasil ditambahkan.`);
  };

  // Delete special holiday
  const handleDeleteSpecialHoliday = (id: string) => {
    const updated: HolidaySettings = {
      ...holidays,
      specialHolidays: holidays.specialHolidays.filter((h) => h.id !== id),
    };
    onSaveHolidays(updated);
    showToast('Hari libur berhasil dihapus.');
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-emerald-400 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{saveToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Settings className="h-5 w-5 text-emerald-600" />
          Pengaturan Presensi & Kalender Hijriyah MTK
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Perhitungan hari aktif otomatis berdasarkan bulan Hijriyah (dikurangi hari Selasa, Jumat, dan hari libur khusus yang diinput).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SECTION A: Input Hari Aktif & Hitungan Otomatis */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-emerald-300" />
                  <h3 className="font-bold text-base">A. Hitungan Hari Aktif Otomatis</h3>
                </div>
                <span className="text-[11px] font-bold bg-emerald-700/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  Sistem Kalender Hijriyah
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                Otomatis dihitung dari jumlah hari bulan Hijriyah dikurangi Selasa, Jumat & libur khusus.
              </p>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
              <form onSubmit={handleSaveActiveDays} className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Bulan Hijriyah:</label>
                    <select
                      id="pengaturan-bulan-hijriah"
                      value={selectedHijriMonth}
                      onChange={(e) =>
                        handleHijriMonthYearChange(parseInt(e.target.value, 10), selectedHijriYear)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {HIJRI_MONTHS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tahun Hijriyah:</label>
                    <select
                      id="pengaturan-tahun-hijriah"
                      value={selectedHijriYear}
                      onChange={(e) =>
                        handleHijriMonthYearChange(selectedHijriMonth, parseInt(e.target.value, 10))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {[1446, 1447, 1448, 1449, 1450].map((yr) => (
                        <option key={yr} value={yr}>
                          {yr} H
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Formula Breakdown Card */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <Sparkles className="w-4 h-4" />
                      Rincian Hitungan Otomatis:
                    </span>
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
                      {autoCalendar.activeDaysCount} Hari Aktif
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-medium text-slate-600">
                    <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                      <span>Total Hari Bulan:</span>
                      <strong className="text-slate-900">{autoCalendar.totalDays} Hari</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                      <span>Libur Selasa:</span>
                      <strong className="text-rose-600">-{autoCalendar.selasaCount} Hari</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                      <span>Libur Jumat:</span>
                      <strong className="text-rose-600">-{autoCalendar.jumatCount} Hari</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200 flex justify-between">
                      <span>Libur Khusus:</span>
                      <strong className="text-rose-600">
                        -{autoCalendar.specialHolidaysInMonth.length} Hari
                      </strong>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 pt-1">
                    Rumus: {autoCalendar.totalDays} - {autoCalendar.selasaCount} (Selasa) -{' '}
                    {autoCalendar.jumatCount} (Jumat) - {autoCalendar.specialHolidaysInMonth.length}{' '}
                    (Khusus) = <strong>{autoCalendar.activeDaysCount} Hari Aktif</strong>.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Jumlah Hari Aktif ({autoCalendar.monthName} {selectedHijriYear} H):
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      id="input-hari-aktif"
                      min={0}
                      max={31}
                      value={daysCountInput}
                      onChange={(e) => setDaysCountInput(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-lg font-bold text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 text-center"
                      required
                    />
                    <span className="text-sm font-semibold text-slate-500 shrink-0">Hari</span>
                    <button
                      type="button"
                      onClick={handleApplyAutoDays}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 transition shrink-0 whitespace-nowrap cursor-pointer"
                      title="Gunakan hasil rumus otomatis"
                    >
                      Set Otomatis ({autoCalendar.activeDaysCount})
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-simpan-hari-aktif"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>Simpan Pengaturan Hari Aktif</span>
                </button>
              </form>

              {/* Table of configured active days */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <span className="font-bold text-xs text-slate-700 uppercase tracking-wider block">
                  Daftar Hari Aktif Bulan Hijriyah:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {HIJRI_MONTHS.slice(0, 6).map((m) => {
                    const key = `${selectedHijriYear}-${String(m.id).padStart(2, '0')}`;
                    const count =
                      activeDays[key] ??
                      getHijriMonthCalendar(selectedHijriYear, m.id, holidays.specialHolidays)
                        .activeDaysCount;
                    return (
                      <div
                        key={m.id}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <span className="text-slate-600 font-medium truncate max-w-[90px]">
                          {m.name}:
                        </span>
                        <span className="font-bold text-emerald-800">{count} Hari</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION B: Input Hari Libur */}
        <div className="lg:col-span-6 space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white">
              <div className="flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-emerald-200" />
                <h3 className="font-bold text-base">B. Input Hari Libur</h3>
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                Atur libur rutin pesantren dan tambah tanggal libur khusus.
              </p>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
              {/* 1. Libur Rutin Info & Checkboxes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                      1. Libur Rutin Mingguan:
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Selasa & Jumat Otomatis Libur
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Senin Malam Checkbox */}
                  <label
                    htmlFor="chk-senin-malam"
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition select-none ${
                      holidays.routineSeninMalam
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="chk-senin-malam"
                      checked={holidays.routineSeninMalam}
                      onChange={() => handleToggleRoutine('routineSeninMalam')}
                      className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Libur Rutin:</span>
                      <span className="text-xs sm:text-sm">Senin Malam</span>
                    </div>
                  </label>

                  {/* Kamis Malam Checkbox */}
                  <label
                    htmlFor="chk-kamis-malam"
                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition select-none ${
                      holidays.routineKamisMalam
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="chk-kamis-malam"
                      checked={holidays.routineKamisMalam}
                      onChange={() => handleToggleRoutine('routineKamisMalam')}
                      className="h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Libur Rutin:</span>
                      <span className="text-xs sm:text-sm">Kamis Malam</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Libur Tanggal Form */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    2. Tambah Libur Tanggal Tertentu:
                  </span>
                </div>

                <form onSubmit={handleAddSpecialHoliday} className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">
                        Pilih Tanggal:
                      </label>
                      <input
                        type="date"
                        id="input-tanggal-libur"
                        required
                        value={holidayDate}
                        onChange={(e) => setHolidayDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] text-emerald-700 font-bold mt-1 block">
                        {formatHijriShort(holidayDate)}
                      </span>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">
                        Keterangan Libur:
                      </label>
                      <input
                        type="text"
                        id="input-keterangan-libur"
                        required
                        placeholder="Contoh: Maulid Nabi SAW"
                        value={holidayDesc}
                        onChange={(e) => setHolidayDesc(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="btn-tambah-libur"
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah ke Daftar Hari Libur</span>
                  </button>
                </form>

                {/* List of Special Holidays */}
                <div className="space-y-2 pt-2">
                  <span className="font-semibold text-xs text-slate-600 block">
                    Daftar Libur Khusus ({holidays.specialHolidays.length}):
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                    {holidays.specialHolidays.length === 0 ? (
                      <p className="text-slate-400 text-center py-3 text-xs">
                        Belum ada libur tanggal khusus.
                      </p>
                    ) : (
                      holidays.specialHolidays.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs hover:border-emerald-300 transition"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {formatHijriFull(item.tanggal)}
                            </span>
                            <span className="text-slate-600 text-[11px]">{item.keterangan}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteSpecialHoliday(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Hapus libur ini"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: Sinkronisasi Cloud & Unduh HP */}
      <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-2xl p-6 shadow-sm border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="h-5 w-5" />
            </span>
            <h4 className="font-bold text-white text-base">
              Sinkronisasi Cloud Real-time & Unduh Aplikasi di HP
            </h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Aplikasi ini terhubung langsung ke <strong>Firebase Firestore</strong>. Semua data presensi, master data asatidz, dan rekap otomatis tersinkronkan seketika ke seluruh smartphone (HP Android/iPhone) yang mengunduh atau membuka aplikasi ini.
          </p>
          <div className="flex items-center gap-3 text-xs text-emerald-300 font-medium pt-1">
            <span className="flex items-center gap-1">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              Status: {syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Terhubung Realtime'}
            </span>
            <span>• PWA Standalone Ready</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          {onSyncAllToFirebase && (
            <button
              type="button"
              id="btn-pengaturan-sync-firebase"
              onClick={onSyncAllToFirebase}
              disabled={isSyncingAll}
              className="px-4 py-3 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-400/50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 whitespace-nowrap cursor-pointer"
            >
              {isSyncingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Cloud className="w-4 h-4 text-white" />
              )}
              {isSyncingAll ? 'Menyinkronkan...' : 'Sinkronkan Semua ke Firebase'}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSyncModal}
            className="px-5 py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Buka QR Code & Unduh di HP
          </button>
        </div>
      </div>

      {/* SECTION D: Reset / Backup Data */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-slate-500" />
            Reset Data ke Pengaturan Standar
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Kembalikan daftar asatidz, presensi, dan hari aktif ke sampel awal.
          </p>
        </div>

        <button
          type="button"
          id="btn-reset-data"
          onClick={() => {
            if (
              confirm(
                'Apakah Anda yakin ingin mereset seluruh data lokal kembali ke contoh bawaan?'
              )
            ) {
              onResetData();
              showToast('Data berhasil direset ke setelan awal.');
            }
          }}
          className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Reset Data Standar
        </button>
      </div>
    </div>
  );
};
