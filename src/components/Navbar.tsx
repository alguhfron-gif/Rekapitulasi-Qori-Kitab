import React from 'react';
import {
  CalendarCheck,
  Calendar,
  CalendarRange,
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  Menu,
  X,
  Smartphone,
  Wifi,
  RefreshCw,
  Cloud,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { getHijriDateString, getTodayString } from '../utils/dateHelper';

export type ActiveTab =
  | 'input'
  | 'dashboard'
  | 'rekap_orang'
  | 'riwayat_sesi'
  | 'rekap'
  | 'master'
  | 'pengaturan';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  totalPeserta: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  desktopCollapsed?: boolean;
  setDesktopCollapsed?: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  onOpenSyncModal?: () => void;
  syncStatus?: 'synced' | 'syncing' | 'offline';
  onSyncAllToFirebase?: () => Promise<void>;
  isSyncingAll?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  totalPeserta,
  mobileOpen,
  setMobileOpen,
  desktopCollapsed = false,
  setDesktopCollapsed,
  onOpenSyncModal,
  syncStatus = 'synced',
  onSyncAllToFirebase,
  isSyncingAll = false,
}) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'input' as ActiveTab, label: 'Input Presensi', icon: CalendarCheck, badge: 'Cepat' },
    { id: 'rekap_orang' as ActiveTab, label: 'Rekapitulasi Per Orang', icon: FileSpreadsheet },
    { id: 'riwayat_sesi' as ActiveTab, label: 'Riwayat Detail Sesi', icon: CalendarRange },
    { id: 'master' as ActiveTab, label: 'Master Data', icon: Users, count: totalPeserta },
    { id: 'pengaturan' as ActiveTab, label: 'Pengaturan', icon: Settings },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Drawer Backdrop (Hamburger Navigation) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup Menu Navigasi"
        />
      )}

      {/* Desktop & Mobile Sidebar Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-700 transition-all duration-300 ease-in-out lg:static lg:translate-x-0 shrink-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl w-64 sm:w-72' : '-translate-x-full lg:translate-x-0'
        } ${desktopCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          {!desktopCollapsed ? (
            <div className="overflow-hidden">
              <h1 className="text-lg sm:text-xl font-bold text-emerald-400 tracking-tight truncate">
                MTK Musyawarah
              </h1>
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-0.5 font-semibold truncate">
                Presensi Ngaji Kitab
              </p>
            </div>
          ) : (
            <div className="w-full flex justify-center py-1">
              <span className="text-base font-black text-emerald-400 tracking-tighter">MTK</span>
            </div>
          )}

          {/* Desktop collapse toggle button */}
          {setDesktopCollapsed && (
            <button
              type="button"
              onClick={() => setDesktopCollapsed((prev) => !prev)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title={desktopCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
            >
              {desktopCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}

          {/* Mobile close button (Hamburger Navigation) */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup Menu Navigasi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sync ke Firebase Banner / Button */}
        {!desktopCollapsed ? (
          <div className="px-3 sm:px-4 pt-3 space-y-2">
            {onSyncAllToFirebase && (
              <button
                type="button"
                id="sidebar-btn-sync-firebase"
                onClick={onSyncAllToFirebase}
                disabled={isSyncingAll}
                className="w-full p-2.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 border border-emerald-500/40 text-left transition flex items-center justify-between cursor-pointer group"
                title="Simpan dan sinkronkan semua data lokal ke Firebase Firestore"
              >
                <div className="flex items-center gap-2">
                  {isSyncingAll ? (
                    <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  )}
                  <div>
                    <p className="text-xs font-bold text-emerald-300">
                      {isSyncingAll ? 'Menyinkronkan...' : 'Sinkron ke Firebase'}
                    </p>
                    <p className="text-[10px] text-emerald-400/80">Simpan ke cloud database</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  DB
                </span>
              </button>
            )}

            {/* Sync HP Banner */}
            <button
              type="button"
              id="sidebar-btn-sync-hp"
              onClick={() => {
                setMobileOpen(false);
                onOpenSyncModal?.();
              }}
              className="w-full p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:border-emerald-500/50 text-left transition group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-bold text-slate-200 group-hover:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  Buka & Unduh di HP
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition-colors">
                Scan QR Code untuk akses smartphone
              </p>
            </button>
          </div>
        ) : (
          <div className="py-3 flex flex-col items-center gap-2">
            {onSyncAllToFirebase && (
              <button
                type="button"
                onClick={onSyncAllToFirebase}
                disabled={isSyncingAll}
                className="p-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-400 transition cursor-pointer"
                title="Sinkronkan Semua Data ke Firebase"
              >
                {isSyncingAll ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Cloud className="w-5 h-5" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenSyncModal?.();
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 transition cursor-pointer"
              title="Buka & Unduh di HP (Scan QR)"
            >
              <Smartphone className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation Items (Hamburger Menu Items) */}
        <nav className="flex-1 p-3 sm:p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center ${
                  desktopCollapsed ? 'justify-center' : 'justify-between'
                } p-3 rounded-xl cursor-pointer transition-all text-left ${
                  isActive
                    ? 'bg-emerald-600 text-white font-medium shadow-md shadow-emerald-950/40'
                    : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                }`}
                title={desktopCollapsed ? item.label : undefined}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!desktopCollapsed && <span className="font-semibold text-sm">{item.label}</span>}
                </div>

                {!desktopCollapsed && (
                  <div className="flex items-center space-x-1.5">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {typeof item.count === 'number' && (
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer User Info & Live Cloud Status */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
          {!desktopCollapsed ? (
            <>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  {syncStatus === 'syncing' ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                  ) : syncStatus === 'offline' ? (
                    <Wifi className="w-3 h-3 text-amber-400" />
                  ) : (
                    <Cloud className="w-3 h-3 text-emerald-400" />
                  )}
                  Firestore:
                </span>
                <span
                  className={`font-semibold ${
                    syncStatus === 'syncing'
                      ? 'text-amber-400'
                      : syncStatus === 'offline'
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {syncStatus === 'syncing'
                    ? 'Menyinkronkan...'
                    : syncStatus === 'offline'
                    ? 'Koneksi Terputus'
                    : 'Tersinkron Realtime'}
                </span>
              </div>

              <div className="flex items-center space-x-3 pt-1 border-t border-slate-900">
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm shrink-0">
                  TU
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">TU Musyawarah Kitab</p>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                    Presensi MTK Online
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center" title="TU Musyawarah Kitab - Tersinkron Firebase">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white uppercase shadow-sm">
                TU
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

interface HeaderBarProps {
  onToggleMobile: () => void;
  onToggleDesktop?: () => void;
  desktopCollapsed?: boolean;
  isHoliday?: boolean;
  holidayReason?: string;
  onOpenSyncModal?: () => void;
  syncStatus?: 'synced' | 'syncing' | 'offline';
  onSyncAllToFirebase?: () => Promise<void>;
  isSyncingAll?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onToggleMobile,
  onToggleDesktop,
  desktopCollapsed,
  onOpenSyncModal,
  syncStatus = 'synced',
  onSyncAllToFirebase,
  isSyncingAll = false,
}) => {
  const todayStr = getTodayString();
  const hijriStr = getHijriDateString(todayStr);

  const handleHamburgerClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onToggleMobile();
    } else if (onToggleDesktop) {
      onToggleDesktop();
    } else {
      onToggleMobile();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-6 lg:px-8 shrink-0 z-30 shadow-2xs">
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Universal Hamburger Navigation Toggle Button */}
        <button
          type="button"
          id="btn-nav-hamburger"
          onClick={handleHamburgerClick}
          className="p-2 -ml-1 rounded-xl text-slate-700 hover:text-emerald-700 hover:bg-slate-100 flex items-center gap-2 transition border border-transparent hover:border-slate-200 cursor-pointer"
          title="Buka / Tutup Navigasi (Hamburger Menu)"
          aria-label="Menu Navigasi Hamburger"
        >
          <Menu className="h-5 w-5 text-slate-800" />
          <span className="hidden sm:inline font-bold text-xs text-slate-700">Menu</span>
        </button>

        {/* Tanggal Hijriyah Utama */}
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-emerald-900 text-xs sm:text-sm font-bold shadow-2xs">
          <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{hijriStr}</span>
        </div>
      </div>

      {/* Right Header Actions: Sinkronkan ke Firebase & Sinkron HP */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Tombol Singkronkan Semua Data ke Firebase */}
        {onSyncAllToFirebase && (
          <button
            type="button"
            id="btn-header-sync-firebase"
            onClick={onSyncAllToFirebase}
            disabled={isSyncingAll}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border ${
              syncStatus === 'offline'
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500 shadow-emerald-900/10 active:scale-95'
            }`}
            title="Singkronkan semua data peserta, presensi harian, dan pengaturan ke Firebase Firestore"
          >
            {isSyncingAll ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Cloud className="w-4 h-4 text-white" />
            )}
            <span className="hidden md:inline">
              {isSyncingAll ? 'Menyinkronkan...' : 'Sinkronkan ke Firebase'}
            </span>
            <span className="md:hidden">
              {isSyncingAll ? 'Sinkron...' : 'Sync Firebase'}
            </span>
          </button>
        )}

        {/* Sinkron HP & Unduh (PWA) */}
        <button
          type="button"
          id="btn-header-sync-hp"
          onClick={onOpenSyncModal}
          className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-900 hover:bg-black text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          title="Buka di smartphone atau unduh aplikasi PWA"
        >
          <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="hidden sm:inline">Sinkron HP</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0"></span>
        </button>
      </div>
    </header>
  );
};
