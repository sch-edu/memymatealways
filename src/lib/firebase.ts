import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, getFirestore, setDoc } from 'firebase/firestore';
import type { Knight } from '@/types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId);

function getServices() {
  if (!firebaseConfigured) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}

/**
 * Cloud gating: only real, non-anonymous accounts (email/password) may touch
 * Firestore. Guests never perform any Firestore I/O — their decks stay in
 * on-device localStorage.
 */
export function isCloudUser(user: User | null): boolean {
  return Boolean(user && !user.isAnonymous);
}

export function subscribeToFirebaseAuth(callback: (user: User | null) => void): () => void {
  const services = getServices();
  return services ? onAuthStateChanged(services.auth, callback) : () => undefined;
}

export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const services = getServices();
  if (!services) throw new Error('Firebase is not configured for this deployment.');
  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  return credential.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const services = getServices();
  if (!services) throw new Error('Firebase is not configured for this deployment.');
  const credential = await signInWithEmailAndPassword(services.auth, email, password);
  return credential.user;
}

export async function signOutFirebase(): Promise<void> {
  const services = getServices();
  if (!services) return;
  await signOut(services.auth);
}

export async function loadCloudKnights(userId: string): Promise<Knight[]> {
  const services = getServices();
  if (!services) return [];
  const snapshot = await getDocs(collection(services.db, 'users', userId, 'knights'));
  return snapshot.docs.map((item) => item.data() as Knight);
}

export async function saveCloudKnight(userId: string, knight: Knight): Promise<void> {
  const services = getServices();
  if (!services) return;
  await setDoc(doc(services.db, 'users', userId, 'knights', knight.id), knight);
}

export async function saveSharedKnight(userId: string, knight: Knight): Promise<void> {
  const services = getServices();
  if (!services) return;
  await setDoc(doc(services.db, 'sharedKnights', knight.id), { ...knight, ownerId: userId, sharedAt: new Date().toISOString() });
}

/** Public read-only shared links — anyone can study, nobody can tamper. */
export async function loadSharedKnight(knightId: string): Promise<Knight | null> {
  const services = getServices();
  if (!services) return null;
  const snapshot = await getDoc(doc(services.db, 'sharedKnights', knightId));
  return snapshot.exists() ? (snapshot.data() as Knight) : null;
}
