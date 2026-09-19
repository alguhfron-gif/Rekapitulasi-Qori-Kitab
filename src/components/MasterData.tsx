import React, { useState, useRef, useMemo } from 'react';
import { Peserta, KELAS_OPTIONS, MAJLIS_OPTIONS } from '../types';
import {
  exportPesertaToExcel,
  parsePesertaFromExcel,
  downloadPesertaTemplate,
} from '../utils/excel';
import {
  Users,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  FileDown,
  Check,
} from 'lucide-react';

interface MasterDataProps {
  pesertaList: Peserta[];
  onAddPeserta: (peserta: Omit<Peserta, 'id'>) => void;
  onEditPeserta: (peserta: Peserta) => void;
  onDeletePeserta: (id: string) => void;
  onDeleteMultiplePeserta?: (ids: string[]) => void;
  onDeleteAllPeserta?: () => void;
  onImportPeserta: (importedList: Peserta[], mode: 'append' | 'replace') => void;
}

export const MasterData: React.FC<MasterDataProps> = ({
  pesertaList,
  onAddPeserta,
  onEditPeserta,
  onDeletePeserta,
  onDeleteMultiplePeserta,
  onDeleteAllPeserta,
  onImportPeserta,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [filterMajlis, setFilterMajlis] = useState<string>('ALL');
  const [selectedPesertaIds, setSelectedPesertaIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingPeserta, setEditingPeserta] = useState<Peserta | null>(null);
  const [deletingPeserta, setDeletingPeserta] = useState<Peserta | null>(null);

  // Form states according to 6 required fields: ID PPS, Nama, DOM, Kelas, Majlis, Jabatan
  const [formIdPps, setFormIdPps] = useState<string>('');
  const [formNama, setFormNama] = useState<string>('');
  const [formDom, setFormDom] = useState<string>('');
  const [formKelas, setFormKelas] = useState<string>('');
  const [formMajlis, setFormMajlis] = useState<string>('');
  const [formJabatan, setFormJabatan] = useState<string>('');

  // Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importPreview, setImportPreview] = useState<Peserta[] | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Classes list
  const classesList = useMemo(() => {
    const set = new Set<string>(KELAS_OPTIONS);
    pesertaList.forEach((p) => {
      if (p.kelas) set.add(p.kelas);
    });
    return Array.from(set);
  }, [pesertaList]);

  // Majlis list
  const majlisList = useMemo(() => {
    const set = new Set<string>(MAJLIS_OPTIONS);
    pesertaList.forEach((p) => {
      if (p.majlis) set.add(p.majlis);
    });
    return Array.from(set);
  }, [pesertaList]);

  // Filtered participants
  const filteredList = useMemo(() => {
    return pesertaList.filter((p) => {
      const matchSearch =
        p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.idPps.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.jabatan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.dom && p.dom.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.majlis && p.majlis.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.kelas.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKelas = filterKelas === 'ALL' || p.kelas === filterKelas;
      const matchMajlis = filterMajlis === 'ALL' || p.majlis === filterMajlis;
      return matchSearch && matchKelas && matchMajlis;
    });
  }, [pesertaList, searchQuery, filterKelas, filterMajlis]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    // Generate next ID PPS suggestion
    const nextNum = pesertaList.length + 1;
    setFormIdPps(`PPS-${String(nextNum).padStart(3, '0')}`);
    setFormNama('');
    setFormDom('');
    setFormKelas(KELAS_OPTIONS[0]);
    setFormMajlis(MAJLIS_OPTIONS[0]);
    setFormJabatan('Guru Ngaji');
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (p: Peserta) => {
    setEditingPeserta(p);
    setFormIdPps(p.idPps);
    setFormNama(p.nama);
    setFormDom(p.dom || '');
    setFormKelas(p.kelas);
    setFormMajlis(p.majlis || MAJLIS_OPTIONS[0]);
    setFormJabatan(p.jabatan);
  };

  // Save Add
  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIdPps.trim() || !formNama.trim()) {
      alert('ID PPS dan Nama Asatidz wajib diisi.');
      return;
    }

    // Check duplicate ID PPS
    const exists = pesertaList.some(
      (p) => p.idPps.toLowerCase() === formIdPps.trim().toLowerCase()
    );
    if (exists) {
      alert(`ID PPS "${formIdPps}" sudah dipakai. Silakan gunakan ID lain.`);
      return;
    }

    onAddPeserta({
      idPps: formIdPps.trim(),
      nama: formNama.trim(),
      dom: formDom.trim() || '-',
      kelas: formKelas.trim() || 'Umum',
      majlis: formMajlis.trim() || 'Majlis Utama',
      jabatan: formJabatan.trim() || 'Guru Ngaji',
    });

    setIsAddModalOpen(false);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeserta || !formNama.trim() || !formIdPps.trim()) return;

    // Check duplicate ID PPS if changed
    const duplicate = pesertaList.some(
      (p) =>
        p.id !== editingPeserta.id &&
        p.idPps.toLowerCase() === formIdPps.trim().toLowerCase()
    );
    if (duplicate) {
      alert(`ID PPS "${formIdPps}" sudah dipakai oleh peserta lain.`);
      return;
    }

    onEditPeserta({
      ...editingPeserta,
      idPps: formIdPps.trim(),
      nama: formNama.trim(),
      dom: formDom.trim() || '-',
      kelas: formKelas.trim(),
      majlis: formMajlis.trim() || 'Majlis Utama',
      jabatan: formJabatan.trim(),
    });

    setEditingPeserta(null);
  };

  // Handle file select for import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    try {
      const parsed = await parsePesertaFromExcel(file);
      setImportPreview(parsed);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Gagal memproses file Excel';
      setImportError(errorMsg);
      setImportPreview(null);
    }
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (!importPreview || importPreview.length === 0) return;
    onImportPeserta(importPreview, importMode);
    setIsImportModalOpen(false);
    setImportPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Master Data Peserta (Asatidz & Guru Ngaji)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total {pesertaList.length} asatidz terdaftar dengan susunan: 1. ID PPS, 2. Nama, 3. DOM, 4. Kelas, 5. Majlis, 6. Jabatan.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            id="btn-tambah-peserta"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Peserta</span>
          </button>

          <button
            type="button"
            id="btn-import-excel"
            onClick={() => {
              setImportPreview(null);
              setImportError(null);
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
          >
            <Upload className="h-4 w-4" />
            <span>Import dari Excel</span>
          </button>

          <button
            type="button"
            id="btn-export-master-excel"
            onClick={() => exportPesertaToExcel(pesertaList)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition"
          >
            <Download className="h-4 w-4" />
            <span>Export ke Excel</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6 relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            id="search-master"
            placeholder="Cari ID PPS, Nama, DOM, Kelas, Majlis, Jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            id="filter-kelas-master"
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          >
            <option value="ALL">Semua Kelas</option>
            {classesList.map((k) => (
              <option key={k} value={k}>
                Kelas: {k}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            id="filter-majlis-master"
            value={filterMajlis}
            onChange={(e) => setFilterMajlis(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
          >
            <option value="ALL">Semua Majlis</option>
            {majlisList.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 animate-fade-in">
          <Check className="h-5 w-5 shrink-0 text-emerald-300" />
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

      {/* Master Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Sub-bar with bulk delete actions */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>Menampilkan <strong>{filteredList.length}</strong> dari total <strong>{pesertaList.length}</strong> asatidz</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedPesertaIds.length > 0 && (
              <div className="flex items-center gap-2 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 animate-fade-in">
                <span className="text-xs font-bold text-rose-700">
                  {selectedPesertaIds.length} dipilih
                </span>
                <button
                  type="button"
                  id="btn-delete-selected-peserta"
                  onClick={() => {
                    if (
                      confirm(
                        `Apakah Anda yakin ingin menghapus ${selectedPesertaIds.length} data asatidz terpilih dari Master Data?`
                      )
                    ) {
                      if (onDeleteMultiplePeserta) {
                        onDeleteMultiplePeserta(selectedPesertaIds);
                      } else {
                        selectedPesertaIds.forEach((id) => onDeletePeserta(id));
                      }
                      setSelectedPesertaIds([]);
                      setToastMessage(`${selectedPesertaIds.length} asatidz berhasil dihapus.`);
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
                  onClick={() => setSelectedPesertaIds([])}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}

            {filteredList.length > 0 && (
              <button
                type="button"
                id="btn-delete-all-filtered-peserta"
                onClick={() => {
                  if (
                    confirm(
                      `PERINGATAN: Apakah Anda yakin ingin menghapus ${filteredList.length} asatidz yang sedang tampil pada filter saat ini?`
                    )
                  ) {
                    const idsToDelete = filteredList.map((p) => p.id);
                    if (onDeleteMultiplePeserta) {
                      onDeleteMultiplePeserta(idsToDelete);
                    } else {
                      idsToDelete.forEach((id) => onDeletePeserta(id));
                    }
                    setSelectedPesertaIds([]);
                    setToastMessage(`${idsToDelete.length} data asatidz berhasil dihapus.`);
                    setTimeout(() => setToastMessage(null), 3500);
                  }
                }}
                className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Hapus semua asatidz yang sedang tampil pada filter saat ini"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Hapus Sesuai Filter ({filteredList.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredList.length > 0 &&
                      filteredList.every((p) => selectedPesertaIds.includes(p.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newIds = new Set(selectedPesertaIds);
                        filteredList.forEach((p) => newIds.add(p.id));
                        setSelectedPesertaIds(Array.from(newIds));
                      } else {
                        const filterIdSet = new Set(filteredList.map((p) => p.id));
                        setSelectedPesertaIds(
                          selectedPesertaIds.filter((id) => !filterIdSet.has(id))
                        );
                      }
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Pilih semua asatidz yang tampil"
                  />
                </th>
                <th className="py-3 px-3 w-10 text-center">No</th>
                <th className="py-3 px-3 w-28">1. ID PPS</th>
                <th className="py-3 px-4">2. Nama Asatidz</th>
                <th className="py-3 px-3">3. DOM</th>
                <th className="py-3 px-3">4. Kelas</th>
                <th className="py-3 px-3">5. Majlis</th>
                <th className="py-3 px-4">6. Jabatan</th>
                <th className="py-3 px-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Tidak ada data peserta yang sesuai dengan filter / pencarian.
                  </td>
                </tr>
              ) : (
                filteredList.map((p, index) => {
                  const isSelected = selectedPesertaIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
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
                              setSelectedPesertaIds([...selectedPesertaIds, p.id]);
                            } else {
                              setSelectedPesertaIds(
                                selectedPesertaIds.filter((id) => id !== p.id)
                              );
                            }
                          }}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-400 font-medium">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 text-xs font-mono">
                          {p.idPps}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.nama}</td>
                      <td className="py-3.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          {p.dom || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold">
                          {p.kelas}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-xs font-semibold">
                          {p.majlis || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{p.jabatan}</td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit Peserta"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPeserta(p)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Hapus Peserta"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Modal: Tambah Peserta */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" />
                Tambah Peserta Asatidz Baru
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. ID PPS (Nomor Induk / Kode): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formIdPps}
                  onChange={(e) => setFormIdPps(e.target.value.toUpperCase())}
                  placeholder="Contoh: PPS-011"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Nama Lengkap Asatidz: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: Ust. Ahmad Fauzi"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  3. DOM (Domisili / Asal Daerah):
                </label>
                <input
                  type="text"
                  value={formDom}
                  onChange={(e) => setFormDom(e.target.value)}
                  placeholder="Contoh: Bangkalan, Sampang, Asrama Al-Ghazali, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  4. Kelas: <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formKelas}
                  onChange={(e) => setFormKelas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {classesList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  5. Majlis: <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formMajlis}
                  onChange={(e) => setFormMajlis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {majlisList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  6. Jabatan: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJabatan}
                  onChange={(e) => setFormJabatan(e.target.value)}
                  placeholder="Contoh: Guru Fathul Qorib, Mustahiq, Badal Guru"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                >
                  Simpan Peserta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Peserta */}
      {editingPeserta && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-600" />
                Edit Data Asatidz
              </h3>
              <button
                type="button"
                onClick={() => setEditingPeserta(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1. ID PPS: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formIdPps}
                  onChange={(e) => setFormIdPps(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  2. Nama Lengkap: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  3. DOM (Domisili / Asal Daerah):
                </label>
                <input
                  type="text"
                  value={formDom}
                  onChange={(e) => setFormDom(e.target.value)}
                  placeholder="Contoh: Bangkalan, Sampang, Asrama Al-Ghazali, dll."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  4. Kelas: <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formKelas}
                  onChange={(e) => setFormKelas(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {classesList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  5. Majlis: <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formMajlis}
                  onChange={(e) => setFormMajlis(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {majlisList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  6. Jabatan: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formJabatan}
                  onChange={(e) => setFormJabatan(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      editingPeserta &&
                      confirm(
                        `Hapus data asatidz ${editingPeserta.nama} (${editingPeserta.idPps}) dari Master Data?`
                      )
                    ) {
                      onDeletePeserta(editingPeserta.id);
                      setEditingPeserta(null);
                      setToastMessage(`Data asatidz ${editingPeserta.nama} berhasil dihapus.`);
                      setTimeout(() => setToastMessage(null), 3500);
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Hapus Peserta</span>
                </button>
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Hapus Confirmation */}
      {deletingPeserta && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Hapus Data Asatidz?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Apakah Anda yakin ingin menghapus <strong>{deletingPeserta.nama}</strong> ({deletingPeserta.idPps}) dari Master Data?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPeserta(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePeserta(deletingPeserta.id);
                  setDeletingPeserta(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                Hapus Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import dari Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Import Asatidz dari Excel</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div>
                  <span className="font-bold text-blue-950 block">Format Kolom Excel (Urutan 1-6):</span>
                  <span className="text-blue-800 text-[11px]">
                    1. <strong>ID PPS</strong>, 2. <strong>Nama</strong>, 3. <strong>DOM</strong>, 4. <strong>Kelas</strong>, 5. <strong>Majlis</strong>, 6. <strong>Jabatan</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={downloadPesertaTemplate}
                  className="px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 font-semibold rounded-lg flex items-center gap-1 transition"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Unduh Template
                </button>
              </div>

              {/* Upload Input */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:border-blue-400 transition bg-slate-50/50">
                <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <label className="cursor-pointer font-bold text-blue-600 hover:text-blue-800">
                  <span>Klik untuk pilih file Excel (.xlsx / .xls / .csv)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mendukung file Excel standar atau file CSV dari spreadsheet TU
                </p>
              </div>

              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium">
                  {importError}
                </div>
              )}

              {/* Import Options */}
              {importPreview && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      Preview Data Terbaca ({importPreview.length} Asatidz):
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                        />
                        <span>Tambah ke Data Lama</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-rose-700">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                        />
                        <span>Ganti Semua Data</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {importPreview.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-900">{item.nama}</strong>{' '}
                          <span className="text-slate-500">({item.idPps})</span>
                          {item.dom && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              DOM: {item.dom}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-500">
                            Kelas: {item.kelas} • Majlis: {item.majlis} • {item.jabatan}
                          </div>
                        </div>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!importPreview || importPreview.length === 0}
                onClick={handleConfirmImport}
                className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition ${
                  importPreview && importPreview.length > 0
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Import {importPreview?.length || 0} Peserta Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
