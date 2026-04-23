import { Firestore, getFirestore } from 'firebase/firestore';
import { getFirebaseApp } from './app';

export function getFirestoreDb(): Firestore | null {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  return getFirestore(app);
}
