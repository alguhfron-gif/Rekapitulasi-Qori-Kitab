import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Database ID configured for this applet (must match firestoreDatabaseId)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

// Auth instance
export const auth = getAuth(app);

// Test connection on boot according to Firebase skill requirements
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection verified.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or cannot reach Firestore servers.');
      return false;
    }
    // Any other response (including document not found) means connection reached server
    return true;
  }
}
