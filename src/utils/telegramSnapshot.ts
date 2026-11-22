import { Vacancy } from '../types/job';
import { hasValidVacancyDeadline } from './vacancyValidator';

interface CompactTelegramVacancyPayload {
  i: string; // id
  t: string; // title
  o: string; // organization
  c?: string; // category
  l?: string; // location
  e?: string; // employmentType
  s?: string; // salary
  d: string; // applicationDeadline
  q?: string; // educationQualification
  f?: string; // requiredFieldOfStudy
  x?: string; // experienceYears
  k?: string[]; // requiredSkills
  b?: string; // description
  r?: string[]; // responsibilities
  m?: string; // applicationMethod
  u?: string; // applicationUrl
  a?: string; // applicationEmail
  p?: string; // applicationInstructions
  n?: string; // contactInfo
  g?: string; // publishedAt
}

function clip(val: unknown, maxLen: number): string | undefined {
  const s = String(val ?? '').trim();
  if (!s) return undefined;
  return s.length <= maxLen ? s : `${s.slice(0, Math.max(0, maxLen - 1)).trim()}…`;
}

function toBase64UrlUtf8(str: string): string {
  // Works in both Node.js and all browsers
  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64UrlUtf8(b64url: string): string {
  const padded = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(b64url.length / 4) * 4, '=');

  if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
    return Buffer.from(padded, 'base64').toString('utf-8');
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a compact, URL-safe portable vacancy snapshot for Telegram inline Apply buttons.
 * Ensures that even if a visitor on another phone hits a cold serverless instance or
 * an unsynced Developer-Password post, clicking Apply Now in Telegram still opens the exact job.
 */
export function encodeTelegramVacancySnapshot(
  vacancy: any,
  maxEncodedLength = 1450
): string | null {
  if (!vacancy || typeof vacancy !== 'object') return null;
  const id = String(vacancy.id || '').trim();
  const title = clip(vacancy.title, 140);
  const organization = clip(vacancy.organization, 120);
  const deadline = clip(vacancy.applicationDeadline, 80);
  if (!id || !title || !organization || !deadline) return null;

  const tiers = [
    { descMax: 360, instrMax: 240, respCount: 4, respMax: 90, skillCount: 6 },
    { descMax: 200, instrMax: 160, respCount: 2, respMax: 75, skillCount: 4 },
    { descMax: 120, instrMax: 120, respCount: 0, respMax: 0, skillCount: 3 },
    { descMax: 0, instrMax: 100, respCount: 0, respMax: 0, skillCount: 0 },
  ];

  for (const tier of tiers) {
    const payload: CompactTelegramVacancyPayload = {
      i: id,
      t: title,
      o: organization,
      d: deadline,
      ...(clip(vacancy.category, 60) ? { c: clip(vacancy.category, 60) } : {}),
      ...(clip(vacancy.location, 80) ? { l: clip(vacancy.location, 80) } : {}),
      ...(clip(vacancy.employmentType, 30) ? { e: clip(vacancy.employmentType, 30) } : {}),
      ...(clip(vacancy.salary, 70) ? { s: clip(vacancy.salary, 70) } : {}),
      ...(clip(vacancy.educationQualification, 120)
        ? { q: clip(vacancy.educationQualification, 120) }
        : {}),
      ...(clip(vacancy.requiredFieldOfStudy, 100)
        ? { f: clip(vacancy.requiredFieldOfStudy, 100) }
        : {}),
      ...(clip(vacancy.experienceYears, 60) ? { x: clip(vacancy.experienceYears, 60) } : {}),
      ...(clip(vacancy.applicationMethod, 60) ? { m: clip(vacancy.applicationMethod, 60) } : {}),
      ...(clip(vacancy.applicationUrl, 240) ? { u: clip(vacancy.applicationUrl, 240) } : {}),
      ...(clip(vacancy.applicationEmail, 100) ? { a: clip(vacancy.applicationEmail, 100) } : {}),
      ...(clip(vacancy.contactInfo, 140) ? { n: clip(vacancy.contactInfo, 140) } : {}),
      ...(clip(vacancy.publishedAt, 40) ? { g: clip(vacancy.publishedAt, 40) } : {}),
    };

    if (tier.descMax > 0) {
      const b = clip(vacancy.description, tier.descMax);
      if (b) payload.b = b;
    }
    if (tier.instrMax > 0) {
      const p = clip(vacancy.applicationInstructions, tier.instrMax);
      if (p) payload.p = p;
    }
    if (tier.skillCount > 0 && Array.isArray(vacancy.requiredSkills)) {
      const skills = vacancy.requiredSkills
        .map((sk: any) => clip(sk, 40))
        .filter(Boolean)
        .slice(0, tier.skillCount) as string[];
      if (skills.length > 0) payload.k = skills;
    }
    if (tier.respCount > 0 && Array.isArray(vacancy.responsibilities)) {
      const resps = vacancy.responsibilities
        .map((rp: any) => clip(rp, tier.respMax))
        .filter(Boolean)
        .slice(0, tier.respCount) as string[];
      if (resps.length > 0) payload.r = resps;
    }

    try {
      const encoded = `j.${toBase64UrlUtf8(JSON.stringify(payload))}`;
      if (encoded.length <= maxEncodedLength) {
        return encoded;
      }
    } catch {
      return null;
    }
  }

  // Tier 5 ultra-compact guarantee so long fields never prevent embedding a valid portable snapshot
  try {
    const minimal: CompactTelegramVacancyPayload = {
      i: id,
      t: clip(vacancy.title, 85) || title.slice(0, 85),
      o: clip(vacancy.organization, 70) || organization.slice(0, 70),
      d: clip(vacancy.applicationDeadline, 40) || deadline.slice(0, 40),
      ...(clip(vacancy.location, 45) ? { l: clip(vacancy.location, 45) } : {}),
      ...(clip(vacancy.applicationMethod, 30) ? { m: clip(vacancy.applicationMethod, 30) } : {}),
      ...(clip(vacancy.applicationUrl, 160) ? { u: clip(vacancy.applicationUrl, 160) } : {}),
      ...(clip(vacancy.applicationEmail, 70) ? { a: clip(vacancy.applicationEmail, 70) } : {}),
    };
    const encodedMin = `j.${toBase64UrlUtf8(JSON.stringify(minimal))}`;
    if (encodedMin.length <= maxEncodedLength) {
      return encodedMin;
    }
  } catch {}

  return null;
}

/**
 * Decodes a portable Telegram snapshot query parameter (`v=...`) back into a displayable Vacancy.
 * Still enforces the strict valid-deadline check.
 */
export function decodeTelegramVacancySnapshot(encoded: string | null | undefined): Vacancy | null {
  const raw = String(encoded || '').trim();
  if (!raw || raw.length > 3500) return null;

  try {
    const token = raw.startsWith('j.') ? raw.slice(2) : raw;
    const jsonStr = fromBase64UrlUtf8(token);
    const parsed = JSON.parse(jsonStr) as CompactTelegramVacancyPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.i || !parsed.t || !parsed.o || !parsed.d) {
      return null;
    }

    const rawMethod = String(parsed.m || '').trim();
    const normalizedMethod: Vacancy['applicationMethod'] =
      rawMethod === 'Online URL' ||
      rawMethod === 'Email' ||
      rawMethod === 'In-Person / Physical' ||
      rawMethod === 'Postal / Mail' ||
      rawMethod === 'Other'
        ? rawMethod
        : parsed.u
        ? 'Online URL'
        : parsed.a
        ? 'Email'
        : rawMethod.toLowerCase().includes('person') || rawMethod.toLowerCase().includes('physical')
        ? 'In-Person / Physical'
        : rawMethod.toLowerCase().includes('mail') || rawMethod.toLowerCase().includes('postal')
        ? 'Postal / Mail'
        : 'Other';

    const nowIso = new Date().toISOString();
    const reconstructed: Vacancy = {
      id: String(parsed.i).trim(),
      title: String(parsed.t).trim(),
      organization: String(parsed.o).trim(),
      category: (String(parsed.c || 'Private Companies').trim() || 'Private Companies') as Vacancy['category'],
      location: String(parsed.l || 'Addis Ababa').trim(),
      employmentType: (parsed.e as Vacancy['employmentType']) || 'Full-time',
      vacanciesCount: '',
      salary: String(parsed.s || '').trim(),
      educationQualification: String(parsed.q || '').trim(),
      requiredFieldOfStudy: String(parsed.f || '').trim(),
      experienceYears: String(parsed.x || '').trim(),
      requiredSkills: Array.isArray(parsed.k) ? parsed.k.map(String) : [],
      description:
        String(parsed.b || '').trim() ||
        `${parsed.o} is inviting qualified applicants for the position of ${parsed.t} (${parsed.l || 'Ethiopia'}).`,
      responsibilities: Array.isArray(parsed.r) ? parsed.r.map(String) : [],
      requiredDocuments: [],
      applicationMethod: normalizedMethod,
      applicationEmail: String(parsed.a || '').trim(),
      applicationUrl: String(parsed.u || '').trim(),
      applicationInstructions:
        String(parsed.p || '').trim() ||
        'Please review the official employer application channel below and submit your application before the deadline.',
      applicationDeadline: String(parsed.d).trim(),
      contactInfo: String(parsed.n || '').trim(),
      status: 'published',
      featured: false,
      viewsCount: 0,
      sharesCount: 0,
      createdAt: parsed.g || nowIso,
      updatedAt: parsed.g || nowIso,
      publishedAt: parsed.g || nowIso,
      telegramPublished: true,
    };

    if (!hasValidVacancyDeadline(reconstructed)) {
      return null;
    }
    return reconstructed;
  } catch {
    return null;
  }
}
