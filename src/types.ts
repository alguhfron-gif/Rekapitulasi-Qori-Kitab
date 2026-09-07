export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa';

export type AttendanceReason = 'Sakit' | 'Izin Bepergian' | 'Alasan Lain' | '';

export const TINGKAT_MAJLIS_LIST = [
  'Aliyah',
  'Tsanawiyah Kelas III',
  'Tsanawiyah Kelas II',
  'Tsanawiyah Kelas I',
  'Ibtidaiyah Kelas 6',
  'Ibtidaiyah Kelas 5',
  'Ibtidaiyah Kelas 4',
  'Ibtidaiyah 1-3',
  'Idadiyah PK',
  'Idadiyah Reguler',
  'Idadiyah Takhossus',
] as const;

export type TingkatMajlis = (typeof TINGKAT_MAJLIS_LIST)[number];

export interface Peserta {
  id: string; // unique ID or timestamp
  idPps: string; // e.g. "PPS-001", "1023", etc.
  nama: string;
  kelas: string; // e.g. Tingkat majlis
  jabatan: string; // e.g. "Guru Fathul Qorib", "Mustahiq", "Badal Guru"
  createdAt?: string;
}

export interface AttendanceRecord {
  id: string;
  tanggal: string; // Format: YYYY-MM-DD
  idPps: string;
  nama: string;
  kelas: string;
  jabatan: string;
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
  idPps: string;
  nama: string;
  kelas: string;
  jabatan: string;
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

