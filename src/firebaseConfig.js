import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const requiredConfigKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

export const getFirebaseConfigError = (config) => {
  const missingKeys = requiredConfigKeys
    .filter((key) => {
      const value = config[key]?.trim();
      return !value
        || /^your[-_]/i.test(value)
        || value === '123456789012'
        || value === '1:123456789012:web:abcdef123456';
    })
    .map((key) => `REACT_APP_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

  return missingKeys.length
    ? `Firebase yapılandırması eksik. .env dosyanıza şu değerleri ekleyin: ${missingKeys.join(', ')}.`
    : '';
};

export const firebaseConfigError = getFirebaseConfigError(firebaseConfig);
const app = firebaseConfigError ? null : initializeApp(firebaseConfig);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export default app;
