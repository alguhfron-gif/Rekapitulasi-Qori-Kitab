import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import {
  ref as rtdbRef,
  set as rtdbSet,
  remove as rtdbRemove,
  onValue as rtdbOnValue,
} from 'firebase/database';
import { db, rtdb, auth, testFirestoreConnection, testRtdbConnection } from '../firebase';
import {
  Peserta,
  AttendanceRecord,
  HolidaySettings,
  MonthlyActiveDays,
  SessionLog,
} from '../types';
import {
  INITIAL_PESERTA,
  INITIAL_HOLIDAYS,
  INITIAL_ACTIVE_DAYS,
  getStoredPeserta,
  getStoredRecords,
  getStoredHolidays,
  getStoredActiveDays,
  saveStoredPeserta,
  saveStoredRecords,
  saveStoredHolidays,
  saveStoredActiveDays,
} from '../utils/storage';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const COLLECTIONS = {
  PESERTA: 'peserta',
  RECORDS: 'attendance_records',
  SETTINGS: 'settings',
  LOGS: 'session_logs',
};

export const SETTINGS_DOCS = {
  HOLIDAYS: 'holidays',
  ACTIVE_DAYS: 'active_days',
};

// Clean undefined fields for Firestore / RTDB safety
function sanitizeForFirestore<T extends object>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean as T;
}

// Safe mirror helper for Realtime Database
async function mirrorToRtdb(path: string, value: unknown): Promise<void> {
  try {
    const targetRef = rtdbRef(rtdb, path);
    if (value === null) {
      await rtdbRemove(targetRef);
    } else {
      await rtdbSet(targetRef, value);
    }
  } catch {
    // Non-blocking mirror
  }
}

/**
 * Check if cloud is empty, and if so seed from local storage or defaults
 */
export async function initializeCloudData(): Promise<void> {
  try {
    await testFirestoreConnection();
    testRtdbConnection().catch(() => {});

    const pesertaSnap = await getDocs(collection(db, COLLECTIONS.PESERTA));
    if (pesertaSnap.empty) {
      const batch = writeBatch(db);

      // Seed Peserta (from local storage if modified, or defaults)
      const localPeserta = getStoredPeserta();
      const initialPesertaList = localPeserta.length > 0 ? localPeserta : INITIAL_PESERTA;
      const pesertaMap: Record<string, Peserta> = {};
      initialPesertaList.forEach((p) => {
        const cleanP = sanitizeForFirestore(p);
        pesertaMap[p.id] = cleanP;
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, cleanP);
      });

      // Seed Records
      const localRecords = getStoredRecords();
      const recordsMap: Record<string, AttendanceRecord> = {};
      localRecords.forEach((r) => {
        const cleanR = sanitizeForFirestore(r);
        recordsMap[r.id] = cleanR;
        const ref = doc(db, COLLECTIONS.RECORDS, r.id);
        batch.set(ref, cleanR);
      });

      // Seed Holidays
      const localHolidays = getStoredHolidays() || INITIAL_HOLIDAYS;
      const holidaysRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
      batch.set(holidaysRef, sanitizeForFirestore(localHolidays));

      // Seed Active Days
      const localActiveDays = getStoredActiveDays() || INITIAL_ACTIVE_DAYS;
      const activeDaysRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
      batch.set(activeDaysRef, { days: localActiveDays });

      await batch.commit();

      // Mirror to RTDB
      mirrorToRtdb('peserta', pesertaMap);
      mirrorToRtdb('attendance_records', recordsMap);
      mirrorToRtdb('settings/holidays', sanitizeForFirestore(localHolidays));
      mirrorToRtdb('settings/active_days', { days: localActiveDays });
      mirrorToRtdb('last_sync', {
        timestamp: Date.now(),
        iso: new Date().toISOString(),
        totalPeserta: initialPesertaList.length,
        totalRecords: localRecords.length,
      });
    }
  } catch {
    // Graceful fallback to local cache
  }
}

/**
 * Real-time listener for Peserta list
 */
export function subscribeToPeserta(
  callback: (data: Peserta[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let rtdbUnsub: (() => void) | null = null;

  const fallbackToRtdb = () => {
    if (rtdbUnsub) return;
    try {
      const pRef = rtdbRef(rtdb, 'peserta');
      rtdbUnsub = rtdbOnValue(
        pRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const rawItems: Peserta[] = Array.isArray(val)
              ? val.filter(Boolean)
              : Object.values(val || {});
            const items: Peserta[] = rawItems.filter((p) => p && typeof p === 'object').map((p) => ({
              ...p,
              id: p.id || `p-${p.idPps || Math.random().toString(36).substring(2, 7)}`,
              idPps: String(p.idPps || ''),
              nama: String(p.nama || ''),
              dom: p.dom || 'Bangkalan',
              kelas: p.kelas || '',
              majlis: p.majlis || 'Majlis Utama',
              jabatan: p.jabatan || '',
            }));
            items.sort((a, b) => (a.idPps || '').localeCompare(b.idPps || '', undefined, { numeric: true }));
            if (items.length > 0) {
              saveStoredPeserta(items);
              callback(items);
            }
          }
        },
        () => {
          // RTDB listener fallback
        }
      );
    } catch {
      // Ignore
    }
  };

  const colRef = collection(db, COLLECTIONS.PESERTA);
  const firestoreUnsub = onSnapshot(
    colRef,
    (snapshot) => {
      const items: Peserta[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Peserta;
        if (data && typeof data === 'object') {
          items.push({
            ...data,
            id: data.id || docSnap.id,
            idPps: String(data.idPps || ''),
            nama: String(data.nama || ''),
            dom: data.dom || 'Bangkalan',
            kelas: data.kelas || '',
            majlis: data.majlis || 'Majlis Utama',
            jabatan: data.jabatan || '',
          });
        }
      });
      // Sort logically by idPps safely
      items.sort((a, b) => (a.idPps || '').localeCompare(b.idPps || '', undefined, { numeric: true }));
      // Also cache to localStorage for instant offline boots
      saveStoredPeserta(items);
      callback(items);
    },
    (err) => {
      fallbackToRtdb();
      onError?.(err);
    }
  );

  return () => {
    firestoreUnsub();
    if (rtdbUnsub) rtdbUnsub();
  };
}

/**
 * Real-time listener for Attendance Records
 */
export function subscribeToRecords(
  callback: (data: AttendanceRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let rtdbUnsub: (() => void) | null = null;

  const fallbackToRtdb = () => {
    if (rtdbUnsub) return;
    try {
      const recRef = rtdbRef(rtdb, 'attendance_records');
      rtdbUnsub = rtdbOnValue(
        recRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const items: AttendanceRecord[] = Array.isArray(val)
              ? val.filter(Boolean)
              : Object.values(val || {});
            items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            saveStoredRecords(items);
            callback(items);
          }
        },
        () => {
          // RTDB records listener fallback
        }
      );
    } catch {
      // Ignore
    }
  };

  const colRef = collection(db, COLLECTIONS.RECORDS);
  const q = query(colRef, orderBy('timestamp', 'desc'));
  const firestoreUnsub = onSnapshot(
    q,
    (snapshot) => {
      const items: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data() as AttendanceRecord;
        if (d && typeof d === 'object') {
          items.push({
            ...d,
            id: d.id || docSnap.id,
            tanggal: String(d.tanggal || ''),
            idPps: String(d.idPps || ''),
            nama: String(d.nama || ''),
            dom: String(d.dom || '-'),
            kelas: String(d.kelas || ''),
            majlis: String(d.majlis || 'Majlis Utama'),
            jabatan: String(d.jabatan || ''),
            status: d.status || 'Hadir',
            alasan: d.alasan || '',
            keterangan: d.keterangan || '',
            timestamp: Number(d.timestamp || Date.now()),
          });
        }
      });
      // Cache to localStorage
      saveStoredRecords(items);
      callback(items);
    },
    (err) => {
      fallbackToRtdb();
      onError?.(err);
    }
  );

  return () => {
    firestoreUnsub();
    if (rtdbUnsub) rtdbUnsub();
  };
}

/**
 * Real-time listener for Holidays settings
 */
export function subscribeToHolidays(
  callback: (data: HolidaySettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let rtdbUnsub: (() => void) | null = null;

  const fallbackToRtdb = () => {
    if (rtdbUnsub) return;
    try {
      const hRef = rtdbRef(rtdb, 'settings/holidays');
      rtdbUnsub = rtdbOnValue(
        hRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val() as HolidaySettings;
            if (data && typeof data === 'object') {
              const safe: HolidaySettings = {
                routineSeninMalam: data.routineSeninMalam ?? true,
                routineKamisMalam: data.routineKamisMalam ?? true,
                specialHolidays: Array.isArray(data.specialHolidays) ? data.specialHolidays : [],
              };
              saveStoredHolidays(safe);
              callback(safe);
            }
          }
        },
        () => {
          // RTDB holidays fallback
        }
      );
    } catch {
      // Ignore
    }
  };

  const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
  const firestoreUnsub = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as HolidaySettings;
        const safe: HolidaySettings = {
          routineSeninMalam: data?.routineSeninMalam ?? true,
          routineKamisMalam: data?.routineKamisMalam ?? true,
          specialHolidays: Array.isArray(data?.specialHolidays) ? data.specialHolidays : [],
        };
        saveStoredHolidays(safe);
        callback(safe);
      } else {
        callback(INITIAL_HOLIDAYS);
      }
    },
    (err) => {
      fallbackToRtdb();
      onError?.(err);
    }
  );

  return () => {
    firestoreUnsub();
    if (rtdbUnsub) rtdbUnsub();
  };
}

/**
 * Real-time listener for Active Days settings
 */
export function subscribeToActiveDays(
  callback: (data: MonthlyActiveDays) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  let rtdbUnsub: (() => void) | null = null;

  const fallbackToRtdb = () => {
    if (rtdbUnsub) return;
    try {
      const aRef = rtdbRef(rtdb, 'settings/active_days');
      rtdbUnsub = rtdbOnValue(
        aRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const val = snapshot.val();
            const data = (val?.days && typeof val.days === 'object' ? val.days : val) as MonthlyActiveDays;
            if (data && typeof data === 'object') {
              saveStoredActiveDays(data);
              callback(data);
            }
          }
        },
        () => {
          // RTDB active_days fallback
        }
      );
    } catch {
      // Ignore
    }
  };

  const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
  const firestoreUnsub = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.data();
        const data = (raw?.days && typeof raw.days === 'object' ? raw.days : raw) as MonthlyActiveDays;
        if (data && typeof data === 'object') {
          saveStoredActiveDays(data);
          callback(data);
        }
      } else {
        callback(INITIAL_ACTIVE_DAYS);
      }
    },
    (err) => {
      fallbackToRtdb();
      onError?.(err);
    }
  );

  return () => {
    firestoreUnsub();
    if (rtdbUnsub) rtdbUnsub();
  };
}

/**
 * Real-time listener for Session Logs
 */
export function subscribeToSessionLogs(
  callback: (data: SessionLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, COLLECTIONS.LOGS);
  const q = query(colRef, orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SessionLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SessionLog;
        if (data && typeof data === 'object') {
          items.push({
            id: data.id || docSnap.id,
            action: data.action || 'Presensi',
            detail: data.detail || '',
            tanggal: data.tanggal || '',
            totalRecords: data.totalRecords || 0,
            timestamp: data.timestamp || Date.now(),
          });
        }
      });
      callback(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

// ----------------- MUTATION FUNCTIONS (SYNC TO CLOUD & HP) -----------------

export async function cloudLogSession(
  action: string,
  detail: string,
  tanggal?: string,
  totalRecords?: number
): Promise<void> {
  const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const logData: SessionLog = {
    id: logId,
    action,
    detail,
    tanggal: tanggal || new Date().toISOString().split('T')[0],
    totalRecords: totalRecords ?? 0,
    timestamp: Date.now(),
  };
  const clean = sanitizeForFirestore(logData);
  try {
    const docRef = doc(db, COLLECTIONS.LOGS, logId);
    await setDoc(docRef, clean);
  } catch {
    // Non-blocking
  }
  await mirrorToRtdb(`session_logs/${logId}`, clean);
}

export async function cloudSavePeserta(peserta: Peserta): Promise<void> {
  const safeData: Peserta = {
    id: peserta.id,
    idPps: String(peserta.idPps || '').trim(),
    nama: String(peserta.nama || 'Tanpa Nama').trim(),
    dom: String(peserta.dom || 'Bangkalan').trim(),
    kelas: String(peserta.kelas || '').trim(),
    majlis: String(peserta.majlis || 'Majlis Utama').trim(),
    jabatan: String(peserta.jabatan || '').trim(),
    createdAt: peserta.createdAt || new Date().toISOString(),
  };
  const clean = sanitizeForFirestore(safeData);
  try {
    const docRef = doc(db, COLLECTIONS.PESERTA, safeData.id);
    await setDoc(docRef, clean, { merge: true });
  } catch {
    // Handled gracefully
  }
  // Dual sync to Realtime Database
  await mirrorToRtdb(`peserta/${safeData.id}`, clean);
}

export async function cloudBulkSavePeserta(pesertaList: Peserta[]): Promise<void> {
  if (!pesertaList || pesertaList.length === 0) return;
  const pesertaMap: Record<string, Peserta> = {};
  pesertaList.forEach((p) => {
    pesertaMap[p.id] = sanitizeForFirestore({
      id: p.id,
      idPps: String(p.idPps || '').trim(),
      nama: String(p.nama || 'Tanpa Nama').trim(),
      dom: String(p.dom || 'Bangkalan').trim(),
      kelas: String(p.kelas || '').trim(),
      majlis: String(p.majlis || 'Majlis Utama').trim(),
      jabatan: String(p.jabatan || '').trim(),
      createdAt: p.createdAt || new Date().toISOString(),
    });
  });

  try {
    const chunkSize = 450;
    for (let i = 0; i < pesertaList.length; i += chunkSize) {
      const chunk = pesertaList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((p) => {
        const clean = sanitizeForFirestore({
          id: p.id,
          idPps: String(p.idPps || '').trim(),
          nama: String(p.nama || 'Tanpa Nama').trim(),
          dom: String(p.dom || 'Bangkalan').trim(),
          kelas: String(p.kelas || '').trim(),
          majlis: String(p.majlis || 'Majlis Utama').trim(),
          jabatan: String(p.jabatan || '').trim(),
          createdAt: p.createdAt || new Date().toISOString(),
        });
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, clean, { merge: true });
      });
      await batch.commit();
    }
  } catch {
    // Handled gracefully
  }

  for (const [id, val] of Object.entries(pesertaMap)) {
    await mirrorToRtdb(`peserta/${id}`, val);
  }
}

export async function cloudDeletePeserta(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.PESERTA, id);
    await deleteDoc(docRef);
  } catch {
    // Handled gracefully
  }
  // Remove from Realtime Database
  await mirrorToRtdb(`peserta/${id}`, null);
}

export async function cloudDeleteMultiplePeserta(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    const chunkSize = 450;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const docRef = doc(db, COLLECTIONS.PESERTA, id);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  } catch {
    // Handled gracefully
  }
  // Remove from RTDB
  for (const id of ids) {
    await mirrorToRtdb(`peserta/${id}`, null);
  }
}

export async function cloudReplaceAllPeserta(newPesertaList: Peserta[]): Promise<void> {
  const pesertaMap: Record<string, Peserta> = {};
  newPesertaList.forEach((p) => {
    pesertaMap[p.id] = sanitizeForFirestore({
      id: p.id,
      idPps: String(p.idPps || '').trim(),
      nama: String(p.nama || 'Tanpa Nama').trim(),
      dom: String(p.dom || 'Bangkalan').trim(),
      kelas: String(p.kelas || '').trim(),
      majlis: String(p.majlis || 'Majlis Utama').trim(),
      jabatan: String(p.jabatan || '').trim(),
      createdAt: p.createdAt || new Date().toISOString(),
    });
  });

  try {
    // Delete existing from Firestore
    const existing = await getDocs(collection(db, COLLECTIONS.PESERTA));
    const batchDelete = writeBatch(db);
    existing.forEach((d) => batchDelete.delete(d.ref));
    await batchDelete.commit();

    // Insert new in chunks of 450
    const chunkSize = 450;
    for (let i = 0; i < newPesertaList.length; i += chunkSize) {
      const chunk = newPesertaList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((p) => {
        const clean = sanitizeForFirestore({
          id: p.id,
          idPps: String(p.idPps || '').trim(),
          nama: String(p.nama || 'Tanpa Nama').trim(),
          dom: String(p.dom || 'Bangkalan').trim(),
          kelas: String(p.kelas || '').trim(),
          majlis: String(p.majlis || 'Majlis Utama').trim(),
          jabatan: String(p.jabatan || '').trim(),
          createdAt: p.createdAt || new Date().toISOString(),
        });
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, clean);
      });
      await batch.commit();
    }
  } catch {
    // Handled gracefully
  }

  // Sync to Realtime Database
  await mirrorToRtdb('peserta', pesertaMap);
  await cloudLogSession('Import / Ganti Peserta', `Menyinkronkan ${newPesertaList.length} asatidz master data ke cloud`);
}

export async function cloudSaveRecord(record: AttendanceRecord): Promise<void> {
  const safeRecord: AttendanceRecord = {
    id: record.id,
    tanggal: String(record.tanggal || ''),
    idPps: String(record.idPps || ''),
    nama: String(record.nama || 'Tanpa Nama'),
    dom: String(record.dom || '-'),
    kelas: String(record.kelas || '-'),
    majlis: String(record.majlis || 'Majlis Utama'),
    jabatan: String(record.jabatan || '-'),
    status: record.status || 'Hadir',
    alasan: record.alasan || '',
    keterangan: record.keterangan || '',
    timestamp: Number(record.timestamp || Date.now()),
  };
  const clean = sanitizeForFirestore(safeRecord);
  try {
    const docRef = doc(db, COLLECTIONS.RECORDS, safeRecord.id);
    await setDoc(docRef, clean, { merge: true });
  } catch {
    // Handled gracefully
  }
  // Dual sync to Realtime Database
  await mirrorToRtdb(`attendance_records/${safeRecord.id}`, clean);
}

export async function cloudDeleteRecord(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.RECORDS, id);
    await deleteDoc(docRef);
  } catch {
    // Handled gracefully
  }
  // Remove from Realtime Database
  await mirrorToRtdb(`attendance_records/${id}`, null);
}

export async function cloudDeleteMultipleRecords(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    const chunkSize = 450;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((id) => {
        const docRef = doc(db, COLLECTIONS.RECORDS, id);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  } catch {
    // Handled gracefully
  }
  // Remove from Realtime Database
  for (const id of ids) {
    await mirrorToRtdb(`attendance_records/${id}`, null);
  }
  await cloudLogSession('Hapus Presensi', `Menghapus ${ids.length} catatan riwayat presensi`);
}

export async function cloudBulkSaveRecords(records: AttendanceRecord[]): Promise<void> {
  const recordsMap: Record<string, AttendanceRecord> = {};
  records.forEach((rec) => {
    recordsMap[rec.id] = sanitizeForFirestore({
      id: rec.id,
      tanggal: String(rec.tanggal || ''),
      idPps: String(rec.idPps || ''),
      nama: String(rec.nama || 'Tanpa Nama'),
      dom: String(rec.dom || '-'),
      kelas: String(rec.kelas || '-'),
      majlis: String(rec.majlis || 'Majlis Utama'),
      jabatan: String(rec.jabatan || '-'),
      status: rec.status || 'Hadir',
      alasan: rec.alasan || '',
      keterangan: rec.keterangan || '',
      timestamp: Number(rec.timestamp || Date.now()),
    });
  });

  try {
    const chunkSize = 450;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const clean = sanitizeForFirestore({
          id: rec.id,
          tanggal: String(rec.tanggal || ''),
          idPps: String(rec.idPps || ''),
          nama: String(rec.nama || 'Tanpa Nama'),
          dom: String(rec.dom || '-'),
          kelas: String(rec.kelas || '-'),
          majlis: String(rec.majlis || 'Majlis Utama'),
          jabatan: String(rec.jabatan || '-'),
          status: rec.status || 'Hadir',
          alasan: rec.alasan || '',
          keterangan: rec.keterangan || '',
          timestamp: Number(rec.timestamp || Date.now()),
        });
        const docRef = doc(db, COLLECTIONS.RECORDS, rec.id);
        batch.set(docRef, clean, { merge: true });
      });
      await batch.commit();
    }
  } catch {
    // Handled gracefully
  }

  // Dual sync records to Realtime Database
  for (const [id, val] of Object.entries(recordsMap)) {
    await mirrorToRtdb(`attendance_records/${id}`, val);
  }

  if (records.length > 0) {
    await cloudLogSession(
      'Bulk Presensi',
      `Menyimpan massal ${records.length} presensi pada tanggal ${records[0].tanggal}`,
      records[0].tanggal,
      records.length
    );
  }
}

export async function cloudSaveHolidays(holidays: HolidaySettings): Promise<void> {
  const clean: HolidaySettings = {
    routineSeninMalam: holidays.routineSeninMalam ?? true,
    routineKamisMalam: holidays.routineKamisMalam ?? true,
    specialHolidays: Array.isArray(holidays.specialHolidays) ? holidays.specialHolidays : [],
  };
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
    await setDoc(docRef, clean, { merge: true });
  } catch {
    // Handled gracefully
  }
  await mirrorToRtdb('settings/holidays', clean);
  await cloudLogSession('Update Libur', 'Memperbarui pengaturan libur rutin dan libur khusus');
}

export async function cloudSaveActiveDays(activeDays: MonthlyActiveDays): Promise<void> {
  const safeDays = typeof activeDays === 'object' && activeDays ? activeDays : {};
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
    await setDoc(docRef, { days: safeDays }, { merge: true });
  } catch {
    // Handled gracefully
  }
  await mirrorToRtdb('settings/active_days', { days: safeDays });
  await cloudLogSession('Penyesuaian Hari Aktif', 'Memperbarui kalender hari aktif bulanan');
}

/**
 * Forcefully sync ALL current local data into Firebase Firestore & Realtime Database
 */
export async function syncAllDataToCloud(
  pesertaList: Peserta[],
  records: AttendanceRecord[],
  holidays: HolidaySettings,
  activeDays: MonthlyActiveDays
): Promise<{ pesertaCount: number; recordsCount: number }> {
  // 1. Prepare data maps
  const pesertaMap: Record<string, Peserta> = {};
  pesertaList.forEach((p) => {
    pesertaMap[p.id] = sanitizeForFirestore({
      id: p.id,
      idPps: String(p.idPps || '').trim(),
      nama: String(p.nama || 'Tanpa Nama').trim(),
      dom: String(p.dom || 'Bangkalan').trim(),
      kelas: String(p.kelas || '').trim(),
      majlis: String(p.majlis || 'Majlis Utama').trim(),
      jabatan: String(p.jabatan || '').trim(),
      createdAt: p.createdAt || new Date().toISOString(),
    });
  });

  const recordsMap: Record<string, AttendanceRecord> = {};
  records.forEach((r) => {
    recordsMap[r.id] = sanitizeForFirestore({
      id: r.id,
      tanggal: String(r.tanggal || ''),
      idPps: String(r.idPps || ''),
      nama: String(r.nama || 'Tanpa Nama'),
      dom: String(r.dom || '-'),
      kelas: String(r.kelas || '-'),
      majlis: String(r.majlis || 'Majlis Utama'),
      jabatan: String(r.jabatan || '-'),
      status: r.status || 'Hadir',
      alasan: r.alasan || '',
      keterangan: r.keterangan || '',
      timestamp: Number(r.timestamp || Date.now()),
    });
  });

  const cleanHolidays: HolidaySettings = {
    routineSeninMalam: holidays.routineSeninMalam ?? true,
    routineKamisMalam: holidays.routineKamisMalam ?? true,
    specialHolidays: Array.isArray(holidays.specialHolidays) ? holidays.specialHolidays : [],
  };

  const safeActiveDays = typeof activeDays === 'object' && activeDays ? activeDays : {};

  // 2. Try Firestore Sync in batches
  try {
    const chunkSize = 450;
    for (let i = 0; i < pesertaList.length; i += chunkSize) {
      const chunk = pesertaList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((p) => {
        const cleanP = sanitizeForFirestore({
          id: p.id,
          idPps: String(p.idPps || '').trim(),
          nama: String(p.nama || 'Tanpa Nama').trim(),
          dom: String(p.dom || 'Bangkalan').trim(),
          kelas: String(p.kelas || '').trim(),
          majlis: String(p.majlis || 'Majlis Utama').trim(),
          jabatan: String(p.jabatan || '').trim(),
          createdAt: p.createdAt || new Date().toISOString(),
        });
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, cleanP, { merge: true });
      });
      await batch.commit();
    }

    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const cleanRec = sanitizeForFirestore({
          id: rec.id,
          tanggal: String(rec.tanggal || ''),
          idPps: String(rec.idPps || ''),
          nama: String(rec.nama || 'Tanpa Nama'),
          dom: String(rec.dom || '-'),
          kelas: String(rec.kelas || '-'),
          majlis: String(rec.majlis || 'Majlis Utama'),
          jabatan: String(rec.jabatan || '-'),
          status: rec.status || 'Hadir',
          alasan: rec.alasan || '',
          keterangan: rec.keterangan || '',
          timestamp: Number(rec.timestamp || Date.now()),
        });
        const ref = doc(db, COLLECTIONS.RECORDS, rec.id);
        batch.set(ref, cleanRec, { merge: true });
      });
      await batch.commit();
    }

    const settingsBatch = writeBatch(db);
    const holidaysRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
    settingsBatch.set(holidaysRef, cleanHolidays, { merge: true });

    const activeDaysRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
    settingsBatch.set(activeDaysRef, { days: safeActiveDays }, { merge: true });
    await settingsBatch.commit();
  } catch {
    // Handled gracefully
  }

  // 3. Dual sync to Realtime Database
  await mirrorToRtdb('peserta', pesertaMap);
  await mirrorToRtdb('attendance_records', recordsMap);
  await mirrorToRtdb('settings/holidays', cleanHolidays);
  await mirrorToRtdb('settings/active_days', { days: safeActiveDays });
  await mirrorToRtdb('last_sync', {
    timestamp: Date.now(),
    iso: new Date().toISOString(),
    pesertaCount: pesertaList.length,
    recordsCount: records.length,
    status: 'Tersinkron Realtime',
  });

  await cloudLogSession(
    'Sinkronisasi Penuh Cloud',
    `Sinkronisasi penuh ${pesertaList.length} asatidz dan ${records.length} catatan presensi`,
    new Date().toISOString().split('T')[0],
    records.length
  );

  return {
    pesertaCount: pesertaList.length,
    recordsCount: records.length,
  };
}

export async function cloudResetAllData(): Promise<void> {
  const defaultPesertaMap: Record<string, Peserta> = {};
  INITIAL_PESERTA.forEach((p) => {
    defaultPesertaMap[p.id] = sanitizeForFirestore(p);
  });

  try {
    const batch = writeBatch(db);

    // Clear existing peserta
    const pSnap = await getDocs(collection(db, COLLECTIONS.PESERTA));
    pSnap.forEach((d) => batch.delete(d.ref));

    // Clear existing records
    const rSnap = await getDocs(collection(db, COLLECTIONS.RECORDS));
    rSnap.forEach((d) => batch.delete(d.ref));

    // Reset peserta to default
    INITIAL_PESERTA.forEach((p) => {
      const ref = doc(db, COLLECTIONS.PESERTA, p.id);
      batch.set(ref, sanitizeForFirestore(p));
    });

    // Reset holidays & active days
    batch.set(
      doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS),
      sanitizeForFirestore(INITIAL_HOLIDAYS)
    );
    batch.set(doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS), {
      days: INITIAL_ACTIVE_DAYS,
    });

    await batch.commit();
  } catch {
    // Handled gracefully
  }

  // Reset RTDB
  await mirrorToRtdb('peserta', defaultPesertaMap);
  await mirrorToRtdb('attendance_records', {});
  await mirrorToRtdb('settings/holidays', sanitizeForFirestore(INITIAL_HOLIDAYS));
  await mirrorToRtdb('settings/active_days', { days: INITIAL_ACTIVE_DAYS });
}
