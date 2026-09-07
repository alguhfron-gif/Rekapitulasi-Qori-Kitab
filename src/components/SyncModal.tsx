import React, { useEffect, useState, useRef } from 'react';
import {
  Smartphone,
  CheckCircle2,
  Copy,
  ExternalLink,
  X,
  Share2,
  RefreshCw,
  Download,
  Wifi,
  Layers,
  Cloud,
} from 'lucide-react';
import QRCode from 'qrcode';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: 'synced' | 'syncing' | 'offline';
  pesertaCount: number;
  recordsCount: number;
  onSyncAllToFirebase?: () => Promise<void>;
  isSyncingAll?: boolean;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  pesertaCount,
  recordsCount,
  onSyncAllToFirebase,
  isSyncingAll = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  // Listen for PWA beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Generate QR Code
  useEffect(() => {
    if (isOpen && currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => {
          setQrDataUrl(url);
        })
        .catch((err) => {
          console.error('QR Code error:', err);
        });
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setCanInstall(false);
      }
      setDeferredPrompt(null);
    }
  };

  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Assalamu'alaikum, berikut link Aplikasi Presensi Ngaji Kitab MTK Musyawarah (tersinkron cloud realtime): ${currentUrl}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Sinkronisasi & Unduh di HP</h3>
              <p className="text-xs text-slate-400">Firebase Firestore Real-time Cloud Active</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-700 text-sm">
          {/* Real-time Status Card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5">
              {syncStatus === 'syncing' ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-emerald-900 text-xs sm:text-sm">
                  {syncStatus === 'syncing' ? 'Sedang Menyinkronkan...' : 'Sinkronisasi Cloud Aktif'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                  Realtime
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                Setiap data yang Anda input atau ubah di HP maupun di komputer ini akan <strong>otomatis tersinkronkan seketika</strong> tanpa perlu tombol simpan manual atau reload.
              </p>
              <div className="mt-2.5 flex items-center gap-3 text-[11px] text-emerald-700 font-medium">
                <span>• {pesertaCount} Asatidz terdata</span>
                <span>• {recordsCount} Riwayat presensi tersinkron</span>
              </div>

              {onSyncAllToFirebase && (
                <div className="mt-3 pt-2.5 border-t border-emerald-200/70">
                  <button
                    type="button"
                    onClick={onSyncAllToFirebase}
                    disabled={isSyncingAll}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs cursor-pointer active:scale-[0.99]"
                  >
                    {isSyncingAll ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Cloud className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>
                      {isSyncingAll
                        ? 'Sedang Menyinkronkan ke Firebase...'
                        : 'Sinkronkan Semua Data ke Firebase Sekarang'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* QR Code Section for HP */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center text-center">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
              Scan QR Code Ini Dengan Kamera HP
            </p>

            <div className="p-3 bg-white rounded-xl shadow-xs border border-slate-200 inline-block mb-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code Presensi MTK"
                  className="w-44 h-44 object-contain rounded"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                  Memuat QR Code...
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 max-w-xs">
              Arahkan kamera HP Anda ke QR code di atas untuk langsung membuka aplikasi di ponsel Anda.
            </p>
          </div>

          {/* In-App Direct Install Button if PWA prompt is ready */}
          {canInstall && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
            >
              <Download className="w-4 h-4" />
              Pasang / Unduh Aplikasi ke HP Ini Sekarang
            </button>
          )}

          {/* Copy URL & WhatsApp Share */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              Link Aplikasi Untuk Dibuka di HP:
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin'}</span>
              </button>
            </div>

            <div className="pt-1">
              <a
                href={waShareUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Kirim Link ke WhatsApp Saya / Tim TU
              </a>
            </div>
          </div>

          {/* Step-by-Step Installation Guide for HP */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Cara Mengunduh / Menambahkan ke Layar Utama HP:
            </h4>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-800 mb-1">Di Android (Google Chrome):</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Buka link di browser Google Chrome.</li>
                  <li>Tekan menu titik tiga <strong>(⋮)</strong> di pojok kanan atas.</li>
                  <li>Pilih <strong>&quot;Instal Aplikasi&quot;</strong> atau <strong>&quot;Tambahkan ke Layar Utama&quot;</strong>.</li>
                  <li>Aplikasi akan muncul di menu HP seperti aplikasi unduhan Play Store!</li>
                </ol>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <p className="font-bold text-slate-800 mb-1">Di iPhone (Apple Safari):</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Buka link di browser Safari.</li>
                  <li>Tekan tombol <strong>Bagikan / Share</strong> (ikon kotak dengan panah ke atas di bagian bawah).</li>
                  <li>Gulir ke bawah dan pilih <strong>&quot;Tambah ke Layar Utama&quot; (Add to Home Screen)</strong>.</li>
                  <li>Tekan <strong>Tambah</strong> di pojok kanan atas.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Status: <strong className="text-emerald-700 font-semibold">Firebase Firestore Online</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
