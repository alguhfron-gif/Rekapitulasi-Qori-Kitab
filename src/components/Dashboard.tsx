import React, { useState, useMemo } from 'react';
import { Peserta, AttendanceRecord, MonthlyActiveDays } from '../types';
import { MONTH_NAMES_ID } from '../utils/dateHelper';
import {
  Users,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Award,
  ChevronRight,
  PieChart as PieIcon,
  BarChart3,
  Cloud,
  RefreshCw,
  Wifi,
  CheckCircle2,
} from 'lucide-react';

interface DashboardProps {
  pesertaList: Peserta[];
  records: AttendanceRecord[];
  activeDaysSetting: MonthlyActiveDays;
  onNavigateToRekap: () => void;
  onNavigateToInput: () => void;
  syncStatus?: 'synced' | 'syncing' | 'offline';
  onSyncAllToFirebase?: () => Promise<void>;
  isSyncingAll?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  pesertaList,
  records,
  activeDaysSetting,
  onNavigateToRekap,
  onNavigateToInput,
  syncStatus = 'synced',
  onSyncAllToFirebase,
  isSyncingAll = false,
}) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);

  const yearMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const activeDays = activeDaysSetting[yearMonthKey] ?? 24;

  // Filter records for selected month
  const monthRecords = useMemo(() => {
    return records.filter((r) => {
      const parts = r.tanggal.split('-');
      return (
        parseInt(parts[0], 10) === selectedYear &&
        parseInt(parts[1], 10) === selectedMonth
      );
    });
  }, [records, selectedYear, selectedMonth]);

  // Aggregate stats
  const hadirCount = monthRecords.filter((r) => r.status === 'Hadir').length;
  const sakitCount = monthRecords.filter((r) => r.status === 'Sakit').length;
  const izinCount = monthRecords.filter((r) => r.status === 'Izin').length;
  const alfaCount = monthRecords.filter((r) => r.status === 'Alfa').length;
  const totalEntries = monthRecords.length;

  // Overall attendance percentage
  const hadirPercentage = totalEntries > 0 ? (hadirCount / totalEntries) * 100 : 100;
  const sakitPercentage = totalEntries > 0 ? (sakitCount / totalEntries) * 100 : 0;
  const izinPercentage = totalEntries > 0 ? (izinCount / totalEntries) * 100 : 0;
  const alfaPercentage = totalEntries > 0 ? (alfaCount / totalEntries) * 100 : 0;

  // Class breakdown
  const classBreakdown = useMemo(() => {
    const map: Record<string, { total: number; hadir: number; izinAlfa: number }> = {};
    pesertaList.forEach((p) => {
      if (!map[p.kelas]) {
        map[p.kelas] = { total: 0, hadir: 0, izinAlfa: 0 };
      }
    });

    monthRecords.forEach((r) => {
      if (!map[r.kelas]) {
        map[r.kelas] = { total: 0, hadir: 0, izinAlfa: 0 };
      }
      map[r.kelas].total++;
      if (r.status === 'Hadir') {
        map[r.kelas].hadir++;
      } else if (r.status === 'Izin' || r.status === 'Alfa') {
        map[r.kelas].izinAlfa++;
      }
    });

    return Object.entries(map).map(([kelas, data]) => ({
      kelas,
      total: data.total,
      hadir: data.hadir,
      izinAlfa: data.izinAlfa,
      percentage: data.total > 0 ? Math.round((data.hadir / data.total) * 100) : 100,
    }));
  }, [pesertaList, monthRecords]);

  // Top 5 Peserta with most Izin / Alfa
  const topAbsentees = useMemo(() => {
    const statsMap: Record<
      string,
      {
        peserta: Peserta;
        hadir: number;
        sakit: number;
        izin: number;
        alfa: number;
        totalIzinAlfa: number;
      }
    > = {};

    pesertaList.forEach((p) => {
      statsMap[p.idPps] = {
        peserta: p,
        hadir: 0,
        sakit: 0,
        izin: 0,
        alfa: 0,
        totalIzinAlfa: 0,
      };
    });

    monthRecords.forEach((r) => {
      if (statsMap[r.idPps]) {
        if (r.status === 'Hadir') statsMap[r.idPps].hadir++;
        if (r.status === 'Sakit') statsMap[r.idPps].sakit++;
        if (r.status === 'Izin') {
          statsMap[r.idPps].izin++;
          statsMap[r.idPps].totalIzinAlfa++;
        }
        if (r.status === 'Alfa') {
          statsMap[r.idPps].alfa++;
          statsMap[r.idPps].totalIzinAlfa++;
        }
      }
    });

    return Object.values(statsMap)
      .sort((a, b) => {
        // Sort by total Izin + Alfa descending, then Alfa descending
        if (b.totalIzinAlfa !== a.totalIzinAlfa) {
          return b.totalIzinAlfa - a.totalIzinAlfa;
        }
        return b.alfa - a.alfa;
      })
      .slice(0, 5);
  }, [pesertaList, monthRecords]);

  return (
    <div className="space-y-6">
      {/* Firebase Cloud Sync Status Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            {isSyncingAll ? (
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
            ) : syncStatus === 'offline' ? (
              <Wifi className="w-5 h-5 text-amber-400" />
            ) : (
              <Cloud className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">Firebase Firestore Cloud Sync</h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {syncStatus === 'synced' ? 'Tersinkron Realtime' : syncStatus === 'syncing' ? 'Menyinkronkan...' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Data terhubung ke database cloud. Presensi seketika sinkron antara Laptop/PC dan seluruh HP asatidz/panitia.
            </p>
          </div>
        </div>

        {onSyncAllToFirebase && (
          <button
            type="button"
            id="btn-dashboard-sync-firebase"
            onClick={onSyncAllToFirebase}
            disabled={isSyncingAll}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            {isSyncingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <RefreshCw className="w-4 h-4 text-white" />
            )}
            <span>{isSyncingAll ? 'Menyinkronkan...' : 'Singkronkan Data Sekarang'}</span>
          </button>
        )}
      </div>

      {/* Month & Year Filter Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
            Ringkasan Kehadiran Asatidz
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan bulanan presensi pengajian dan musyawarah kitab
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Month Selector */}
          <select
            id="select-dashboard-month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {MONTH_NAMES_ID.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            id="select-dashboard-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027, 2028].map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <button
            onClick={onNavigateToInput}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-sm transition whitespace-nowrap"
          >
            + Input Presensi
          </button>
        </div>
      </div>

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 shrink-0">
        {/* Card 1: Total Peserta */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Total Peserta</p>
          <p className="text-3xl font-bold text-slate-900">{pesertaList.length}</p>
          <p className="text-xs text-blue-500 mt-2 font-medium">Asatidz MTK terdaftar</p>
        </div>

        {/* Card 2: Hari Aktif */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Hari Aktif</p>
          <p className="text-3xl font-bold text-slate-900">{activeDays}</p>
          <p className="text-xs text-slate-500 mt-2">Bulan: {MONTH_NAMES_ID[selectedMonth - 1]} {selectedYear}</p>
        </div>

        {/* Card 3: Persentase Kehadiran */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Rata-rata Hadir</p>
          <p className="text-3xl font-bold text-emerald-600">{hadirPercentage.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-2">{hadirCount} dari {totalEntries} sesi tercatat</p>
        </div>

        {/* Card 4: Izin & Alfa */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase mb-1 tracking-wide">Izin / Alfa</p>
          <p className="text-3xl font-bold text-rose-500">{izinCount + alfaCount}</p>
          <p className="text-xs text-rose-400 mt-2 font-medium">
            {izinCount} Izin • {alfaCount} Alfa • {sakitCount} Sakit
          </p>
        </div>
      </div>

      {/* Visual Chart & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Persentase Kehadiran Donut & Status Bars */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Grafik: Persentase Kehadiran
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {MONTH_NAMES_ID[selectedMonth - 1]} {selectedYear}
            </span>
          </div>

          {/* Graphical Donut Representation via SVG */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f1f5f9"
                  strokeWidth="14"
                />
                {/* Hadir segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#059669"
                  strokeWidth="14"
                  strokeDasharray={`${(hadirPercentage * 238.76) / 100} 238.76`}
                  strokeDashoffset="0"
                  className="transition-all duration-700"
                />
                {/* Sakit segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#f59e0b"
                  strokeWidth="14"
                  strokeDasharray={`${(sakitPercentage * 238.76) / 100} 238.76`}
                  strokeDashoffset={`-${(hadirPercentage * 238.76) / 100}`}
                  className="transition-all duration-700"
                />
                {/* Izin segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="14"
                  strokeDasharray={`${(izinPercentage * 238.76) / 100} 238.76`}
                  strokeDashoffset={`-${((hadirPercentage + sakitPercentage) * 238.76) / 100}`}
                  className="transition-all duration-700"
                />
                {/* Alfa segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="#e11d48"
                  strokeWidth="14"
                  strokeDasharray={`${(alfaPercentage * 238.76) / 100} 238.76`}
                  strokeDashoffset={`-${
                    ((hadirPercentage + sakitPercentage + izinPercentage) * 238.76) / 100
                  }`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {hadirPercentage.toFixed(0)}%
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Hadir</span>
              </div>
            </div>

            {/* Legend & Stats */}
            <div className="space-y-2.5 w-full max-w-xs">
              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
                  <span className="font-semibold text-emerald-950">Hadir</span>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-emerald-900">{hadirCount} sesi</span>
                  <span className="text-emerald-700">({hadirPercentage.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-semibold text-amber-950">Sakit</span>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-amber-900">{sakitCount} sesi</span>
                  <span className="text-amber-700">({sakitPercentage.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
                  <span className="font-semibold text-blue-950">Izin</span>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-blue-900">{izinCount} sesi</span>
                  <span className="text-blue-700">({izinPercentage.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-rose-50 border border-rose-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-600 shrink-0" />
                  <span className="font-semibold text-rose-950">Alfa</span>
                </div>
                <div className="flex items-center gap-2 font-bold">
                  <span className="text-rose-900">{alfaCount} sesi</span>
                  <span className="text-rose-700">({alfaPercentage.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Per-Kelas Attendance Bar chart */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Kehadiran per Kelas / Majelis
              </h3>
            </div>
            <span className="text-xs text-slate-500">Persentase Hadir</span>
          </div>

          <div className="space-y-3.5 pt-1">
            {classBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Belum ada data kelas</p>
            ) : (
              classBreakdown.map((item) => (
                <div key={item.kelas} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800">{item.kelas}</span>
                    <span className="text-slate-600">
                      {item.hadir}/{item.total} hadir{' '}
                      <span className="text-emerald-600 font-bold ml-1">
                        ({item.percentage}%)
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Table: 5 Peserta dengan Izin / Alfa Terbanyak */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                5 Peserta dengan Izin/Alfa Terbanyak
              </h3>
              <p className="text-xs text-slate-500">
                Asatidz yang memiliki catatan ketidakhadiran tertinggi pada {MONTH_NAMES_ID[selectedMonth - 1]} {selectedYear}
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToRekap}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
          >
            Lihat Rekapitulasi Lengkap
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">ID PPS</th>
                <th className="py-3 px-4">Nama Asatidz</th>
                <th className="py-3 px-4">Kelas/Majelis</th>
                <th className="py-3 px-4 text-center">Izin</th>
                <th className="py-3 px-4 text-center">Sakit</th>
                <th className="py-3 px-4 text-center">Alfa</th>
                <th className="py-3 px-4 text-center font-bold text-rose-700">Total Izin+Alfa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topAbsentees.map((item, index) => {
                const hasAbsence = item.totalIzinAlfa > 0 || item.sakit > 0;
                return (
                  <tr
                    key={item.peserta.idPps}
                    className="hover:bg-slate-50/80 transition font-medium"
                  >
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index === 0 && hasAbsence
                            ? 'bg-rose-100 text-rose-800'
                            : index === 1 && hasAbsence
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs">
                        {item.peserta.idPps}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.peserta.nama}
                      <span className="block text-[11px] font-normal text-slate-500">
                        {item.peserta.jabatan}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{item.peserta.kelas}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-blue-50 text-blue-800 border border-blue-200">
                        {item.izin}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-50 text-amber-800 border border-amber-200">
                        {item.sakit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-rose-50 text-rose-800 border border-rose-200">
                        {item.alfa}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full font-extrabold text-xs ${
                          item.totalIzinAlfa > 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.totalIzinAlfa} kali
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
