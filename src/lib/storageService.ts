import {
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
  getMetadata,
} from 'firebase/storage';
import { storage, auth, safeResponseJson } from './firebase';

export interface UploadResult {
  success: boolean;
  downloadUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
  error?: string;
}

export interface StorageMetrics {
  targetCapacityBytes: number; // 10 GB target (10 * 1024 * 1024 * 1024)
  targetCapacityGb: number;
  usedBytes: number;
  usedMb: number;
  usedPercentage: number;
  totalDocumentsCount: number;
  storageBucket: string;
  cloudTier: 'Blaze (Pay-as-you-go, 10 GB+ scalable)' | 'Standard Cloud Storage';
  status: 'OPTIMAL' | 'NEAR_QUOTA' | 'QUOTA_EXCEEDED';
  lastCalculatedAt: string;
}

export const TARGET_STORAGE_CAPACITY_GB = 10;
export const TARGET_STORAGE_CAPACITY_BYTES = TARGET_STORAGE_CAPACITY_GB * 1024 * 1024 * 1024; // 10,737,418,240 bytes

/**
 * Upload a binary File/Blob (CV, certificate, supporting doc) directly to Firebase Cloud Storage.
 * Stores binary files in Firebase Storage and keeps Firestore documents lightweight (<10KB).
 */
export async function uploadDocumentToCloud(
  file: File | Blob,
  docId: string,
  fileName: string,
  folder = 'documents'
): Promise<UploadResult> {
  const user = auth.currentUser;
  const userPrefix = user?.uid || 'nexus_yeabsra_vault';
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${userPrefix}/${docId}_${cleanFileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const mimeType = file.type || 'application/pdf';
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: mimeType,
      customMetadata: {
        docId,
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user?.email || 'admin',
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      downloadUrl,
      storagePath,
      fileSizeBytes: file.size,
      mimeType,
    };
  } catch (err: any) {
    console.warn('Firebase Storage direct upload notice, attempting backend upload fallback:', err);
    try {
      const formData = new FormData();
      formData.append('file', file, fileName);
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await safeResponseJson<{ downloadUrl?: string; fileSizeBytes?: number; mimeType?: string }>(res);
        if (data?.downloadUrl) {
          return {
            success: true,
            downloadUrl: data.downloadUrl,
            storagePath: data.downloadUrl,
            fileSizeBytes: data.fileSizeBytes || file.size,
            mimeType: data.mimeType || file.type || 'application/pdf',
          };
        }
      }
    } catch (fallbackErr) {
      console.warn('Server upload fallback failed:', fallbackErr);
    }

    return {
      success: false,
      downloadUrl: '',
      storagePath: '',
      fileSizeBytes: file.size,
      mimeType: file.type || 'application/pdf',
      error: err.message || String(err),
    };
  }
}

/**
 * Upload a Base64 data string (e.g. generated tailored CV or application letter PDF)
 * to Firebase Storage.
 */
export async function uploadBase64PdfToCloud(
  dataUriOrBase64: string,
  docId: string,
  fileName: string,
  folder = 'generated_applications'
): Promise<UploadResult> {
  const user = auth.currentUser;
  const userPrefix = user?.uid || 'nexus_yeabsra_vault';
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${userPrefix}/${docId}_${cleanFileName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const rawData = dataUriOrBase64.includes(',')
      ? dataUriOrBase64.split(',')[1]
      : dataUriOrBase64;

    const snapshot = await uploadString(storageRef, rawData, 'base64', {
      contentType: 'application/pdf',
      customMetadata: {
        docId,
        fileName,
        generatedAt: new Date().toISOString(),
        generatedBy: user?.email || 'admin',
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    const approxBytes = Math.round((rawData.length * 3) / 4);

    return {
      success: true,
      downloadUrl,
      storagePath,
      fileSizeBytes: approxBytes,
      mimeType: 'application/pdf',
    };
  } catch (err: any) {
    console.warn('Firebase Storage PDF upload notice, attempting backend fallback:', err);
    try {
      const approxBytes = Math.round((dataUriOrBase64.length * 3) / 4);
      const res = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileData: dataUriOrBase64,
          fileType: 'application/pdf',
        }),
      });
      if (res.ok) {
        const data = await safeResponseJson<{ downloadUrl?: string; fileSizeBytes?: number }>(res);
        if (data?.downloadUrl) {
          return {
            success: true,
            downloadUrl: data.downloadUrl,
            storagePath: data.downloadUrl,
            fileSizeBytes: data.fileSizeBytes || approxBytes,
            mimeType: 'application/pdf',
          };
        }
      }
    } catch (fallbackErr) {
      console.warn('Server base64 upload fallback failed:', fallbackErr);
    }

    return {
      success: false,
      downloadUrl: '',
      storagePath: '',
      fileSizeBytes: 0,
      mimeType: 'application/pdf',
      error: err.message || String(err),
    };
  }
}

/**
 * Delete a document from Firebase Storage
 */
export async function deleteDocumentFromCloud(storagePath: string): Promise<boolean> {
  if (!storagePath) return false;
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.warn('Firebase Storage delete notice:', err);
    return false;
  }
}

/**
 * Calculate actual storage metrics for System Health monitoring
 * Targets at least 10 GB persistent capacity with real usage reporting
 */
export function calculateStorageMetrics(
  documents: { fileSize?: number; fileSizeBytes?: number }[] = []
): StorageMetrics {
  const totalBytes = documents.reduce((acc, doc) => {
    return acc + (doc.fileSizeBytes || doc.fileSize || 0);
  }, 0);

  const usedMb = Number((totalBytes / (1024 * 1024)).toFixed(2));
  const usedPercentage = Number(
    ((totalBytes / TARGET_STORAGE_CAPACITY_BYTES) * 100).toFixed(4)
  );

  let status: StorageMetrics['status'] = 'OPTIMAL';
  if (usedPercentage > 90) status = 'QUOTA_EXCEEDED';
  else if (usedPercentage > 75) status = 'NEAR_QUOTA';

  return {
    targetCapacityBytes: TARGET_STORAGE_CAPACITY_BYTES,
    targetCapacityGb: TARGET_STORAGE_CAPACITY_GB,
    usedBytes: totalBytes,
    usedMb,
    usedPercentage,
    totalDocumentsCount: documents.length,
    storageBucket: 'gen-lang-client-0056760370.firebasestorage.app',
    cloudTier: 'Blaze (Pay-as-you-go, 10 GB+ scalable)',
    status,
    lastCalculatedAt: new Date().toISOString(),
  };
}
