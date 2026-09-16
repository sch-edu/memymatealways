import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
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

export function subscribeToFirebaseAuth(callback: (user: User | null) => void): () => void {
  const services = getServices();
  return services ? onAuthStateChanged(services.auth, callback) : () => undefined;
}

export async function ensureAnonymousUser(): Promise<User | null> {
  const services = getServices();
  if (!services) return null;
  if (services.auth.currentUser) return services.auth.currentUser;
  return (await signInAnonymously(services.auth)).user;
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

export async function loadSharedKnight(knightId: string): Promise<Knight | null> {
  const services = getServices();
  if (!services) return null;
  const snapshot = await getDoc(doc(services.db, 'sharedKnights', knightId));
  return snapshot.exists() ? snapshot.data() as Knight : null;
}