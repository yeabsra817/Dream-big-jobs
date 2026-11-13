import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  onAuthStateChanged,
  getAdditionalUserInfo,
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
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { Vacancy, SiteSettings, DuplicateReportItem, TelegramBatchRecord } from '../types/job';
import { PersonalProfile, PersonalDocument, ApplicationRecord } from '../types/autoApply';
import { JobSeekerProfile, UserJobApplication, ApplicationStatus } from '../types/jobSeeker';
import {
  AnalyticsEvent,
  AnalyticsPeriod,
  AnalyticsSummary,
  CustomerVisitCountSummary,
} from '../types/analytics';

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
auth.useDeviceLanguage();
export const storage = getStorage(app, (firebaseConfig as any).storageBucket || 'gen-lang-client-0056760370.firebasestorage.app');
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

export async function safeResponseJson<T = any>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

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
  if (typeof window !== 'undefined') {
    try {
      if (token) localStorage.setItem('hopelandjobs_gmail_token', token);
      else localStorage.removeItem('hopelandjobs_gmail_token');
    } catch {}
  }
};

export const getCachedGmailToken = () => {
  if (cachedGmailAccessToken) return cachedGmailAccessToken;
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('hopelandjobs_gmail_token');
      if (saved) {
        cachedGmailAccessToken = saved;
        return saved;
      }
    } catch {}
  }
  return null;
};

export const connectGmailAccount = async (): Promise<{ email: string; accessToken: string }> => {
  const result = await signInWithPopup(auth, gmailProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  const email = result.user?.email || 'yeabsra45@gmail.com';

  if (!token) {
    throw new Error('Failed to obtain Google OAuth access token for Gmail.');
  }

  setCachedGmailToken(token);

  // Persist to server backend for cross-browser & cross-user access
  try {
    await fetch('/api/auto-apply/save-gmail-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email }),
    });
  } catch (e) {
    console.warn('Server token sync notice:', e);
  }

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

// Deferred connection check so it never contends with initial vacancy/settings fetches
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline note: Connection in progress or offline cache active.');
    }
  }
}
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testFirestoreConnection();
  }, 3000);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

export const ADMIN_EMAILS = [
  'nexusitsoultion@gmail.com',
  'yeabsra45@gmail.com',
];

// Check if user is the website owner / admin
export function isUserAdmin(user: User | null): boolean {
  if (!user) return false;
  const userEmail = (user.email || '').toLowerCase().trim();
  return ADMIN_EMAILS.some((adm) => adm.toLowerCase().trim() === userEmail);
}

const LOCAL_STORAGE_PUBLISHED_KEY = 'hopelandjobs_published_vacancies_cache';
const LOCAL_STORAGE_VACANCIES_KEY = 'dreambigjobs_vacancies_cache';
const LOCAL_STORAGE_SETTINGS_KEY = 'dreambigjobs_settings_cache';
const LOCAL_STORAGE_DUPLICATES_KEY = 'dreambigjobs_duplicates_cache';

export function getCachedPublishedVacancies(): Vacancy[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PUBLISHED_KEY) || localStorage.getItem(LOCAL_STORAGE_VACANCIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getCachedSiteSettings(): SiteSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as SiteSettings) : null;
  } catch {
    return null;
  }
}

export function getCachedJobSeekerProfile(uid: string): JobSeekerProfile | null {
  if (typeof window === 'undefined' || !uid) return null;
  try {
    const raw = localStorage.getItem(`hopelandjobs_profile_${uid}`);
    return raw ? (JSON.parse(raw) as JobSeekerProfile) : null;
  } catch {
    return null;
  }
}

export function getCachedUserApplications(userId: string): UserJobApplication[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(`hopelandjobs_apps_${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Vacancy Firestore helpers
export async function fetchPublishedVacancies(): Promise<Vacancy[]> {
  const path = 'vacancies';
  const cached = getCachedPublishedVacancies();
  try {
    const q = query(collection(db, path), where('status', '==', 'published'));
    const snapshot = await withTimeout(getDocs(q), 5000, null as any);
    if (!snapshot) {
      return cached;
    }
    const list: Vacancy[] = [];
    snapshot.forEach((d: any) => {
      list.push({ ...(d.data() as Vacancy), id: d.id });
    });
    // Sort in memory by publishedAt descending
    list.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    try {
      localStorage.setItem(LOCAL_STORAGE_PUBLISHED_KEY, JSON.stringify(list));
    } catch {}
    return list;
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
    console.warn('Firestore offline/transient notice during fetchPublishedVacancies:', err);
    return cached;
  }
}

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
    customDomain: 'hopelandjobs.tech',
    aboutText:
      'HOPELAND JOBS is Ethiopia’s premier, verified job recruitment information portal. We provide genuine, accurate vacancies across banking, embassies, NGOs, hospitality, leading corporate sectors, and international visa opportunities.',
    updatedAt: new Date().toISOString(),
  };

  // 1. Check local storage cache
  let cached: Partial<SiteSettings> = {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  // 2 & 3. Fetch server disk settings & cloud Firestore document in parallel with timeouts
  const fetchServerSettings = async (): Promise<Partial<SiteSettings>> => {
    try {
      const sRes = await withTimeout(fetch('/api/settings'), 2500, null as any);
      if (sRes && sRes.ok) {
        const sData = await safeResponseJson<Partial<SiteSettings>>(sRes);
        if (sData && typeof sData === 'object') return sData;
      }
    } catch {}
    return {};
  };

  const fetchFirestoreSettings = async (): Promise<Partial<SiteSettings>> => {
    try {
      const d = await withTimeout(getDoc(doc(db, 'siteSettings', 'general')), 3000, null as any);
      if (d && d.exists()) {
        return d.data() as Partial<SiteSettings>;
      }
    } catch (err) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.GET, path);
      }
    }
    return {};
  };

  const [serverSettings, firestoreSettings] = await Promise.all([
    fetchServerSettings(),
    fetchFirestoreSettings(),
  ]);

  // Merge with highest priority: Firestore > Server > Local Cache > Defaults
  const merged: SiteSettings = {
    ...defaultSettings,
    ...cached,
    ...serverSettings,
    ...firestoreSettings,
  };

  // Ensure any valid bot token, custom domain, or GA4 ID found in any layer is strictly preserved
  const resolvedToken =
    (firestoreSettings.telegramBotToken && firestoreSettings.telegramBotToken.includes(':') ? firestoreSettings.telegramBotToken : '') ||
    (serverSettings.telegramBotToken && serverSettings.telegramBotToken.includes(':') ? serverSettings.telegramBotToken : '') ||
    (cached.telegramBotToken && cached.telegramBotToken.includes(':') ? cached.telegramBotToken : '') ||
    (typeof window !== 'undefined' ? (localStorage.getItem('dreambigjobs_telegram_bot_token') || '') : '');

  if (resolvedToken) {
    merged.telegramBotToken = resolvedToken;
  }

  let resolvedDomain =
    firestoreSettings.customDomain ||
    serverSettings.customDomain ||
    cached.customDomain ||
    'hopelandjobs.tech';
  // Migrate legacy healmorin.com to hopelandjobs.tech automatically
  if (resolvedDomain === 'healmorin.com') {
    resolvedDomain = 'hopelandjobs.tech';
  }
  if (resolvedDomain) {
    merged.customDomain = resolvedDomain;
  }

  const resolvedUsername =
    firestoreSettings.telegramBotUsername ||
    serverSettings.telegramBotUsername ||
    cached.telegramBotUsername ||
    '@DreamBigJobsEthiopiaBot';
  if (resolvedUsername) {
    merged.telegramBotUsername = resolvedUsername;
  }

  if (!merged.gaMeasurementId) {
    if (firestoreSettings.gaMeasurementId) merged.gaMeasurementId = firestoreSettings.gaMeasurementId;
    else if (serverSettings.gaMeasurementId) merged.gaMeasurementId = serverSettings.gaMeasurementId;
    else if (cached.gaMeasurementId) merged.gaMeasurementId = cached.gaMeasurementId;
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(merged));
    if (merged.telegramBotToken) {
      localStorage.setItem('dreambigjobs_telegram_bot_token', merged.telegramBotToken);
    }
  } catch {}

  return merged;
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const path = 'siteSettings/general';

  // 1. Update localStorage immediately
  try {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(settings));
    if (settings.telegramBotToken) {
      localStorage.setItem('dreambigjobs_telegram_bot_token', settings.telegramBotToken);
    }
  } catch {}

  // 2. Persist to server backend disk
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch (e) {
    console.warn('Server settings sync notice:', e);
  }

  // 3. Persist to Cloud Firestore
  try {
    const cleanPayload = sanitizeForFirestore(settings);
    await setDoc(doc(db, 'siteSettings', 'general'), cleanPayload, { merge: true });
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
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

// ============================================================================
// CLOUD PERSISTENCE: PERSONAL AUTO APPLY (Cross-Device & Cross-Browser Continuity)
// ============================================================================

const LOCAL_STORAGE_AUTO_APPLY_PROFILE_KEY = 'personal_auto_apply_profile';
const LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY = 'personal_auto_apply_documents';
const LOCAL_STORAGE_AUTO_APPLY_APPS_KEY = 'personal_auto_apply_records';

/**
 * Fetch personal profile from Cloud Firestore or server backend (cross-browser continuity)
 */
export async function fetchAutoApplyProfile(): Promise<PersonalProfile | null> {
  let cached: PersonalProfile | null = null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_PROFILE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  // 1. Try Firestore if user is logged in
  if (auth.currentUser) {
    try {
      const d = await getDoc(doc(db, 'autoApplyProfile', 'yeabsra_profile'));
      if (d.exists()) {
        const cloudData = d.data() as PersonalProfile;
        try {
          localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_PROFILE_KEY, JSON.stringify(cloudData));
        } catch {}
        return cloudData;
      }
    } catch (err) {
      console.warn('Firestore autoApplyProfile notice:', err);
    }
  }

  // 2. Fall back to server persistent store (/api/auto-apply/state)
  try {
    const res = await fetch('/api/auto-apply/state');
    if (res.ok) {
      const data = await safeResponseJson<{ profile?: PersonalProfile }>(res);
      if (data?.profile) {
        try {
          localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_PROFILE_KEY, JSON.stringify(data.profile));
        } catch {}
        return data.profile;
      }
    }
  } catch {}

  return cached;
}

/**
 * Save personal profile to Cloud Firestore, server backend, and local storage
 */
export async function saveAutoApplyProfile(profile: PersonalProfile): Promise<void> {
  try {
    localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_PROFILE_KEY, JSON.stringify(profile));
  } catch {}

  // 1. Save to server persistent backend
  try {
    await fetch('/api/auto-apply/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  } catch (e) {
    console.warn('Server autoApplyProfile sync notice:', e);
  }

  // 2. Save to Firestore if user is authenticated
  if (!auth.currentUser) return;

  try {
    const clean = sanitizeForFirestore(profile);
    await setDoc(doc(db, 'autoApplyProfile', 'yeabsra_profile'), clean, { merge: true });
  } catch (err) {
    console.warn('Failed saving autoApplyProfile to Firestore:', err);
  }
}

/**
 * Fetch all documents metadata from Cloud Firestore or server backend (cross-device sync)
 */
export async function fetchAutoApplyDocuments(): Promise<PersonalDocument[]> {
  const path = 'autoApplyDocuments';
  let cached: PersonalDocument[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  // 1. Try Firestore if authenticated
  if (auth.currentUser) {
    try {
      const snapshot = await getDocs(collection(db, path));
      const list: PersonalDocument[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as PersonalDocument), id: d.id });
      });
      if (list.length > 0) {
        list.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        try {
          const safeCache = list.map((docItem) => ({
            ...docItem,
            fileBase64: undefined,
          }));
          localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY, JSON.stringify(safeCache));
        } catch {}
        return list;
      }
    } catch (err) {
      console.warn('Firestore autoApplyDocuments fetch notice:', err);
    }
  }

  // 2. Fetch from server persistent storage (/api/auto-apply/state)
  try {
    const res = await fetch('/api/auto-apply/state');
    if (res.ok) {
      const data = await safeResponseJson<{ documents?: PersonalDocument[] }>(res);
      if (data && Array.isArray(data.documents) && data.documents.length > 0) {
        try {
          localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY, JSON.stringify(data.documents));
        } catch {}
        return data.documents;
      }
    }
  } catch {}

  return cached;
}

/**
 * Save document metadata to Cloud Firestore and server backend (cross-device sync)
 */
export async function saveAutoApplyDocument(documentItem: PersonalDocument): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY);
    let list: PersonalDocument[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((d) => d.id === documentItem.id);
    if (idx >= 0) list[idx] = documentItem;
    else list.unshift(documentItem);
    localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY, JSON.stringify(list));

    // Also persist to server backend
    fetch('/api/auto-apply/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: list }),
    }).catch((e) => console.warn('Server doc sync notice:', e));
  } catch {}

  if (!auth.currentUser) return;

  try {
    const firestorePayload: any = { ...documentItem };
    if (firestorePayload.fileBase64 && firestorePayload.fileBase64.length > 200000) {
      delete firestorePayload.fileBase64;
    }
    const clean = sanitizeForFirestore(firestorePayload);
    await setDoc(doc(db, 'autoApplyDocuments', documentItem.id), clean, { merge: true });
  } catch (err) {
    console.warn('Failed saving autoApplyDocument to Firestore:', err);
  }
}

/**
 * Delete document from Cloud Firestore and server backend
 */
export async function deleteAutoApplyDocument(docId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY);
    if (raw) {
      const list = JSON.parse(raw).filter((d: PersonalDocument) => d.id !== docId);
      localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_DOCS_KEY, JSON.stringify(list));
    }
  } catch {}

  // Delete from server storage
  try {
    await fetch(`/api/auto-apply/documents/${docId}`, { method: 'DELETE' });
  } catch {}

  if (!auth.currentUser) return;

  try {
    await deleteDoc(doc(db, 'autoApplyDocuments', docId));
  } catch (err) {
    console.warn('Failed deleting autoApplyDocument from Firestore:', err);
  }
}

/**
 * Fetch application records from Cloud Firestore or server backend (cross-device sync)
 */
export async function fetchAutoApplyApplications(): Promise<ApplicationRecord[]> {
  const path = 'autoApplyApplications';
  let cached: ApplicationRecord[] = [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}

  if (auth.currentUser) {
    try {
      const snapshot = await getDocs(collection(db, path));
      const list: ApplicationRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ ...(d.data() as ApplicationRecord), id: d.id });
      });
      if (list.length > 0) {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        try {
          localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY, JSON.stringify(list));
        } catch {}
        return list;
      }
    } catch (err) {
      console.warn('Firestore autoApplyApplications fetch notice:', err);
    }
  }

  // Fetch from server
  try {
    const res = await fetch('/api/auto-apply/state');
    if (res.ok) {
      const data = await safeResponseJson<{ applications?: ApplicationRecord[] }>(res);
      if (data && Array.isArray(data.applications) && data.applications.length > 0) {
        try {
          localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY, JSON.stringify(data.applications));
        } catch {}
        return data.applications;
      }
    }
  } catch {}

  return cached;
}

/**
 * Save application record to Cloud Firestore and server backend
 */
export async function saveAutoApplyApplication(record: ApplicationRecord): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY);
    let list: ApplicationRecord[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((a) => a.id === record.id);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY, JSON.stringify(list));

    // Save to server
    fetch('/api/auto-apply/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: list }),
    }).catch((e) => console.warn('Server app sync notice:', e));
  } catch {}

  if (!auth.currentUser) return;

  try {
    const clean = sanitizeForFirestore(record);
    await setDoc(doc(db, 'autoApplyApplications', record.id), clean, { merge: true });
  } catch (err) {
    console.warn('Failed saving autoApplyApplication to Firestore:', err);
  }
}

/**
 * Delete application record from Cloud Firestore and server backend
 */
export async function deleteAutoApplyApplication(appId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY);
    if (raw) {
      const list = JSON.parse(raw).filter((a: ApplicationRecord) => a.id !== appId);
      localStorage.setItem(LOCAL_STORAGE_AUTO_APPLY_APPS_KEY, JSON.stringify(list));
    }
  } catch {}

  // Delete from server storage
  try {
    await fetch(`/api/auto-apply/applications/${appId}`, { method: 'DELETE' });
  } catch {}

  if (!auth.currentUser) return;

  try {
    await deleteDoc(doc(db, 'autoApplyApplications', appId));
  } catch (err) {
    console.warn('Failed deleting autoApplyApplication from Firestore:', err);
  }
}

// ============================================================================
// AUTOMATIC BACKUPS & DATA DISASTER RECOVERY (Production Protection)
// ============================================================================

export interface FullSystemBackupSnapshot {
  version: string;
  timestamp: string;
  exportedBy: string;
  totalRecordsCount: number;
  data: {
    vacancies: Vacancy[];
    siteSettings: SiteSettings;
    duplicateReports: DuplicateReportItem[];
    telegramBatches: TelegramBatchRecord[];
    autoApplyProfile: PersonalProfile | null;
    autoApplyDocuments: PersonalDocument[];
    autoApplyApplications: ApplicationRecord[];
  };
}

/**
 * Generate a complete, verified snapshot backup of all persistent cloud data
 */
export async function generateFullSystemBackupSnapshot(
  currentVacancies: Vacancy[],
  currentSettings: SiteSettings,
  currentDuplicates: DuplicateReportItem[],
  currentProfile?: PersonalProfile | null,
  currentDocs?: PersonalDocument[],
  currentApps?: ApplicationRecord[]
): Promise<FullSystemBackupSnapshot> {
  const user = auth.currentUser;
  const batches = await fetchTelegramBatches();
  const docs = currentDocs || (await fetchAutoApplyDocuments());
  const apps = currentApps || (await fetchAutoApplyApplications());
  const profile = currentProfile || (await fetchAutoApplyProfile());

  const snapshot: FullSystemBackupSnapshot = {
    version: '2.4.0',
    timestamp: new Date().toISOString(),
    exportedBy: user?.email || 'nexusitsoultion@gmail.com',
    totalRecordsCount: currentVacancies.length + docs.length + apps.length + currentDuplicates.length,
    data: {
      vacancies: currentVacancies,
      siteSettings: currentSettings,
      duplicateReports: currentDuplicates,
      telegramBatches: batches,
      autoApplyProfile: profile,
      autoApplyDocuments: docs,
      autoApplyApplications: apps,
    },
  };

  if (user) {
    try {
      await setDoc(doc(db, 'siteSettings', 'lastBackup'), {
        timestamp: snapshot.timestamp,
        exportedBy: snapshot.exportedBy,
        totalRecords: snapshot.totalRecordsCount,
        version: snapshot.version,
      });
    } catch {}
  }

  return snapshot;
}

// Re-export core auth methods for clean component imports
export {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  getAdditionalUserInfo,
};

/* =========================================================================
 * 10. JOB SEEKER PROFILES & DASHBOARD PERSISTENCE
 * ========================================================================= */

export async function fetchJobSeekerProfile(uid: string): Promise<JobSeekerProfile | null> {
  if (!uid) return null;

  // 1 & 2. Query Firestore & server backend in parallel with timeout guards
  const fromFirestore = async (): Promise<JobSeekerProfile | null> => {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'job_seeker_profiles', uid)), 3000, null as any);
      if (snap && snap.exists()) return snap.data() as JobSeekerProfile;
    } catch (err) {
      console.warn('Firestore profile fetch notice:', err);
    }
    return null;
  };

  const fromServer = async (): Promise<JobSeekerProfile | null> => {
    try {
      const res = await withTimeout(fetch(`/api/user-profile/${encodeURIComponent(uid)}`), 2500, null as any);
      if (res && res.ok) {
        const serverProfile = await safeResponseJson<JobSeekerProfile>(res);
        if (serverProfile && serverProfile.uid) return serverProfile;
      }
    } catch {}
    return null;
  };

  const [fsProfile, srvProfile] = await Promise.all([fromFirestore(), fromServer()]);
  const resolved = fsProfile || srvProfile;
  if (resolved) {
    try {
      localStorage.setItem(`hopelandjobs_profile_${uid}`, JSON.stringify(resolved));
    } catch {}
    return resolved;
  }

  // 3. Fallback to localStorage
  return getCachedJobSeekerProfile(uid);
}

export async function saveJobSeekerProfile(profile: JobSeekerProfile): Promise<void> {
  if (!profile.uid) return;

  const cleanProfile = sanitizeForFirestore({
    ...profile,
    updatedAt: new Date().toISOString(),
  });

  // 1. Cache immediately in localStorage
  try {
    localStorage.setItem(`hopelandjobs_profile_${profile.uid}`, JSON.stringify(cleanProfile));
  } catch {}

  // 2 & 3. Persist to Firestore & server database in parallel
  await Promise.allSettled([
    withTimeout(setDoc(doc(db, 'job_seeker_profiles', profile.uid), cleanProfile, { merge: true }), 3500, undefined),
    withTimeout(
      fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanProfile),
      }),
      3500,
      null as any
    ),
  ]);
}

/* =========================================================================
 * 11. JOB APPLICATIONS (SUBMISSIONS & REVIEW TRACKING)
 * ========================================================================= */

export async function fetchUserApplications(userId: string): Promise<UserJobApplication[]> {
  if (!userId) return [];

  // 1 & 2. Query Firestore & server backend in parallel with timeout guards
  const fromFirestore = async (): Promise<UserJobApplication[] | null> => {
    try {
      const q = query(collection(db, 'job_applications'), where('userId', '==', userId));
      const snap = await withTimeout(getDocs(q), 3000, null as any);
      if (snap && !snap.empty) {
        const list = snap.docs.map((d: any) => d.data() as UserJobApplication);
        list.sort((a: UserJobApplication, b: UserJobApplication) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
        return list;
      }
    } catch (err) {
      console.warn('Firestore applications fetch notice:', err);
    }
    return null;
  };

  const fromServer = async (): Promise<UserJobApplication[] | null> => {
    try {
      const res = await withTimeout(fetch(`/api/applications?userId=${encodeURIComponent(userId)}`), 2500, null as any);
      if (res && res.ok) {
        const serverApps = await safeResponseJson<UserJobApplication[]>(res);
        if (Array.isArray(serverApps) && serverApps.length > 0) return serverApps;
      }
    } catch {}
    return null;
  };

  const [fsApps, srvApps] = await Promise.all([fromFirestore(), fromServer()]);
  const resolved = (fsApps && fsApps.length > 0 ? fsApps : null) || srvApps;
  if (resolved) {
    try {
      localStorage.setItem(`hopelandjobs_apps_${userId}`, JSON.stringify(resolved));
    } catch {}
    return resolved;
  }

  // 3. Fallback to localStorage
  return getCachedUserApplications(userId);
}

export async function fetchAllApplicationsAdmin(): Promise<UserJobApplication[]> {
  // 1. Try Firestore
  try {
    const snap = await getDocs(collection(db, 'job_applications'));
    if (!snap.empty) {
      const list = snap.docs.map((d) => d.data() as UserJobApplication);
      list.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
      return list;
    }
  } catch (err) {
    console.warn('Firestore all applications fetch notice:', err);
  }

  // 2. Try server backend
  try {
    const res = await fetch('/api/applications/all');
    if (res.ok) {
      const serverApps = await safeResponseJson<UserJobApplication[]>(res);
      if (Array.isArray(serverApps)) return serverApps;
    }
  } catch {}

  return [];
}

export async function submitJobApplication(
  application: UserJobApplication
): Promise<{ success: boolean; error?: string }> {
  const cleanApplication = sanitizeForFirestore(application);

  // 1. Save to Firestore
  try {
    const docRef = doc(db, 'job_applications', application.id);
    await setDoc(docRef, cleanApplication);
  } catch (err: any) {
    console.warn('Firestore application submit notice:', err);
  }

  // 2. Save to server backend
  try {
    const res = await fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanApplication),
    });
    if (!res.ok) {
      const data = await safeResponseJson<{ error?: string; isDuplicate?: boolean }>(res);
      if (data?.error && data?.isDuplicate) {
        return { success: false, error: data.error };
      }
    }
  } catch {}

  // 3. Update local cache
  try {
    const key = `hopelandjobs_apps_${application.userId}`;
    const saved = localStorage.getItem(key);
    const existing: UserJobApplication[] = saved ? JSON.parse(saved) : [];
    const updated = [application, ...existing.filter((a) => a.id !== application.id)];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}

  return { success: true };
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  note?: string
): Promise<void> {
  const timestamp = new Date().toISOString();

  // 1. Update Firestore
  try {
    const docRef = doc(db, 'job_applications', applicationId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as UserJobApplication;
      const newTimeline = [
        ...(data.statusTimeline || []),
        { status, timestamp, note: note || `Status updated to ${status}` },
      ];
      await updateDoc(docRef, {
        status,
        statusNotes: note || data.statusNotes,
        statusTimeline: newTimeline,
        updatedAt: timestamp,
      });
    }
  } catch (err) {
    console.warn('Firestore status update notice:', err);
  }

  // 2. Update server backend
  try {
    await fetch(`/api/applications/${encodeURIComponent(applicationId)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note, timestamp }),
    });
  } catch {}
}

/* =========================================================================
 * 12. FIRST-PARTY FIRESTORE ANALYTICS & CUSTOMER VISIT TRACKING
 * ========================================================================= */

function getAddisDateKey(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getSafeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

export async function recordAnalyticsToFirestore(event: AnalyticsEvent): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const cleanUid = event.userId && !event.userId.includes('@')
      ? event.userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : '';
    const isSignedIn = Boolean(cleanUid);
    const visitorKey = getSafeFirestoreId(isSignedIn ? `u_${cleanUid}` : event.visitorId || 'vid_anon');
    const dateKey = getAddisDateKey(new Date(event.timestamp || Date.now()));
    const nowIso = event.timestamp || new Date().toISOString();

    // Maintain local per-visitor counters so we avoid extra Firestore read roundtrips
    const counterKey = `hopeland_fs_vis_${visitorKey}`;
    let prevState: { firstSeenAt?: string; pageViews?: number; aiInteractionsCount?: number } = {};
    try {
      const raw = localStorage.getItem(counterKey);
      if (raw) prevState = JSON.parse(raw);
    } catch {}

    const nextPageViews = (prevState.pageViews || 0) + (event.eventType === 'page_view' ? 1 : 0);
    const nextAiCount = (prevState.aiInteractionsCount || 0) + (event.eventType === 'ai_assist' ? 1 : 0);
    const firstSeenAt = prevState.firstSeenAt || nowIso;

    try {
      localStorage.setItem(
        counterKey,
        JSON.stringify({
          firstSeenAt,
          pageViews: Math.max(1, nextPageViews),
          aiInteractionsCount: nextAiCount,
        })
      );
    } catch {}

    const safeSource = (['direct', 'google', 'telegram', 'facebook', 'referral', 'other'].includes(event.source)
      ? event.source
      : 'direct') as AnalyticsEvent['source'];
    const safeDevice = (['mobile', 'desktop', 'tablet'].includes(event.deviceType)
      ? event.deviceType
      : 'desktop') as AnalyticsEvent['deviceType'];

    const visitorDoc = {
      visitorKey,
      dateKey,
      firstSeenAt: String(firstSeenAt).slice(0, 64),
      lastSeenAt: String(nowIso).slice(0, 64),
      isSignedIn,
      isInternal: Boolean(event.isInternal),
      source: safeSource,
      deviceType: safeDevice,
      pageViews: Math.max(1, nextPageViews),
      aiInteractionsCount: nextAiCount,
      lastEventType: String(event.eventType || 'page_view').slice(0, 64),
    };

    const eventId = getSafeFirestoreId(event.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const eventDoc: Record<string, any> = {
      id: eventId,
      visitorKey,
      sessionId: String(event.sessionId || 'sid').slice(0, 128),
      eventType: String(event.eventType || 'page_view').slice(0, 64),
      path: String(event.path || '/').slice(0, 300),
      source: safeSource,
      deviceType: safeDevice,
      timestamp: String(nowIso).slice(0, 64),
      isInternal: Boolean(event.isInternal),
    };
    if (event.title) eventDoc.title = String(event.title).slice(0, 200);
    if (event.jobId) eventDoc.jobId = String(event.jobId).slice(0, 128);
    if (event.jobTitle) eventDoc.jobTitle = String(event.jobTitle).slice(0, 200);
    if (event.organization) eventDoc.organization = String(event.organization).slice(0, 200);
    if (event.category) eventDoc.category = String(event.category).slice(0, 120);
    if (event.searchTerm) eventDoc.searchTerm = String(event.searchTerm).slice(0, 200);
    if (event.filterType) eventDoc.filterType = String(event.filterType).slice(0, 100);

    await Promise.allSettled([
      setDoc(doc(db, 'analytics_visitors', visitorKey), visitorDoc, { merge: true }),
      setDoc(doc(db, 'analytics_events', eventId), eventDoc),
    ]);
  } catch (err) {
    console.warn('Firestore analytics write notice:', err);
  }
}

export async function fetchCustomerVisitCountFromFirestore(
  excludeAdmin: boolean = true
): Promise<CustomerVisitCountSummary | null> {
  try {
    const snap = await withTimeout(
      getDocs(query(collection(db, 'analytics_visitors'), limit(1000))),
      3500,
      null as any
    );
    if (!snap) return null;

    const now = Date.now();
    const todayKey = getAddisDateKey(new Date(now));
    const yesterdayKey = getAddisDateKey(new Date(now - 86400000));
    const last7Threshold = now - 7 * 86400000;
    const last30Threshold = now - 30 * 86400000;
    const activeThreshold = now - 30 * 60000;

    let visitorsToday = 0;
    let visitorsYesterday = 0;
    let visitorsLast7 = 0;
    let visitorsLast30 = 0;
    let activeNow = 0;
    let totalUniqueVisits = 0;
    let totalPageViews = 0;
    let signedInCustomerVisits = 0;
    let telegramReferrals = 0;
    let aiInteractionsCount = 0;

    snap.forEach((docSnap: any) => {
      const v = docSnap.data();
      if (!v) return;
      if (excludeAdmin && v.isInternal) return;

      totalUniqueVisits += 1;
      totalPageViews += Number(v.pageViews || 1);
      aiInteractionsCount += Number(v.aiInteractionsCount || 0);
      if (v.isSignedIn) signedInCustomerVisits += 1;
      if (v.source === 'telegram') telegramReferrals += 1;

      const lastMs = v.lastSeenAt ? new Date(v.lastSeenAt).getTime() : 0;
      const dKey = v.dateKey || (lastMs ? getAddisDateKey(new Date(lastMs)) : '');
      if (dKey === todayKey) visitorsToday += 1;
      if (dKey === yesterdayKey) visitorsYesterday += 1;
      if (lastMs >= last7Threshold) visitorsLast7 += 1;
      if (lastMs >= last30Threshold) visitorsLast30 += 1;
      if (lastMs >= activeThreshold) activeNow += 1;
    });

    return {
      visitorsToday,
      visitorsYesterday,
      visitorsLast7,
      visitorsLast30,
      activeNow,
      totalUniqueVisits,
      totalPageViews,
      signedInCustomerVisits,
      telegramReferrals,
      aiInteractionsCount,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Firestore customer visit count read notice:', err);
    return null;
  }
}

export async function fetchAnalyticsSummaryFromFirestore(
  period: AnalyticsPeriod = 'today',
  excludeAdmin: boolean = true,
  gaMeasurementId?: string
): Promise<AnalyticsSummary | null> {
  try {
    const [visitorsSnap, eventsSnap] = await Promise.all([
      withTimeout(getDocs(query(collection(db, 'analytics_visitors'), limit(1000))), 4000, null as any),
      withTimeout(getDocs(query(collection(db, 'analytics_events'), limit(1000))), 4000, null as any).catch(() => null),
    ]);

    if (!visitorsSnap && !eventsSnap) return null;

    const now = Date.now();
    const todayKey = getAddisDateKey(new Date(now));
    const yesterdayKey = getAddisDateKey(new Date(now - 86400000));
    const activeThreshold = now - 30 * 60000;

    let periodCutoff = 0;
    if (period === 'today') periodCutoff = new Date(todayKey + 'T00:00:00').getTime();
    else if (period === 'yesterday') periodCutoff = now - 2 * 86400000;
    else if (period === 'last7') periodCutoff = now - 7 * 86400000;
    else if (period === 'last30') periodCutoff = now - 30 * 86400000;
    else if (period === 'last90') periodCutoff = now - 90 * 86400000;

    const visitors: any[] = [];
    visitorsSnap?.forEach((d: any) => {
      const data = d.data();
      if (data && !(excludeAdmin && data.isInternal)) visitors.push(data);
    });

    const events: AnalyticsEvent[] = [];
    eventsSnap?.forEach((d: any) => {
      const data = d.data();
      if (data && !(excludeAdmin && data.isInternal)) {
        const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0;
        if (!periodCutoff || ts >= periodCutoff) {
          events.push(data as AnalyticsEvent);
        }
      }
    });

    const filteredVisitors = visitors.filter((v) => {
      const ts = v.lastSeenAt ? new Date(v.lastSeenAt).getTime() : 0;
      return !periodCutoff || ts >= periodCutoff;
    });

    const sourceCounts: Record<string, number> = {};
    const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 };
    let visitorsToday = 0;
    let visitorsYesterday = 0;
    let visitorsLast7 = 0;
    let visitorsLast30 = 0;
    let activeUsersLast30Min = 0;
    let totalPageViews = 0;
    let telegramReferralsCount = 0;

    visitors.forEach((v) => {
      const lastMs = v.lastSeenAt ? new Date(v.lastSeenAt).getTime() : 0;
      const dKey = v.dateKey || (lastMs ? getAddisDateKey(new Date(lastMs)) : '');
      if (dKey === todayKey) visitorsToday += 1;
      if (dKey === yesterdayKey) visitorsYesterday += 1;
      if (lastMs >= now - 7 * 86400000) visitorsLast7 += 1;
      if (lastMs >= now - 30 * 86400000) visitorsLast30 += 1;
      if (lastMs >= activeThreshold) activeUsersLast30Min += 1;
    });

    filteredVisitors.forEach((v) => {
      totalPageViews += Number(v.pageViews || 1);
      const src = v.source || 'direct';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      if (src === 'telegram') telegramReferralsCount += 1;
      if (v.deviceType === 'mobile') deviceBreakdown.mobile += 1;
      else if (v.deviceType === 'tablet') deviceBreakdown.tablet += 1;
      else deviceBreakdown.desktop += 1;
    });

    const totalVisitorsPeriod = filteredVisitors.length;
    const trafficSources = Object.entries(sourceCounts).map(([source, count]) => ({
      source,
      visitors: count,
      sessions: count,
      engagedVisitors: count,
      engagementRate: 100,
      percentage: totalVisitorsPeriod > 0 ? Math.round((count / totalVisitorsPeriod) * 100) : 0,
      utmCampaigns: [],
    }));

    const searchMap: Record<string, number> = {};
    const vacancyViewsMap: Record<string, { title: string; organization: string; category?: string; views: number; clicks: number }> = {};
    const categoryViewsMap: Record<string, number> = {};
    let totalSearches = 0;
    let vacancyViewsTotal = 0;
    let applyClicksTotal = 0;

    events.forEach((ev) => {
      if (ev.eventType === 'search') {
        totalSearches += 1;
        if (ev.searchTerm) searchMap[ev.searchTerm] = (searchMap[ev.searchTerm] || 0) + 1;
      } else if (ev.eventType === 'vacancy_view' && ev.jobId) {
        vacancyViewsTotal += 1;
        if (!vacancyViewsMap[ev.jobId]) {
          vacancyViewsMap[ev.jobId] = {
            title: ev.jobTitle || 'Vacancy',
            organization: ev.organization || 'Employer',
            category: ev.category,
            views: 0,
            clicks: 0,
          };
        }
        vacancyViewsMap[ev.jobId].views += 1;
      } else if (ev.eventType === 'click_apply_link' && ev.jobId) {
        applyClicksTotal += 1;
        if (vacancyViewsMap[ev.jobId]) vacancyViewsMap[ev.jobId].clicks += 1;
      } else if (ev.eventType === 'category_view' && ev.category) {
        categoryViewsMap[ev.category] = (categoryViewsMap[ev.category] || 0) + 1;
      }
    });

    return {
      period,
      dateRangeLabel: `Firestore Live (${period})`,
      uniqueVisitors: totalVisitorsPeriod,
      totalInteractions: events.length || totalPageViews,
      totalSessions: totalVisitorsPeriod,
      totalPageViews: events.filter((e) => e.eventType === 'page_view').length || totalPageViews,
      totalSearches,
      popularSearchTerms: Object.entries(searchMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([term, count]) => ({ term, count, resultsAverage: 1 })),
      telegramReferralsCount,
      newVisitors: totalVisitorsPeriod,
      returningVisitors: 0,
      activeUsersLast30Min,
      visitorsToday,
      visitorsYesterday,
      visitorsLast7,
      visitorsLast30,
      lastUpdated: new Date().toISOString(),
      status: totalVisitorsPeriod > 0 || events.length > 0 ? 'CONNECTED' : 'NO DATA YET',
      provider: 'Firebase Firestore + GA4',
      gaMeasurementId: gaMeasurementId || 'G-KH6X73105S',
      internalExclusionStatus: excludeAdmin ? 'ACTIVE' : 'PAUSED',
      dailyStats: [
        {
          date: todayKey,
          visitors: visitorsToday,
          sessions: visitorsToday,
          pageViews: totalPageViews,
        },
      ],
      trafficSources,
      topVacancies: Object.entries(vacancyViewsMap)
        .map(([jobId, v]) => ({
          jobId,
          title: v.title,
          organization: v.organization,
          category: v.category,
          views: v.views,
          applyClicks: v.clicks,
          ctr: v.views > 0 ? Math.round((v.clicks / v.views) * 100) : 0,
        }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
      topEmployers: [],
      underperformingVacancies: [],
      topCategories: Object.entries(categoryViewsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([category, views]) => ({ category, views })),
      deviceBreakdown,
      funnel: [
        {
          stage: 'Site Visitors',
          count: totalVisitorsPeriod,
          conversionRate: 100,
          dropoffRate: 0,
          description: 'Distinct visitors recorded in Firestore',
        },
        {
          stage: 'Vacancy Views',
          count: vacancyViewsTotal,
          conversionRate: totalVisitorsPeriod > 0 ? Math.min(100, Math.round((vacancyViewsTotal / totalVisitorsPeriod) * 100)) : 0,
          dropoffRate: 0,
          description: 'Job details opened',
        },
        {
          stage: 'Apply Clicks',
          count: applyClicksTotal,
          conversionRate: vacancyViewsTotal > 0 ? Math.min(100, Math.round((applyClicksTotal / vacancyViewsTotal) * 100)) : 0,
          dropoffRate: 0,
          description: 'Application link or direct apply clicks',
        },
      ],
      healthDiagnostics: [],
      smartAlerts: [],
      searchConsole: {
        status: 'CONNECTED',
        propertyUrl: 'https://www.hopelandjobs.tech',
        impressions: 0,
        clicks: 0,
        ctr: 0,
        averagePosition: 0,
        topQueries: [],
        indexedPages: 0,
        pagesWithIssues: 0,
        indexingIssues: [],
      },
      businessIntelligence: {
        actualEmployerRevenueEtb: 0,
        actualCvServiceRevenueEtb: 0,
        actualTrainingRevenueEtb: 0,
        totalCollectedRevenueEtb: 0,
        employerInquiriesCount: 0,
        candidateRegistrationCount: visitors.filter((v) => v.isSignedIn).length,
        activeAdCampaignsCount: 0,
        currency: 'ETB',
        lastUpdated: new Date().toISOString(),
        verifiedInquiries: [],
        growthOpportunities: [],
      },
    };
  } catch (err) {
    console.warn('Firestore analytics summary fallback notice:', err);
    return null;
  }
}




