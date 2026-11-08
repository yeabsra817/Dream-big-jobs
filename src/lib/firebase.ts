import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  limit,
  deleteField,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Vacancy, SiteSettings, DuplicateReportItem, TelegramBatchRecord } from '../types/job';

// Initialize Firebase SDK with long polling auto-detection for reliable iframe/proxy connectivity
const app = initializeApp(firebaseConfig);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    (firebaseConfig as any).firestoreDatabaseId || '(default)'
  );
} catch {
  firestoreInstance = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || '(default)');
}

export const db = firestoreInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_EMAIL = 'nexusitsoultion@gmail.com';
export const PERSONAL_AUTO_APPLY_EMAIL = 'yeabsra45@gmail.com';

// Gmail OAuth Provider with minimal required send & readonly scopes
export const gmailProvider = new GoogleAuthProvider();
gmailProvider.addScope('https://www.googleapis.com/auth/gmail.send');
gmailProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
gmailProvider.setCustomParameters({
  login_hint: 'yeabsra45@gmail.com',
  prompt: 'consent',
});

let cachedGmailAccessToken: string | null = null;

export const setCachedGmailToken = (token: string | null) => {
  cachedGmailAccessToken = token;
};

export const getCachedGmailToken = () => cachedGmailAccessToken;

export const connectGmailAccount = async (): Promise<{ email: string; accessToken: string }> => {
  const result = await signInWithPopup(auth, gmailProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  const email = result.user?.email || '';

  if (!token) {
    throw new Error('Failed to obtain Google OAuth access token for Gmail.');
  }

  cachedGmailAccessToken = token;
  return { email, accessToken: token };
};

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

export function isPermissionError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code = ((error as { code?: string })?.code || '').toLowerCase();
  return (
    code.includes('permission') ||
    code.includes('unauthenticated') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('permission-denied') ||
    msg.includes('insufficient permissions')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per Firebase skill directive
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline note: Connection in progress or offline cache active.');
    }
  }
}
testFirestoreConnection();

// Check if user is the website owner / admin
export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  return false;
}

// Vacancy Firestore helpers
export async function fetchPublishedVacancies(): Promise<Vacancy[]> {
  const path = 'vacancies';
  try {
    const q = query(collection(db, path), where('status', '==', 'published'));
    const snapshot = await getDocs(q);
    const list: Vacancy[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as Vacancy), id: d.id });
    });
    // Sort in memory by publishedAt descending
    list.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    return list;
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn('Firestore offline/transient notice during fetchPublishedVacancies:', err);
    return [];
  }
}

const LOCAL_STORAGE_VACANCIES_KEY = 'dreambigjobs_vacancies_cache';
const LOCAL_STORAGE_SETTINGS_KEY = 'dreambigjobs_settings_cache';
const LOCAL_STORAGE_DUPLICATES_KEY = 'dreambigjobs_duplicates_cache';

export function saveVacancyToLocalCache(vacancy: Vacancy) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VACANCIES_KEY);
    let list: Vacancy[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((v) => v.id === vacancy.id);
    if (idx >= 0) {
      list[idx] = vacancy;
    } else {
      list.unshift(vacancy);
    }
    localStorage.setItem(LOCAL_STORAGE_VACANCIES_KEY, JSON.stringify(list));
  } catch {
    // Ignore quota/parse errors
  }
}

export async function fetchAllVacanciesAdmin(): Promise<Vacancy[]> {
  const path = 'vacancies';
  let cached: Vacancy[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VACANCIES_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (!auth.currentUser) {
    return cached;
  }
  try {
    const snapshot = await getDocs(collection(db, path));
    const list: Vacancy[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as Vacancy), id: d.id });
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (list.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_VACANCIES_KEY, JSON.stringify(list));
      } catch {}
      return list;
    }
    return cached;
  } catch (err) {
    console.warn('Firestore offline/permission notice during fetchAllVacanciesAdmin (serving local cache):', err);
    return cached;
  }
}

/**
 * Recursively removes all undefined values from an object or payload before saving to Firestore.
 * Firestore throws a runtime error if any key has value `undefined`.
 */
export function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item));
  }
  if (typeof data === 'object') {
    // Preserve Firestore FieldValue sentinels (e.g. deleteField(), serverTimestamp())
    if ('_methodName' in (data as any) || (data as any).constructor?.name === 'FieldValue') {
      return data;
    }
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean;
  }
  return data;
}

export async function saveVacancy(vacancy: Vacancy): Promise<void> {
  const path = `vacancies/${vacancy.id}`;
  // 1. Always persist to local cache first so admin edits are never lost
  saveVacancyToLocalCache(vacancy);

  // If user is not yet authenticated with Firebase, defer cloud write
  if (!auth.currentUser) {
    return;
  }

  // 2. Cloud write with non-blocking timeout fallback
  try {
    const rawPayload: Record<string, any> = { ...vacancy };
    if (vacancy.telegramPublished && (!vacancy.telegramPublishError || vacancy.telegramPublishError === '')) {
      rawPayload.telegramPublishError = deleteField();
    }
    const cleanPayload = sanitizeForFirestore(rawPayload);

    const writePromise = setDoc(doc(db, 'vacancies', vacancy.id), cleanPayload, { merge: true });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Cloud sync timeout; saved to local database')), 2000)
    );

    await Promise.race([writePromise, timeoutPromise]);
  } catch (err) {
    // Non-fatal warning: local cache has already saved the changes
    console.warn(`Firestore sync note (${path}):`, err);
  }
}

export async function saveBatchVacancies(vacancies: Vacancy[]): Promise<void> {
  // 1. Immediately cache all items locally
  for (const v of vacancies) {
    saveVacancyToLocalCache(v);
  }

  if (!auth.currentUser) return;

  // 2. Atomic writeBatch for cloud persistence (1 atomic network call instead of 50 individual requests)
  try {
    const batch = writeBatch(db);
    const slice = vacancies.slice(0, 100);
    for (const v of slice) {
      const rawPayload: Record<string, any> = { ...v };
      if (v.telegramPublished && (!v.telegramPublishError || vacancyTelegramErrorClean(v))) {
        rawPayload.telegramPublishError = deleteField();
      }
      const cleanPayload = sanitizeForFirestore(rawPayload);
      batch.set(doc(db, 'vacancies', v.id), cleanPayload, { merge: true });
    }

    const commitPromise = batch.commit();
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Batch commit timeout; local cache active')), 2500)
    );

    await Promise.race([commitPromise, timeoutPromise]);
  } catch (err) {
    console.warn('saveBatchVacancies background sync note:', err);
  }
}

function vacancyTelegramErrorClean(v: Vacancy): boolean {
  return !v.telegramPublishError || v.telegramPublishError === '';
}

export async function deleteVacancy(id: string): Promise<void> {
  const path = `vacancies/${id}`;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VACANCIES_KEY);
    if (raw) {
      const list: Vacancy[] = JSON.parse(raw).filter((v: Vacancy) => v.id !== id);
      localStorage.setItem(LOCAL_STORAGE_VACANCIES_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!auth.currentUser) {
    return;
  }

  try {
    await deleteDoc(doc(db, 'vacancies', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deleteBatchVacancies(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_VACANCIES_KEY);
    if (raw) {
      const list: Vacancy[] = JSON.parse(raw).filter((v: Vacancy) => !idSet.has(v.id));
      localStorage.setItem(LOCAL_STORAGE_VACANCIES_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!auth.currentUser) return;

  for (const id of ids) {
    try {
      await deleteDoc(doc(db, 'vacancies', id));
    } catch (err) {
      console.warn(`Error deleting vacancy ${id}:`, err);
    }
  }
}

// Site Settings helpers
export async function getSiteSettings(): Promise<SiteSettings> {
  const path = 'siteSettings/general';
  const defaultSettings: SiteSettings = {
    telegramChannelName: '@DreamBigJobsEthiopia',
    telegramChannelUrl: 'https://t.me/DreamBigJobsEthiopia',
    telegramGroupUrl: 'https://t.me/DreamBigJobsEthiopia',
    telegramBotUsername: '@DreamBigJobsEthiopiaBot',
    telegramAutoPublish: true,
    contactEmail: 'nexusitsoultion@gmail.com',
    contactPhone: '+251 91 123 4567',
    contactAddress: 'Bole Subcity, Addis Ababa, Ethiopia',
    aboutText:
      'DREAM BIG JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, and leading corporate sectors.',
    updatedAt: new Date().toISOString(),
  };

  try {
    const d = await getDoc(doc(db, 'siteSettings', 'general'));
    if (d.exists()) {
      return {
        ...defaultSettings,
        ...(d.data() as Partial<SiteSettings>),
      };
    }
    return defaultSettings;
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.GET, path);
    }
    console.warn('Firestore offline/transient notice during getSiteSettings, using defaults:', err);
    return defaultSettings;
  }
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const path = 'siteSettings/general';
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}

  if (!auth.currentUser) {
    return;
  }

  try {
    const cleanPayload = sanitizeForFirestore(settings);
    await setDoc(doc(db, 'siteSettings', 'general'), cleanPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Duplicate Reports
export async function fetchDuplicateReports(): Promise<DuplicateReportItem[]> {
  const path = 'duplicates';
  let cached: DuplicateReportItem[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DUPLICATES_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (!auth.currentUser) {
    return cached;
  }
  try {
    const snapshot = await getDocs(collection(db, path));
    const list: DuplicateReportItem[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as DuplicateReportItem), id: d.id });
    });
    list.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    if (list.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_DUPLICATES_KEY, JSON.stringify(list));
      } catch {}
      return list;
    }
    return cached;
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn('Firestore offline/transient notice during fetchDuplicateReports:', err);
    return cached;
  }
}

export async function saveDuplicateReport(report: DuplicateReportItem): Promise<void> {
  const path = `duplicates/${report.id}`;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DUPLICATES_KEY);
    let list: DuplicateReportItem[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((r) => r.id === report.id);
    if (idx >= 0) list[idx] = report;
    else list.unshift(report);
    localStorage.setItem(LOCAL_STORAGE_DUPLICATES_KEY, JSON.stringify(list));
  } catch {}

  if (!auth.currentUser) {
    return;
  }

  try {
    const cleanPayload = sanitizeForFirestore(report);
    await setDoc(doc(db, 'duplicates', report.id), cleanPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateDuplicateReportStatus(id: string, status: 'discarded' | 'restored'): Promise<void> {
  const path = `duplicates/${id}`;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DUPLICATES_KEY);
    if (raw) {
      const list: DuplicateReportItem[] = JSON.parse(raw);
      const target = list.find((d) => d.id === id);
      if (target) target.status = status;
      localStorage.setItem(LOCAL_STORAGE_DUPLICATES_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!auth.currentUser) {
    return;
  }

  try {
    await updateDoc(doc(db, 'duplicates', id), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteDuplicateReport(id: string): Promise<void> {
  const path = `duplicates/${id}`;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DUPLICATES_KEY);
    if (raw) {
      const list: DuplicateReportItem[] = JSON.parse(raw).filter((d: DuplicateReportItem) => d.id !== id);
      localStorage.setItem(LOCAL_STORAGE_DUPLICATES_KEY, JSON.stringify(list));
    }
  } catch {}

  if (!auth.currentUser) {
    return;
  }

  try {
    await deleteDoc(doc(db, 'duplicates', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Telegram Batches Collection Helpers
const LOCAL_STORAGE_BATCHES_KEY = 'dreambigjobs_telegram_batches_cache';

export async function fetchTelegramBatches(): Promise<TelegramBatchRecord[]> {
  const path = 'telegramBatches';
  let cached: TelegramBatchRecord[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BATCHES_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {
    // Ignore localStorage parse errors
  }

  if (!auth.currentUser) {
    return cached;
  }

  try {
    const snapshot = await getDocs(collection(db, path));
    const list: TelegramBatchRecord[] = [];
    snapshot.forEach((d) => {
      list.push({ ...(d.data() as TelegramBatchRecord), id: d.id });
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Sync to local storage
    if (list.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_BATCHES_KEY, JSON.stringify(list));
      } catch {
        // Ignore quota
      }
      return list;
    }
    return cached;
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn('Firestore notice during fetchTelegramBatches, returning local cache:', err);
    return cached;
  }
}

export async function saveTelegramBatch(batch: TelegramBatchRecord): Promise<void> {
  const path = `telegramBatches/${batch.id}`;
  // Save locally first
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BATCHES_KEY);
    let list: TelegramBatchRecord[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((b) => b.id === batch.id);
    if (idx >= 0) {
      list[idx] = batch;
    } else {
      list.unshift(batch);
    }
    localStorage.setItem(LOCAL_STORAGE_BATCHES_KEY, JSON.stringify(list));
  } catch {
    // Ignore
  }

  if (!auth.currentUser) {
    return;
  }

  try {
    const cleanPayload = sanitizeForFirestore(batch);
    await setDoc(doc(db, 'telegramBatches', batch.id), cleanPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteTelegramBatch(id: string): Promise<void> {
  const path = `telegramBatches/${id}`;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BATCHES_KEY);
    if (raw) {
      const list: TelegramBatchRecord[] = JSON.parse(raw).filter((b: TelegramBatchRecord) => b.id !== id);
      localStorage.setItem(LOCAL_STORAGE_BATCHES_KEY, JSON.stringify(list));
    }
  } catch {
    // Ignore
  }

  try {
    await deleteDoc(doc(db, 'telegramBatches', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function checkFirebaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  projectId: string;
  databaseId: string;
  authStatus: 'signed_in' | 'anonymous' | 'signed_out';
  currentUserEmail: string | null;
  error?: string;
  storageMode?: 'cloud' | 'local_persistence';
}> {
  const start = Date.now();
  const user = auth.currentUser;
  const projectId = firebaseConfig.projectId || 'gen-lang-client-0056760370';
  const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

  try {
    const settingsRef = doc(db, 'siteSettings', 'general');
    const readPromise = getDoc(settingsRef);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Cloud connection timeout (offline local persistence mode active)')), 1500)
    );

    await Promise.race([readPromise, timeoutPromise]);
    const latencyMs = Date.now() - start;

    return {
      ok: true,
      latencyMs,
      projectId,
      databaseId,
      authStatus: user ? (user.isAnonymous ? 'anonymous' : 'signed_in') : 'signed_out',
      currentUserEmail: user ? user.email : null,
      storageMode: 'cloud',
    };
  } catch (err: any) {
    const latencyMs = Math.min(Date.now() - start, 1500);
    const localCached = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_VACANCIES_KEY) : null;
    const isLocalOperational = Boolean(localCached && localCached.length > 50);

    return {
      ok: isLocalOperational,
      latencyMs,
      projectId,
      databaseId,
      authStatus: user ? 'signed_in' : 'signed_out',
      currentUserEmail: user?.email || null,
      error: err.message || String(err),
      storageMode: 'local_persistence',
    };
  }
}



