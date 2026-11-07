import { Vacancy, DuplicateReportItem } from '../types/job';

// Comprehensive Ethiopian Organization Aliases
const ORG_ALIASES: Record<string, string> = {
  cbe: 'commercial bank of ethiopia',
  'commercial bank of ethiopia': 'commercial bank of ethiopia',
  boa: 'bank of abyssinia',
  'bank of abyssinia': 'bank of abyssinia',
  awash: 'awash bank',
  'awash bank': 'awash bank',
  dashen: 'dashen bank',
  'dashen bank': 'dashen bank',
  coop: 'cooperative bank of oromia',
  'cooperative bank of oromia': 'cooperative bank of oromia',
  'coop bank': 'cooperative bank of oromia',
  wegagen: 'wegagen bank',
  'wegagen bank': 'wegagen bank',
  hibret: 'hibret bank',
  'hibret bank': 'hibret bank',
  'united bank': 'hibret bank',
  nib: 'nib international bank',
  'nib bank': 'nib international bank',
  'nib international bank': 'nib international bank',
  zemen: 'zemen bank',
  'zemen bank': 'zemen bank',
  berhan: 'berhan bank',
  'berhan bank': 'berhan bank',
  enat: 'enat bank',
  'enat bank': 'enat bank',
  'amhara bank': 'amhara bank',
  siinqee: 'siinqee bank',
  'siinqee bank': 'siinqee bank',
  'ethio telecom': 'ethio telecom',
  ethiotelecom: 'ethio telecom',
  etc: 'ethio telecom',
  eal: 'ethiopian airlines',
  'ethiopian airlines': 'ethiopian airlines',
  'ethiopian airlines group': 'ethiopian airlines',
  unicef: 'unicef',
  'unicef ethiopia': 'unicef',
  undp: 'undp',
  'undp ethiopia': 'undp',
  'save the children': 'save the children',
  'save the children international': 'save the children',
  'world vision': 'world vision',
  'world vision ethiopia': 'world vision',
  sheraton: 'sheraton addis',
  'sheraton addis': 'sheraton addis',
  skylight: 'ethiopian skylight hotel',
  'ethiopian skylight hotel': 'ethiopian skylight hotel',
  'radisson blu': 'radisson blu',
  'radisson blu addis ababa': 'radisson blu',
  hyatt: 'hyatt regency',
  'hyatt regency addis ababa': 'hyatt regency',
  'flintstone engineering': 'flintstone engineering',
  'sunshine construction': 'sunshine construction',
  'midroc investment group': 'midroc',
  midroc: 'midroc',
};

export function cleanOrg(org?: string): string {
  if (!org) return '';
  const lower = org.toLowerCase().trim();
  const stripped = lower
    .replace(/(share company|s\.c\.|s\.c|plc|p\.l\.c\.|p\.l\.c|ltd|limited|corporation|enterprise|organization|org|bank|hotel)/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();

  if (ORG_ALIASES[stripped]) return ORG_ALIASES[stripped];
  for (const [alias, canonical] of Object.entries(ORG_ALIASES)) {
    if (stripped === alias || (alias.length > 3 && stripped.includes(alias))) {
      return canonical;
    }
  }

  return stripped.replace(/\s+/g, '');
}

export function cleanTitle(title?: string): string {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/^(position|job title|role|vacancy announcement|job vacancy)\s*[:\-–—]\s*/gi, '')
    .replace(/[-–—]\s*(full time|part time|contract|urgent|re-advertised|readvertised).*$/gi, '')
    .replace(/\b(sr|sr\.)\b/gi, 'senior')
    .replace(/\b(jr|jr\.)\b/gi, 'junior')
    .replace(/\b(asst|asst\.)\b/gi, 'assistant')
    .replace(/\b(mgr|mgr\.)\b/gi, 'manager')
    .replace(/\b(eng|eng\.)\b/gi, 'engineer')
    .replace(/\b(dev|dev\.)\b/gi, 'developer')
    .replace(/\b(and|&)\b/gi, 'and')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function stringSimilarity(s1: string, s2: string): number {
  const norm1 = s1.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const norm2 = s2.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const words1 = new Set(norm1.split(/\s+/).filter(Boolean));
  const words2 = new Set(norm2.split(/\s+/).filter(Boolean));
  let intersection = 0;
  words1.forEach((w) => {
    if (words2.has(w)) intersection++;
  });
  const union = new Set([...words1, ...words2]).size;
  return union === 0 ? 0 : intersection / union;
}

export interface DuplicateMatchResult {
  isDuplicate: boolean;
  matchedVacancy?: Vacancy;
  reason?: string;
  similarityScore: number;
}

/**
 * Strict multi-tier duplicate vacancy check
 * Evaluates candidates against an existing vacancy pool.
 */
export function checkDuplicateVacancy(
  candidate: Partial<Vacancy>,
  existingVacancies: Vacancy[],
  currentVacancyId?: string
): DuplicateMatchResult {
  const candOrgClean = cleanOrg(candidate.organization || '');
  const candTitleClean = cleanTitle(candidate.title || '');
  const candRef = candidate.referenceNumber && candidate.referenceNumber !== 'Not specified in the original vacancy'
    ? candidate.referenceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')
    : null;

  for (const existing of existingVacancies) {
    if (currentVacancyId && existing.id === currentVacancyId) {
      continue;
    }

    const exOrgClean = cleanOrg(existing.organization || '');
    const exTitleClean = cleanTitle(existing.title || '');
    const exRef = existing.referenceNumber && existing.referenceNumber !== 'Not specified in the original vacancy'
      ? existing.referenceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')
      : null;

    // Tier 1: Exact Reference Number Match
    if (candRef && exRef && candRef === exRef) {
      return {
        isDuplicate: true,
        matchedVacancy: existing,
        reason: `Identical official reference code "${candidate.referenceNumber}" already on record for ${existing.organization}.`,
        similarityScore: 1.0,
      };
    }

    const sameOrg = candOrgClean.length > 0 && exOrgClean.length > 0 && (candOrgClean === exOrgClean || candOrgClean.includes(exOrgClean) || exOrgClean.includes(candOrgClean));

    // Tier 2: Exact Normalized Title + Same Organization
    if (sameOrg && candTitleClean && exTitleClean && candTitleClean === exTitleClean) {
      return {
        isDuplicate: true,
        matchedVacancy: existing,
        reason: `Identical position title "${candidate.title}" at "${existing.organization}" already on record.`,
        similarityScore: 0.98,
      };
    }

    // Tier 3: High Title Similarity (>= 80%) for Same Organization
    if (sameOrg && candTitleClean && exTitleClean) {
      const titleSim = stringSimilarity(candidate.title || '', existing.title || '');
      const substringMatch = (candTitleClean.length > 6 && exTitleClean.includes(candTitleClean)) || (exTitleClean.length > 6 && candTitleClean.includes(exTitleClean));
      if (titleSim >= 0.8 || (substringMatch && titleSim >= 0.65)) {
        return {
          isDuplicate: true,
          matchedVacancy: existing,
          reason: `High title similarity (${Math.round(titleSim * 100)}%) with existing "${existing.title}" at ${existing.organization}.`,
          similarityScore: titleSim,
        };
      }
    }

    // Tier 4: Matching Application URL / Portal Link for Same Organization
    if (
      sameOrg &&
      candidate.applicationUrl &&
      existing.applicationUrl &&
      candidate.applicationUrl !== 'Not specified in the original vacancy' &&
      candidate.applicationUrl.trim().toLowerCase() === existing.applicationUrl.trim().toLowerCase()
    ) {
      return {
        isDuplicate: true,
        matchedVacancy: existing,
        reason: `Identical direct application URL (${candidate.applicationUrl}) already exists for ${existing.organization}.`,
        similarityScore: 0.95,
      };
    }

    // Tier 5: High Full-Text Description Similarity (>= 75%) for Same Organization
    if (sameOrg && candidate.description && existing.description && candidate.description.length > 60 && existing.description.length > 60) {
      const descSim = stringSimilarity(candidate.description, existing.description);
      if (descSim >= 0.75) {
        return {
          isDuplicate: true,
          matchedVacancy: existing,
          reason: `High description text overlap (${Math.round(descSim * 100)}%) with job at ${existing.organization}.`,
          similarityScore: descSim,
        };
      }
    }
  }

  return {
    isDuplicate: false,
    similarityScore: 0,
  };
}

/**
 * Scans an entire list of vacancies (e.g. all currently stored in database)
 * to detect any existing duplicate pairs.
 */
export function auditAllExistingVacancies(vacancies: Vacancy[]): DuplicateReportItem[] {
  const reports: DuplicateReportItem[] = [];
  const processedSignatures = new Set<string>();

  for (let i = 0; i < vacancies.length; i++) {
    const cand = vacancies[i];
    if (cand.status === 'duplicate') continue;

    for (let j = i + 1; j < vacancies.length; j++) {
      const existing = vacancies[j];
      if (existing.status === 'duplicate') continue;

      const check = checkDuplicateVacancy(cand, [existing], cand.id);
      if (check.isDuplicate && check.matchedVacancy) {
        const pairKey = [cand.id, existing.id].sort().join('___');
        if (processedSignatures.has(pairKey)) continue;
        processedSignatures.add(pairKey);

        reports.push({
          id: `audit_dup_${Date.now()}_${i}_${j}`,
          candidateTitle: cand.title,
          candidateOrg: cand.organization,
          matchedVacancyId: existing.id,
          matchedTitle: existing.title,
          matchedOrg: existing.organization,
          matchedDeadline: existing.applicationDeadline,
          similarityScore: check.similarityScore,
          reason: check.reason || 'Identified as duplicate during database audit',
          status: 'discarded',
          detectedAt: new Date().toISOString(),
          candidateData: cand,
        });
      }
    }
  }

  return reports;
}
