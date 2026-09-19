export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';

export type AttendanceReason = 'Sakit' | 'Izin Bepergian' | 'Alasan Lain' | '';

export const KELAS_OPTIONS = [
  'Aliyah',
  'Tsanawiyah 3',
  'Tsanawiyah 2',
  'Tsanawiyah 1',
  'Ibtidaiyah 6',
  'Ibtidaiyah 5',
  'Ibtidaiyah 4',
  'Ibtidaiyah 1-3',
  'Idadiyah PK',
  'Idadiyah Reguler',
  'Idadiyah Takhossus',
  'Umum',
] as const;

export const MAJLIS_OPTIONS = [
  'Majlis Utama',
  'Majlis Al-Fath',
  'Majlis Al-Ihsan',
  'Majlis An-Nur',
  'Majlis Raudhah',
  'Majlis Darussalam',
  'Majlis Al-Barokah',
  'Umum',
] as const;

export const TINGKAT_MAJLIS_LIST = KELAS_OPTIONS;
export type TingkatMajlis = (typeof TINGKAT_MAJLIS_LIST)[number];

export interface Peserta {
  id: string; // unique ID
  idPps: string; // 1. ID Pps
  nama: string; // 2. Nama
  dom: string; // 3. Dom (Domisili / Asal Daerah / Asrama)
  kelas: string; // 4. Kelas
  majlis: string; // 5. Majlis
  jabatan: string; // 6. Jabatan
  createdAt?: string;
}

export interface AttendanceRecord {
  id: string;
  tanggal: string; // Format: YYYY-MM-DD
  idPps: string; // 1. ID Pps
  nama: string; // 2. Nama
  dom: string; // 3. Dom
  kelas: string; // 4. Kelas
  majlis: string; // 5. Majlis
  jabatan: string; // 6. Jabatan
  status: AttendanceStatus;
  alasan?: AttendanceReason;
  keterangan?: string;
  timestamp: number;
}

export interface SpecialHoliday {
  id: string;
  tanggal: string; // YYYY-MM-DD
  keterangan: string; // e.g. "Maulid Nabi", "Libur Awal Ramadhan"
}

export interface HolidaySettings {
  routineSeninMalam: boolean;
  routineKamisMalam: boolean;
  specialHolidays: SpecialHoliday[];
}

export interface MonthlyActiveDays {
  [yearMonth: string]: number; // key: "YYYY-MM" or "1448-03" (Hijri), value: number of active days
}

export interface RekapPesertaItem {
  idPps: string; // 1. ID Pps
  nama: string; // 2. Nama
  dom: string; // 3. Dom
  kelas: string; // 4. Kelas
  majlis: string; // 5. Majlis
  jabatan: string; // 6. Jabatan
  hariAktif: number;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  persentaseKehadiran: number;
  persentaseRounded10: number; // e.g. 100, 90, 80, 70, 60
  trendPanah: 'up' | 'flat' | 'down'; // e.g. ▲, ▬, ▼
  detailTanggalIzin?: string;
  detailAlasan?: string;
}

export interface SessionLog {
  id: string;
  action: string;
  tanggal?: string;
  detail: string;
  totalRecords?: number;
  timestamp: number;
}

