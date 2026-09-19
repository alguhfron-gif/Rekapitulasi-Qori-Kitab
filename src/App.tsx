import { useState, useEffect, useCallback } from 'react';
import { Peserta, AttendanceRecord, HolidaySettings, MonthlyActiveDays } from './types';
import {
  getStoredPeserta,
  saveStoredPeserta,
  getStoredRecords,
  saveStoredRecords,
  getStoredHolidays,
  saveStoredHolidays,
  getStoredActiveDays,
  saveStoredActiveDays,
  resetAllDataToDefault,
} from './utils/storage';
import {
  initializeCloudData,
  subscribeToPeserta,
  subscribeToRecords,
  subscribeToHolidays,
  subscribeToActiveDays,
  cloudSavePeserta,
  cloudDeletePeserta,
  cloudDeleteMultiplePeserta,
  cloudBulkSavePeserta,
  cloudReplaceAllPeserta,
  cloudSaveRecord,
  cloudDeleteRecord,
  cloudDeleteMultipleRecords,
  cloudBulkSaveRecords,
  cloudSaveHolidays,
  cloudSaveActiveDays,
  cloudResetAllData,
  syncAllDataToCloud,
} from './services/syncService';
import {
  CalendarCheck,
  CalendarRange,
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
} from 'lucide-react';
import { Sidebar, HeaderBar, ActiveTab } from './components/Navbar';
import { InputPresensi } from './components/InputPresensi';
import { Dashboard } from './components/Dashboard';
import { Rekapitulasi } from './components/Rekapitulasi';
import { MasterData } from './components/MasterData';
import { Pengaturan } from './components/Pengaturan';
import { SyncModal } from './components/SyncModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { checkIsHoliday, getTodayString } from './utils/dateHelper';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(false);
  const [syncModalOpen, setSyncModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // State initialized from local cache for instant boot without blank screen
  const [pesertaList, setPesertaList] = useState<Peserta[]>(() => getStoredPeserta());
  const [records, setRecords] = useState<AttendanceRecord[]>(() => getStoredRecords());
  const [holidays, setHolidays] = useState<HolidaySettings>(() => getStoredHolidays());
  const [activeDays, setActiveDays] = useState<MonthlyActiveDays>(() => getStoredActiveDays());

  const todayHoliday = checkIsHoliday(getTodayString(), holidays);

  // Initialize and subscribe to Firestore for multi-device real-time sync (PC + HP)
  useEffect(() => {
    let isMounted = true;

    // Handle browser online/offline events accurately
    const handleOnline = () => {
      if (isMounted) setSyncStatus('synced');
    };
    const handleOffline = () => {
      if (isMounted) setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const setupSync = async () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
      } else {
        setSyncStatus('syncing');
      }

      await initializeCloudData();
      if (!isMounted) return;

      const handleSyncError = () => {
        if (!navigator.onLine && isMounted) {
          setSyncStatus('offline');
        } else if (isMounted) {
          // Connected via local/RTDB fallback
          setSyncStatus('synced');
        }
      };

      const unsubPeserta = subscribeToPeserta(
        (data) => {
          if (isMounted) {
            setPesertaList(data);
            setSyncStatus('synced');
          }
        },
        handleSyncError
      );

      const unsubRecords = subscribeToRecords(
        (data) => {
          if (isMounted) {
            setRecords(data);
            setSyncStatus('synced');
          }
        },
        handleSyncError
      );

      const unsubHolidays = subscribeToHolidays(
        (data) => {
          if (isMounted) {
            setHolidays(data);
            setSyncStatus('synced');
          }
        },
        handleSyncError
      );

      const unsubActiveDays = subscribeToActiveDays(
        (data) => {
          if (isMounted) {
            setActiveDays(data);
            setSyncStatus('synced');
          }
        },
        handleSyncError
      );

      return () => {
        unsubPeserta();
        unsubRecords();
        unsubHolidays();
        unsubActiveDays();
      };
    };

    const cleanupPromise = setupSync();

    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  // Handler: Manual full sync to Firebase Firestore
  const handleSyncAllToFirebase = async () => {
    setIsSyncingAll(true);
    setSyncStatus('syncing');
    try {
      const res = await syncAllDataToCloud(pesertaList, records, holidays, activeDays);
      setSyncStatus('synced');
      setSyncFeedback(
        `Semua data berhasil disinkronkan ke Firebase (${res.pesertaCount} peserta, ${res.recordsCount} presensi).`
      );
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error('Error syncing all to Firebase:', err);
      alert('Gagal menyinkronkan data ke Firebase. Silakan periksa koneksi internet Anda.');
      setSyncStatus('offline');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Cache changes to localStorage immediately
  useEffect(() => {
    saveStoredPeserta(pesertaList);
  }, [pesertaList]);

  useEffect(() => {
    saveStoredRecords(records);
  }, [records]);

  useEffect(() => {
    saveStoredHolidays(holidays);
  }, [holidays]);

  useEffect(() => {
    saveStoredActiveDays(activeDays);
  }, [activeDays]);

  // Handler: Add Peserta
  const handleAddPeserta = async (newP: Omit<Peserta, 'id' | 'createdAt'>) => {
    const p: Peserta = {
      ...newP,
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    setPesertaList((prev) => [...prev, p]);
    try {
      setSyncStatus('syncing');
      await cloudSavePeserta(p);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error saving peserta to cloud', e);
    }
  };

  // Handler: Edit Peserta
  const handleEditPeserta = async (updatedP: Peserta) => {
    setPesertaList((prev) => prev.map((p) => (p.id === updatedP.id ? updatedP : p)));
    try {
      setSyncStatus('syncing');
      await cloudSavePeserta(updatedP);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error updating peserta in cloud', e);
    }
  };

  // Handler: Delete Peserta
  const handleDeletePeserta = async (id: string) => {
    setPesertaList((prev) => prev.filter((p) => p.id !== id));
    try {
      setSyncStatus('syncing');
      await cloudDeletePeserta(id);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error deleting peserta from cloud', e);
    }
  };

  // Handler: Delete Multiple Peserta
  const handleDeleteMultiplePeserta = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setPesertaList((prev) => prev.filter((p) => !idSet.has(p.id)));
    try {
      setSyncStatus('syncing');
      await cloudDeleteMultiplePeserta(ids);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error deleting multiple peserta from cloud', e);
      setSyncStatus('synced');
    }
  };

  // Handler: Delete All Peserta
  const handleDeleteAllPeserta = async () => {
    setPesertaList([]);
    try {
      setSyncStatus('syncing');
      await cloudReplaceAllPeserta([]);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error deleting all peserta from cloud', e);
      setSyncStatus('synced');
    }
  };

  // Handler: Import Peserta from Excel
  const handleImportPeserta = async (imported: Peserta[], mode: 'append' | 'replace') => {
    let finalPeserta: Peserta[] = [];
    if (mode === 'replace') {
      finalPeserta = imported;
      setPesertaList(finalPeserta);
      try {
        setSyncStatus('syncing');
        await cloudReplaceAllPeserta(finalPeserta);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Error syncing replaced peserta to cloud', e);
        setSyncStatus('synced');
      }
    } else {
      const existingIds = new Set(pesertaList.map((p) => p.idPps.toLowerCase()));
      const filteredNew = imported.filter((p) => !existingIds.has(p.idPps.toLowerCase()));
      finalPeserta = [...pesertaList, ...filteredNew];
      setPesertaList(finalPeserta);
      try {
        setSyncStatus('syncing');
        await cloudBulkSavePeserta(filteredNew);
        setSyncStatus('synced');
      } catch (e) {
        console.error('Error syncing appended peserta to cloud', e);
        setSyncStatus('synced');
      }
    }
  };

  // Handler: Save or Update Attendance Record
  const handleSaveRecord = async (recordData: Omit<AttendanceRecord, 'id' | 'timestamp'>) => {
    try {
      const safeRecords = Array.isArray(records) ? records : [];
      const existingIndex = safeRecords.findIndex(
        (r) => r && r.tanggal === recordData.tanggal && r.idPps === recordData.idPps
      );

      const newRecord: AttendanceRecord = {
        ...recordData,
        id:
          existingIndex >= 0 && safeRecords[existingIndex]?.id
            ? safeRecords[existingIndex].id
            : `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };

      if (existingIndex >= 0) {
        const updated = [...safeRecords];
        updated[existingIndex] = newRecord;
        setRecords(updated);
      } else {
        setRecords((prev) => [newRecord, ...(Array.isArray(prev) ? prev : [])]);
      }

      setSyncStatus('syncing');
      await cloudSaveRecord(newRecord);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error saving record to cloud', e);
    }
  };

  // Handler: Bulk Mark Hadir
  const handleBulkMarkHadir = async (
    tanggal: string,
    unrecordedPeserta: Peserta[]
  ) => {
    try {
      const now = Date.now();
      const updatedRecords = [...(Array.isArray(records) ? records : [])];
      const newOrUpdatedForCloud: AttendanceRecord[] = [];

      (unrecordedPeserta || []).forEach((item) => {
        if (!item) return;
        const idx = updatedRecords.findIndex(
          (r) => r && r.tanggal === tanggal && r.idPps === item.idPps
        );
        if (idx >= 0) {
          const updated: AttendanceRecord = {
            ...updatedRecords[idx],
            status: 'Hadir',
            dom: item.dom || updatedRecords[idx].dom || '-',
            majlis: item.majlis || updatedRecords[idx].majlis || 'Majlis Utama',
            timestamp: now,
          };
          updatedRecords[idx] = updated;
          newOrUpdatedForCloud.push(updated);
        } else {
          const created: AttendanceRecord = {
            id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            tanggal,
            idPps: item.idPps || '',
            nama: item.nama || '',
            dom: item.dom || '-',
            kelas: item.kelas || '',
            majlis: item.majlis || 'Majlis Utama',
            jabatan: item.jabatan || '',
            status: 'Hadir',
            timestamp: now,
          };
          updatedRecords.unshift(created);
          newOrUpdatedForCloud.push(created);
        }
      });

      setRecords(updatedRecords);

      setSyncStatus('syncing');
      await cloudBulkSaveRecords(newOrUpdatedForCloud);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error bulk saving records to cloud', e);
    }
  };

  // Handler: Delete Record
  const handleDeleteRecord = async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    try {
      setSyncStatus('syncing');
      await cloudDeleteRecord(id);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error deleting record from cloud', e);
    }
  };

  // Handler: Delete All Records on a Specific Date
  const handleDeleteAllRecordsOnDate = async (tanggal: string) => {
    const toDelete = records.filter((r) => r.tanggal === tanggal);
    if (toDelete.length === 0) return;
    const toDeleteIds = toDelete.map((r) => r.id);
    setRecords((prev) => prev.filter((r) => r.tanggal !== tanggal));
    try {
      setSyncStatus('syncing');
      await cloudDeleteMultipleRecords(toDeleteIds);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error deleting records on date from cloud', e);
      setSyncStatus('synced');
    }
  };

  // Handler: Delete Multiple Records
  const handleDeleteMultipleRecords = async (recordIds: string[]) => {
    if (recordIds.length === 0) return;
    const idSet = new Set(recordIds);
    setRecords((prev) => prev.filter((r) => !idSet.has(r.id)));
    try {
      setSyncStatus('syncing');
      await cloudDeleteMultipleRecords(recordIds);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error bulk deleting records from cloud', e);
      setSyncStatus('synced');
    }
  };

  // Handler: Save Holidays
  const handleSaveHolidays = async (newHolidays: HolidaySettings) => {
    setHolidays(newHolidays);
    try {
      setSyncStatus('syncing');
      await cloudSaveHolidays(newHolidays);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error saving holidays to cloud', e);
    }
  };

  // Handler: Save Active Days
  const handleSaveActiveDays = async (newActiveDays: MonthlyActiveDays) => {
    setActiveDays(newActiveDays);
    try {
      setSyncStatus('syncing');
      await cloudSaveActiveDays(newActiveDays);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error saving active days to cloud', e);
    }
  };

  // Handler: Reset Data
  const handleResetData = async () => {
    resetAllDataToDefault();
    setPesertaList(getStoredPeserta());
    setRecords(getStoredRecords());
    setHolidays(getStoredHolidays());
    setActiveDays(getStoredActiveDays());

    try {
      setSyncStatus('syncing');
      await cloudResetAllData();
      setSyncStatus('synced');
    } catch (e) {
      console.error('Error resetting cloud data', e);
      alert('Reset lokal selesai. Sinkronisasi cloud sedang dipulihkan.');
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Sleek Left Sidebar with Hamburger Drawer Support */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalPeserta={pesertaList.length}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        desktopCollapsed={desktopCollapsed}
        setDesktopCollapsed={setDesktopCollapsed}
        onOpenSyncModal={() => setSyncModalOpen(true)}
        syncStatus={syncStatus}
        onSyncAllToFirebase={handleSyncAllToFirebase}
        isSyncingAll={isSyncingAll}
      />

      {/* Main Content Column */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        {/* Sleek Top Header Bar with Hamburger Button */}
        <HeaderBar
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
          onToggleDesktop={() => setDesktopCollapsed((prev) => !prev)}
          desktopCollapsed={desktopCollapsed}
          isHoliday={todayHoliday.isHoliday}
          holidayReason={todayHoliday.reason}
          onOpenSyncModal={() => setSyncModalOpen(true)}
          syncStatus={syncStatus}
          onSyncAllToFirebase={handleSyncAllToFirebase}
          isSyncingAll={isSyncingAll}
        />

        {/* Sync Feedback Toast */}
        {syncFeedback && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 p-3 bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-between shadow-md animate-fade-in">
            <span>{syncFeedback}</span>
            <button
              type="button"
              onClick={() => setSyncFeedback(null)}
              className="text-emerald-200 hover:text-white ml-2 text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic View Scrollable Container */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 overflow-y-auto space-y-6">
          {activeTab === 'input' && (
            <ErrorBoundary fallbackTitle="Kendala Memuat Halaman Presensi">
              <InputPresensi
                pesertaList={pesertaList}
                records={records}
                holidays={holidays}
                onSaveRecord={handleSaveRecord}
                onDeleteRecord={handleDeleteRecord}
                onDeleteAllRecordsOnDate={handleDeleteAllRecordsOnDate}
                onBulkMarkHadir={handleBulkMarkHadir}
              />
            </ErrorBoundary>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              pesertaList={pesertaList}
              records={records}
              activeDaysSetting={activeDays}
              onNavigateToRekap={() => setActiveTab('rekap_orang')}
              onNavigateToInput={() => setActiveTab('input')}
              syncStatus={syncStatus}
              onSyncAllToFirebase={handleSyncAllToFirebase}
              isSyncingAll={isSyncingAll}
            />
          )}

          {(activeTab === 'rekap_orang' || activeTab === 'rekap') && (
            <Rekapitulasi
              mode="rekap"
              pesertaList={pesertaList}
              records={records}
              activeDaysSetting={activeDays}
              onDeleteRecord={handleDeleteRecord}
              onDeletePeserta={handleDeletePeserta}
              onDeleteMultipleRecords={handleDeleteMultipleRecords}
              onSaveActiveDays={handleSaveActiveDays}
              onEditPeserta={handleEditPeserta}
              onSaveRecord={handleSaveRecord}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'riwayat_sesi' && (
            <Rekapitulasi
              mode="detail"
              pesertaList={pesertaList}
              records={records}
              activeDaysSetting={activeDays}
              onDeleteRecord={handleDeleteRecord}
              onDeletePeserta={handleDeletePeserta}
              onDeleteMultipleRecords={handleDeleteMultipleRecords}
              onSaveActiveDays={handleSaveActiveDays}
              onEditPeserta={handleEditPeserta}
              onSaveRecord={handleSaveRecord}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'master' && (
            <MasterData
              pesertaList={pesertaList}
              onAddPeserta={handleAddPeserta}
              onEditPeserta={handleEditPeserta}
              onDeletePeserta={handleDeletePeserta}
              onDeleteMultiplePeserta={handleDeleteMultiplePeserta}
              onDeleteAllPeserta={handleDeleteAllPeserta}
              onImportPeserta={handleImportPeserta}
            />
          )}

          {activeTab === 'pengaturan' && (
            <Pengaturan
              holidays={holidays}
              activeDays={activeDays}
              onSaveHolidays={handleSaveHolidays}
              onSaveActiveDays={handleSaveActiveDays}
              onResetData={handleResetData}
              onOpenSyncModal={() => setSyncModalOpen(true)}
              syncStatus={syncStatus}
              onSyncAllToFirebase={handleSyncAllToFirebase}
              isSyncingAll={isSyncingAll}
            />
          )}

          {/* Sleek Subdued Footer */}
          <footer className="pt-8 pb-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/80 gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-600">Presensi Kitab MTK</span>
              <span>— TU Musyawarah Kitab</span>
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                Tersinkron Firebase Cloud
              </span>
              <span>•</span>
              <span>Export Excel Ready</span>
            </div>
          </footer>
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Navigasi Bawah Mobile"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around py-1.5 px-1 shadow-2xl overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'input'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarCheck className="w-4 h-4 mb-0.5" />
            <span>Presensi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('rekap_orang')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'rekap_orang' || activeTab === 'rekap'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 mb-0.5" />
            <span>Rekap</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('riwayat_sesi')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'riwayat_sesi'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CalendarRange className="w-4 h-4 mb-0.5" />
            <span>Riwayat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'master'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5" />
            <span>Asatidz</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pengaturan')}
            className={`flex flex-col items-center py-1 px-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'pengaturan'
                ? 'text-emerald-400 bg-emerald-950/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span>Setting</span>
          </button>
        </nav>
      </main>

      {/* Sync & Mobile Download Modal */}
      <SyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        syncStatus={syncStatus}
        pesertaCount={pesertaList.length}
        recordsCount={records.length}
        onSyncAllToFirebase={handleSyncAllToFirebase}
        isSyncingAll={isSyncingAll}
      />
    </div>
  );
}
