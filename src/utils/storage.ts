import { Peserta, AttendanceRecord, HolidaySettings, MonthlyActiveDays } from '../types';

const STORAGE_KEYS = {
  PESERTA: 'mtk_presensi_peserta_v1',
  RECORDS: 'mtk_presensi_records_v1',
  HOLIDAYS: 'mtk_presensi_holidays_v1',
  ACTIVE_DAYS: 'mtk_presensi_active_days_v1',
};

export const INITIAL_PESERTA: Peserta[] = [
  { id: '1', idPps: 'PPS-001', nama: 'Ust. H. Ahmad Fauzi, S.Pd.I', kelas: 'Aliyah', jabatan: 'Guru Fathul Qorib' },
  { id: '2', idPps: 'PPS-002', nama: 'Ust. M. Hasan Basri', kelas: 'Tsanawiyah Kelas III', jabatan: 'Guru Jurumiyyah' },
  { id: '3', idPps: 'PPS-003', nama: 'Ust. Abdul Karim Ma\'ruf', kelas: 'Tsanawiyah Kelas II', jabatan: 'Guru Matan Taqrib' },
  { id: '4', idPps: 'PPS-004', nama: 'Ust. Nur Hidayatullah', kelas: 'Tsanawiyah Kelas I', jabatan: 'Guru Nadhom Imrithi' },
  { id: '5', idPps: 'PPS-005', nama: 'Ustz. Hj. Siti Maryam', kelas: 'Ibtidaiyah Kelas 6', jabatan: 'Guru Akhlaq Lil Banat' },
  { id: '6', idPps: 'PPS-006', nama: 'Ust. M. Syukron Katsir', kelas: 'Ibtidaiyah Kelas 5', jabatan: 'Guru Alfiyyah' },
  { id: '7', idPps: 'PPS-007', nama: 'Ust. K.H. Zainal Abidin', kelas: 'Ibtidaiyah Kelas 4', jabatan: 'Mustahiq & Pembina Kitab' },
  { id: '8', idPps: 'PPS-008', nama: 'Ust. Ridwan Shodiq', kelas: 'Ibtidaiyah 1-3', jabatan: 'Guru Safinatun Naja' },
  { id: '9', idPps: 'PPS-009', nama: 'Ust. Bilal Manshur', kelas: 'Idadiyah PK', jabatan: 'Guru Kitab Mabadi' },
  { id: '10', idPps: 'PPS-010', nama: 'Ust. Salman Al-Farisi', kelas: 'Idadiyah Reguler', jabatan: 'Guru Tijan Ad-Darori' },
  { id: '11', idPps: 'PPS-011', nama: 'Ust. Zulkifli Anwar', kelas: 'Idadiyah Takhossus', jabatan: 'Guru Nahwu Sharaf' },
];

export const INITIAL_HOLIDAYS: HolidaySettings = {
  routineSeninMalam: true,
  routineKamisMalam: true,
  specialHolidays: [
    { id: 'h1', tanggal: '2026-09-15', keterangan: 'Khotmil Quran MTK' },
    { id: 'h2', tanggal: '2026-10-12', keterangan: 'Peringatan Maulid Nabi SAW' },
    { id: 'h3', tanggal: '2026-12-25', keterangan: 'Libur Semester Ganjil MTK' },
  ],
};

export const INITIAL_ACTIVE_DAYS: MonthlyActiveDays = {
  '2026-08': 24,
  '2026-09': 22,
  '2026-10': 25,
  '2026-11': 24,
  '2026-12': 20,
};

// Generate sample records for current month so TU sees working app immediately
const getSampleRecords = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [
    {
      id: 'rec-1',
      tanggal: '2026-09-01',
      idPps: 'PPS-001',
      nama: 'Ust. H. Ahmad Fauzi, S.Pd.I',
      kelas: 'Ula A',
      jabatan: 'Guru Fathul Qorib',
      status: 'Hadir',
      timestamp: 1788220800000,
    },
    {
      id: 'rec-2',
      tanggal: '2026-09-01',
      idPps: 'PPS-002',
      nama: 'Ust. M. Hasan Basri',
      kelas: 'Ula B',
      jabatan: 'Guru Jurumiyyah',
      status: 'Hadir',
      timestamp: 1788220800000,
    },
    {
      id: 'rec-3',
      tanggal: '2026-09-01',
      idPps: 'PPS-003',
      nama: 'Ust. Abdul Karim Ma\'ruf',
      kelas: 'Wustho A',
      jabatan: 'Guru Matan Taqrib',
      status: 'Izin',
      alasan: 'Izin Bepergian',
      keterangan: 'Menghadiri Haul Masyayikh',
      timestamp: 1788220800000,
    },
    {
      id: 'rec-4',
      tanggal: '2026-09-02',
      idPps: 'PPS-001',
      nama: 'Ust. H. Ahmad Fauzi, S.Pd.I',
      kelas: 'Ula A',
      jabatan: 'Guru Fathul Qorib',
      status: 'Hadir',
      timestamp: 1788307200000,
    },
    {
      id: 'rec-5',
      tanggal: '2026-09-02',
      idPps: 'PPS-004',
      nama: 'Ust. Nur Hidayatullah',
      kelas: 'Wustho B',
      jabatan: 'Guru Nadhom Imrithi',
      status: 'Sakit',
      alasan: 'Sakit',
      keterangan: 'Demam & istirahat di ndalem',
      timestamp: 1788307200000,
    },
    {
      id: 'rec-6',
      tanggal: '2026-09-02',
      idPps: 'PPS-009',
      nama: 'Ust. Bilal Manshur',
      kelas: 'Ula A',
      jabatan: 'Badal Guru',
      status: 'Alfa',
      alasan: 'Alasan Lain',
      keterangan: 'Belum ada konfirmasi ke TU',
      timestamp: 1788307200000,
    },
    {
      id: 'rec-7',
      tanggal: '2026-09-03',
      idPps: 'PPS-001',
      nama: 'Ust. H. Ahmad Fauzi, S.Pd.I',
      kelas: 'Ula A',
      jabatan: 'Guru Fathul Qorib',
      status: 'Hadir',
      timestamp: 1788393600000,
    },
    {
      id: 'rec-8',
      tanggal: '2026-09-03',
      idPps: 'PPS-002',
      nama: 'Ust. M. Hasan Basri',
      kelas: 'Ula B',
      jabatan: 'Guru Jurumiyyah',
      status: 'Hadir',
      timestamp: 1788393600000,
    },
    {
      id: 'rec-9',
      tanggal: '2026-09-03',
      idPps: 'PPS-003',
      nama: 'Ust. Abdul Karim Ma\'ruf',
      kelas: 'Wustho A',
      jabatan: 'Guru Matan Taqrib',
      status: 'Hadir',
      timestamp: 1788393600000,
    },
    {
      id: 'rec-10',
      tanggal: '2026-09-04',
      idPps: 'PPS-005',
      nama: 'Ustz. Hj. Siti Maryam',
      kelas: 'Majelis Banat',
      jabatan: 'Guru Akhlaq Lil Banat',
      status: 'Izin',
      alasan: 'Izin Bepergian',
      keterangan: 'Tugas Luar Kota',
      timestamp: 1788480000000,
    },
    {
      id: 'rec-11',
      tanggal: '2026-09-05',
      idPps: 'PPS-009',
      nama: 'Ust. Bilal Manshur',
      kelas: 'Ula A',
      jabatan: 'Badal Guru',
      status: 'Sakit',
      alasan: 'Sakit',
      keterangan: 'Surat dokter',
      timestamp: 1788566400000,
    },
    {
      id: 'rec-12',
      tanggal: '2026-09-06',
      idPps: 'PPS-004',
      nama: 'Ust. Nur Hidayatullah',
      kelas: 'Wustho B',
      jabatan: 'Guru Nadhom Imrithi',
      status: 'Alfa',
      alasan: 'Alasan Lain',
      keterangan: 'Tidak hadir tanpa kabar',
      timestamp: 1788652800000,
    },
    {
      id: 'rec-13',
      tanggal: '2026-09-07',
      idPps: 'PPS-001',
      nama: 'Ust. H. Ahmad Fauzi, S.Pd.I',
      kelas: 'Ula A',
      jabatan: 'Guru Fathul Qorib',
      status: 'Hadir',
      timestamp: 1788739200000,
    },
    {
      id: 'rec-14',
      tanggal: '2026-09-07',
      idPps: 'PPS-006',
      nama: 'Ust. M. Syukron Katsir',
      kelas: 'Ulya',
      jabatan: 'Guru Alfiyyah Ibnu Malik',
      status: 'Hadir',
      timestamp: 1788739200000,
    },
    {
      id: 'rec-15',
      tanggal: '2026-09-07',
      idPps: 'PPS-007',
      nama: 'Ust. K.H. Zainal Abidin',
      kelas: 'Ulya',
      jabatan: 'Mustahiq & Pembina Kitab',
      status: 'Hadir',
      timestamp: 1788739200000,
    },
  ];
  return records;
};

// Safe localStorage methods
export const getStoredPeserta = (): Peserta[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PESERTA);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(INITIAL_PESERTA));
      return INITIAL_PESERTA;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_PESERTA;
  } catch (e) {
    console.error('Error reading peserta from localStorage', e);
    return INITIAL_PESERTA;
  }
};

export const saveStoredPeserta = (peserta: Peserta[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(peserta));
  } catch (e) {
    console.error('Error saving peserta to localStorage', e);
  }
};

export const getStoredRecords = (): AttendanceRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) {
      const sample = getSampleRecords();
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(sample));
      return sample;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading records from localStorage', e);
    return [];
  }
};

export const saveStoredRecords = (records: AttendanceRecord[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving records to localStorage', e);
  }
};

export const getStoredHolidays = (): HolidaySettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HOLIDAYS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(INITIAL_HOLIDAYS));
      return INITIAL_HOLIDAYS;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : INITIAL_HOLIDAYS;
  } catch (e) {
    console.error('Error reading holidays from localStorage', e);
    return INITIAL_HOLIDAYS;
  }
};

export const saveStoredHolidays = (holidays: HolidaySettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
  } catch (e) {
    console.error('Error saving holidays to localStorage', e);
  }
};

export const getStoredActiveDays = (): MonthlyActiveDays => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_DAYS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DAYS, JSON.stringify(INITIAL_ACTIVE_DAYS));
      return INITIAL_ACTIVE_DAYS;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : INITIAL_ACTIVE_DAYS;
  } catch (e) {
    console.error('Error reading active days from localStorage', e);
    return INITIAL_ACTIVE_DAYS;
  }
};

export const saveStoredActiveDays = (activeDays: MonthlyActiveDays): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_DAYS, JSON.stringify(activeDays));
  } catch (e) {
    console.error('Error saving active days to localStorage', e);
  }
};

export const resetAllDataToDefault = (): void => {
  localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(INITIAL_PESERTA));
  localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(getSampleRecords()));
  localStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(INITIAL_HOLIDAYS));
  localStorage.setItem(STORAGE_KEYS.ACTIVE_DAYS, JSON.stringify(INITIAL_ACTIVE_DAYS));
};
