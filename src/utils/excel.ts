import * as XLSX from 'xlsx';
import { Peserta, RekapPesertaItem } from '../types';

export const exportPesertaToExcel = (pesertaList: Peserta[], filename = 'Master_Data_Peserta_MTK.xlsx'): void => {
  const data = pesertaList.map((p, idx) => ({
    No: idx + 1,
    'ID PPS': p.idPps,
    Nama: p.nama,
    'Kelas/Majelis': p.kelas,
    Jabatan: p.jabatan,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Auto-fit column width
  const colWidths = [
    { wch: 6 }, // No
    { wch: 15 }, // ID PPS
    { wch: 30 }, // Nama
    { wch: 20 }, // Kelas
    { wch: 25 }, // Jabatan
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Peserta MTK');
  XLSX.writeFile(workbook, filename);
};

export const downloadPesertaTemplate = (): void => {
  const template = [
    {
      'ID PPS': 'PPS-001',
      Nama: 'Ust. Fulan Al-Hafidz',
      'Kelas/Majelis': 'Ula A',
      Jabatan: 'Guru Fiqih',
    },
    {
      'ID PPS': 'PPS-002',
      Nama: 'Ust. Zaid bin Tsabit',
      'Kelas/Majelis': 'Wustho B',
      Jabatan: 'Guru Nahwu',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(template);
  worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Master');
  XLSX.writeFile(workbook, 'Template_Master_Peserta_MTK.xlsx');
};

export const parsePesertaFromExcel = (file: File): Promise<Peserta[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

        if (!json || json.length === 0) {
          throw new Error('File Excel kosong atau format tidak sesuai.');
        }

        const parsedList: Peserta[] = [];
        let counter = Date.now();

        for (const row of json) {
          // Flexible key lookup
          const idPps =
            (row['ID PPS'] ?? row['ID'] ?? row['Id'] ?? row['id pps'] ?? row['No Induk'] ?? row['ID_PPS'])?.toString().trim() || '';
          const nama =
            (row['Nama'] ?? row['NAMA'] ?? row['Nama Lengkap'] ?? row['Nama Peserta'])?.toString().trim() || '';
          const kelas =
            (row['Kelas/Majelis'] ?? row['Kelas'] ?? row['Majelis'] ?? row['KELAS'])?.toString().trim() || 'Umum';
          const jabatan =
            (row['Jabatan'] ?? row['JABATAN'] ?? row['Posisi'] ?? row['Tugas'])?.toString().trim() || 'Guru Ngaji';

          if (nama) {
            counter++;
            parsedList.push({
              id: `imp-${counter}-${Math.floor(Math.random() * 1000)}`,
              idPps: idPps || `PPS-${String(parsedList.length + 1).padStart(3, '0')}`,
              nama,
              kelas,
              jabatan,
            });
          }
        }

        if (parsedList.length === 0) {
          throw new Error('Tidak ada data peserta yang valid ditemukan dalam Excel.');
        }

        resolve(parsedList);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Gagal membaca file Excel';
        reject(new Error(errorMsg));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
};

export const exportRekapToExcel = (
  rekapItems: RekapPesertaItem[],
  titlePrefix = 'Rekap_Presensi_MTK',
  filterDescription = ''
): void => {
  // Required columns by user:
  // ID PPS, Nama, Kelas, Jabatan, Hari Aktif, Hadir, Sakit, Izin, Alfa, Detail Tanggal Izin, Detail Alasan
  const data = rekapItems.map((item) => ({
    'ID PPS': item.idPps,
    Nama: item.nama,
    Kelas: item.kelas,
    Jabatan: item.jabatan,
    'Hari Aktif': item.hariAktif,
    Hadir: item.hadir,
    Sakit: item.sakit,
    Izin: item.izin,
    Alfa: item.alfa,
    '% Kehadiran': `${item.persentaseKehadiran.toFixed(1)}%`,
    'Detail Tanggal Izin': item.detailTanggalIzin || '-',
    'Detail Alasan': item.detailAlasan || '-',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // ID PPS
    { wch: 30 }, // Nama
    { wch: 16 }, // Kelas
    { wch: 24 }, // Jabatan
    { wch: 12 }, // Hari Aktif
    { wch: 8 },  // Hadir
    { wch: 8 },  // Sakit
    { wch: 8 },  // Izin
    { wch: 8 },  // Alfa
    { wch: 14 }, // % Kehadiran
    { wch: 35 }, // Detail Tanggal Izin
    { wch: 40 }, // Detail Alasan
  ];

  const workbook = XLSX.utils.book_new();
  const sheetName = 'Rekap Kehadiran';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanDesc = filterDescription ? `_${filterDescription.replace(/[\s/\\:]+/g, '_')}` : '';
  const filename = `${titlePrefix}${cleanDesc}.xlsx`;
  XLSX.writeFile(workbook, filename);
};
