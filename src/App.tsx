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
  cloudReplaceAllPeserta,
  cloudSaveRecord,
  cloudDeleteRecord,
  cloudBulkSaveRecords,
  cloudSaveHolidays,
  cloudSaveActiveDays,
  cloudResetAllData,
  syncAllDataToCloud,
} from './services/syncService';
import { Sidebar, HeaderBar, ActiveTab } from './components/Navbar';
import { InputPresensi } from './components/InputPresensi';
import { Dashboard } from './components/Dashboard';
import { Rekapitulasi } from './components/Rekapitulasi';
import { MasterData } from './components/MasterData';
import { Pengaturan } from './components/Pengaturan';
import { SyncModal } from './components/SyncModal';
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

    const setupSync = async () => {
      setSyncStatus('syncing');
      await initializeCloudData();
      if (!isMounted) return;

      const unsubPeserta = subscribeToPeserta(
        (data) => {
          if (isMounted) {
            setPesertaList(data);
            setSyncStatus('synced');
          }
        },
        () => setSyncStatus('offline')
      );

      const unsubRecords = subscribeToRecords(
        (data) => {
          if (isMounted) {
            setRecords(data);
            setSyncStatus('synced');
          }
        },
        () => setSyncStatus('offline')
      );

      const unsubHolidays = subscribeToHolidays(
        (data) => {
          if (isMounted) {
            setHolidays(data);
            setSyncStatus('synced');
          }
        },
        () => setSyncStatus('offline')
      );

      const unsubActiveDays = subscribeToActiveDays(
        (data) => {
          if (isMounted) {
            setActiveDays(data);
            setSyncStatus('synced');
          }
        },
        () => setSyncStatus('offline')
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
      }
    } else {
      const existingIds = new Set(pesertaList.map((p) => p.idPps.toLowerCase()));
      const filteredNew = imported.filter((p) => !existingIds.has(p.idPps.toLowerCase()));
      finalPeserta = [...pesertaList, ...filteredNew];
      setPesertaList(finalPeserta);
      try {
        setSyncStatus('syncing');
        for (const p of filteredNew) {
          await cloudSavePeserta(p);
        }
        setSyncStatus('synced');
      } catch (e) {
        console.error('Error syncing appended peserta to cloud', e);
      }
    }
  };

  // Handler: Save or Update Attendance Record
  const handleSaveRecord = async (recordData: Omit<AttendanceRecord, 'id' | 'timestamp'>) => {
    const existingIndex = records.findIndex(
      (r) => r.tanggal === recordData.tanggal && r.idPps === recordData.idPps
    );

    const newRecord: AttendanceRecord = {
      ...recordData,
      id:
        existingIndex >= 0
          ? records[existingIndex].id
          : `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };

    if (existingIndex >= 0) {
      const updated = [...records];
      updated[existingIndex] = newRecord;
      setRecords(updated);
    } else {
      setRecords((prev) => [newRecord, ...prev]);
    }

    try {
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
    recordsToSave: Omit<AttendanceRecord, 'id' | 'timestamp'>[]
  ) => {
    const now = Date.now();
    const updatedRecords = [...records];
    const newOrUpdatedForCloud: AttendanceRecord[] = [];

    recordsToSave.forEach((item) => {
      const idx = updatedRecords.findIndex(
        (r) => r.tanggal === tanggal && r.idPps === item.idPps
      );
      if (idx >= 0) {
        const updated = {
          ...updatedRecords[idx],
          ...item,
          timestamp: now,
        };
        updatedRecords[idx] = updated;
        newOrUpdatedForCloud.push(updated);
      } else {
        const created: AttendanceRecord = {
          ...item,
          id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          timestamp: now,
        };
        updatedRecords.unshift(created);
        newOrUpdatedForCloud.push(created);
      }
    });

    setRecords(updatedRecords);

    try {
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
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {activeTab === 'input' && (
            <InputPresensi
              pesertaList={pesertaList}
              records={records}
              holidays={holidays}
              onSaveRecord={handleSaveRecord}
              onDeleteRecord={handleDeleteRecord}
              onBulkMarkHadir={handleBulkMarkHadir}
            />
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              pesertaList={pesertaList}
              records={records}
              activeDaysSetting={activeDays}
              onNavigateToRekap={() => setActiveTab('rekap')}
              onNavigateToInput={() => setActiveTab('input')}
            />
          )}

          {activeTab === 'rekap' && (
            <Rekapitulasi
              pesertaList={pesertaList}
              records={records}
              activeDaysSetting={activeDays}
              onDeleteRecord={handleDeleteRecord}
            />
          )}

          {activeTab === 'master' && (
            <MasterData
              pesertaList={pesertaList}
              onAddPeserta={handleAddPeserta}
              onEditPeserta={handleEditPeserta}
              onDeletePeserta={handleDeletePeserta}
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
