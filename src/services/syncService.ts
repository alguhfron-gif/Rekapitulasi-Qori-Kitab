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
import { db, auth, testFirestoreConnection } from '../firebase';
import {
  Peserta,
  AttendanceRecord,
  HolidaySettings,
  MonthlyActiveDays,
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
};

export const SETTINGS_DOCS = {
  HOLIDAYS: 'holidays',
  ACTIVE_DAYS: 'active_days',
};

// Clean undefined fields for Firestore safety
function sanitizeForFirestore<T extends object>(obj: T): T {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean as T;
}

/**
 * Check if cloud is empty, and if so seed from local storage or defaults
 */
export async function initializeCloudData(): Promise<void> {
  try {
    await testFirestoreConnection();

    const pesertaSnap = await getDocs(collection(db, COLLECTIONS.PESERTA));
    if (pesertaSnap.empty) {
      console.log('Seeding initial data to Firebase Firestore...');
      const batch = writeBatch(db);

      // Seed Peserta (from local storage if modified, or defaults)
      const localPeserta = getStoredPeserta();
      const initialPesertaList = localPeserta.length > 0 ? localPeserta : INITIAL_PESERTA;
      initialPesertaList.forEach((p) => {
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, sanitizeForFirestore(p));
      });

      // Seed Records
      const localRecords = getStoredRecords();
      localRecords.forEach((r) => {
        const ref = doc(db, COLLECTIONS.RECORDS, r.id);
        batch.set(ref, sanitizeForFirestore(r));
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
      console.log('Initial data successfully seeded to Firebase!');
    }
  } catch (error) {
    console.warn('Initial cloud seed skipped or encountered error (using local cache):', error);
  }
}

/**
 * Real-time listener for Peserta list
 */
export function subscribeToPeserta(
  callback: (data: Peserta[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, COLLECTIONS.PESERTA);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: Peserta[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Peserta);
      });
      // Sort logically by idPps
      items.sort((a, b) => a.idPps.localeCompare(b.idPps, undefined, { numeric: true }));
      // Also cache to localStorage for instant offline boots
      saveStoredPeserta(items);
      callback(items);
    },
    (err) => {
      console.error('Firestore Peserta snapshot error:', err);
      onError?.(err);
    }
  );
}

/**
 * Real-time listener for Attendance Records
 */
export function subscribeToRecords(
  callback: (data: AttendanceRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, COLLECTIONS.RECORDS);
  const q = query(colRef, orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as AttendanceRecord);
      });
      // Cache to localStorage
      saveStoredRecords(items);
      callback(items);
    },
    (err) => {
      console.error('Firestore Records snapshot error:', err);
      onError?.(err);
    }
  );
}

/**
 * Real-time listener for Holidays settings
 */
export function subscribeToHolidays(
  callback: (data: HolidaySettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as HolidaySettings;
        saveStoredHolidays(data);
        callback(data);
      } else {
        callback(INITIAL_HOLIDAYS);
      }
    },
    (err) => {
      console.error('Firestore Holidays snapshot error:', err);
      onError?.(err);
    }
  );
}

/**
 * Real-time listener for Active Days settings
 */
export function subscribeToActiveDays(
  callback: (data: MonthlyActiveDays) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()?.days as MonthlyActiveDays;
        if (data) {
          saveStoredActiveDays(data);
          callback(data);
        }
      } else {
        callback(INITIAL_ACTIVE_DAYS);
      }
    },
    (err) => {
      console.error('Firestore ActiveDays snapshot error:', err);
      onError?.(err);
    }
  );
}

// ----------------- MUTATION FUNCTIONS (SYNC TO CLOUD & HP) -----------------

export async function cloudSavePeserta(peserta: Peserta): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.PESERTA, peserta.id);
    await setDoc(docRef, sanitizeForFirestore(peserta), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.PESERTA}/${peserta.id}`);
  }
}

export async function cloudDeletePeserta(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.PESERTA, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.PESERTA}/${id}`);
  }
}

export async function cloudReplaceAllPeserta(newPesertaList: Peserta[]): Promise<void> {
  try {
    // Delete existing
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
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, sanitizeForFirestore(p));
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.PESERTA);
  }
}

export async function cloudSaveRecord(record: AttendanceRecord): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.RECORDS, record.id);
    await setDoc(docRef, sanitizeForFirestore(record), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTIONS.RECORDS}/${record.id}`);
  }
}

export async function cloudDeleteRecord(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.RECORDS, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTIONS.RECORDS}/${id}`);
  }
}

export async function cloudBulkSaveRecords(records: AttendanceRecord[]): Promise<void> {
  try {
    const chunkSize = 450;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const docRef = doc(db, COLLECTIONS.RECORDS, rec.id);
        batch.set(docRef, sanitizeForFirestore(rec), { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.RECORDS);
  }
}

export async function cloudSaveHolidays(holidays: HolidaySettings): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
    await setDoc(docRef, sanitizeForFirestore(holidays), { merge: true });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${COLLECTIONS.SETTINGS}/${SETTINGS_DOCS.HOLIDAYS}`
    );
  }
}

export async function cloudSaveActiveDays(activeDays: MonthlyActiveDays): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
    await setDoc(docRef, { days: activeDays }, { merge: true });
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `${COLLECTIONS.SETTINGS}/${SETTINGS_DOCS.ACTIVE_DAYS}`
    );
  }
}

/**
 * Forcefully sync ALL current local data into Firebase Firestore
 */
export async function syncAllDataToCloud(
  pesertaList: Peserta[],
  records: AttendanceRecord[],
  holidays: HolidaySettings,
  activeDays: MonthlyActiveDays
): Promise<{ pesertaCount: number; recordsCount: number }> {
  try {
    // 1. Sync Peserta in chunks
    const chunkSize = 450;
    for (let i = 0; i < pesertaList.length; i += chunkSize) {
      const chunk = pesertaList.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((p) => {
        const ref = doc(db, COLLECTIONS.PESERTA, p.id);
        batch.set(ref, sanitizeForFirestore(p), { merge: true });
      });
      await batch.commit();
    }

    // 2. Sync Attendance Records in chunks
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rec) => {
        const ref = doc(db, COLLECTIONS.RECORDS, rec.id);
        batch.set(ref, sanitizeForFirestore(rec), { merge: true });
      });
      await batch.commit();
    }

    // 3. Sync Settings
    const settingsBatch = writeBatch(db);
    const holidaysRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.HOLIDAYS);
    settingsBatch.set(holidaysRef, sanitizeForFirestore(holidays), { merge: true });

    const activeDaysRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOCS.ACTIVE_DAYS);
    settingsBatch.set(activeDaysRef, { days: activeDays }, { merge: true });
    await settingsBatch.commit();

    console.log(
      `Sync all data to Firebase completed: ${pesertaList.length} peserta, ${records.length} records.`
    );
    return {
      pesertaCount: pesertaList.length,
      recordsCount: records.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'all_collections');
  }
}

export async function cloudResetAllData(): Promise<void> {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'reset_all');
  }
}
