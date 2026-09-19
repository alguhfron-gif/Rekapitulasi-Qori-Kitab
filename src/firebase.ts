import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getDatabase, ref, get } from 'firebase/database';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Database ID configured for Firestore
const dbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Realtime Database instance (explicitly using configured databaseURL)
export const rtdb = getDatabase(
  app,
  firebaseConfig.databaseURL ||
    'https://rekapitulasi-qori-kitab-default-rtdb.asia-southeast1.firebasedatabase.app'
);

// Auth instance
export const auth = getAuth(app);

// Attempt anonymous sign-in in the background if anonymous auth is configured
signInAnonymously(auth).catch(() => {
  // Gracefully bypassed if anonymous auth is not enabled in the Firebase Console
});

// Test Firestore connection on boot according to Firebase skill requirements
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch {
    return false;
  }
}

// Test Realtime Database connection
export async function testRtdbConnection(): Promise<boolean> {
  try {
    const connectedRef = ref(rtdb, '.info/connected');
    await get(connectedRef);
    return true;
  } catch {
    return false;
  }
}
