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

const PLACEHOLDER_TEXT = new Set([
  '',
  'na',
  'n/a',
  'none',
  'nil',
  'tbd',
  'unknown',
  'notapplicable',
  'notspecified',
  'notspecifiedintheoriginalvacancy',
]);

const UNSPECIFIED_LOCATIONS = new Set([
  '',
  'ethiopia',
  'various',
  'multiple',
  'multiplelocations',
  'all',
  'allethiopianlocations',
  'anywhere',
  'notspecified',
  'notspecifiedintheoriginalvacancy',
]);

const SENIORITY_AND_LEVEL_TOKENS = new Set([
  'junior',
  'jr',
  'senior',
  'sr',
  'assistant',
  'asst',
  'associate',
  'deputy',
  'lead',
  'principal',
  'chief',
  'head',
  'trainee',
  'intern',
  'graduate',
  'entry',
  'mid',
  'executive',
  'director',
  'manager',
  'supervisor',
  'coordinator',
  'specialist',
  'officer',
  'analyst',
  'advisor',
  'consultant',
]);

const GRADE_OR_NUMERAL_REGEX = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|[1-9]|10|a|b|c|d)$/i;

export function cleanOrg(org?: string): string {
  if (!org) return '';
  const lower = org
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
    .replace(/\b(share company|s\.c\.|s\.c|p\.l\.c\.|p\.l\.c|plc|ltd|limited|inc|incorporated|llc|llp)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (!lower) return '';
  if (ORG_ALIASES[lower]) return ORG_ALIASES[lower].replace(/[^a-z0-9]/g, '');

  const withoutTrailingEthiopia = lower.replace(/\s+ethiopia$/i, '').trim();
  if (withoutTrailingEthiopia && ORG_ALIASES[withoutTrailingEthiopia]) {
    return ORG_ALIASES[withoutTrailingEthiopia].replace(/[^a-z0-9]/g, '');
  }

  for (const [alias, canonical] of Object.entries(ORG_ALIASES)) {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escapedAlias}$|\\b${escapedAlias}\\b`, 'i');
    if (alias.length >= 4 && regex.test(lower)) {
      return canonical.replace(/[^a-z0-9]/g, '');
    }
  }

  const effective = withoutTrailingEthiopia.length >= 4 ? withoutTrailingEthiopia : lower;
  return effective.replace(/\s+/g, '');
}

export function isSameOrg(org1?: string, org2?: string): boolean {
  const c1 = cleanOrg(org1);
  const c2 = cleanOrg(org2);
  if (!c1 || !c2) return false;
  return c1 === c2;
}

function normalizeTitleWords(title?: string): string[] {
  if (!title) return [];
  const normalized = title
    .toLowerCase()
    .replace(/^(position|job title|role|vacancy announcement|job vacancy)\s*[:\-–—]\s*/gi, '')
    .replace(/\s*[-–—(\[]\s*(full[\s-]?time|part[\s-]?time|contract|permanent|urgent|re-?advertised)\s*[)\]]?\s*$/gi, '')
    .replace(/\b(sr\.?|sr)\b/gi, 'senior')
    .replace(/\b(jr\.?|jr)\b/gi, 'junior')
    .replace(/\b(asst\.?|asst)\b/gi, 'assistant')
    .replace(/\b(mgr\.?|mgr)\b/gi, 'manager')
    .replace(/\b(eng\.?|eng)\b/gi, 'engineer')
    .replace(/\b(dev\.?|dev)\b/gi, 'developer')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

export function cleanTitle(title?: string): string {
  return normalizeTitleWords(title).join('');
}

function hasConflictingLevelOrGrade(title1?: string, title2?: string): boolean {
  const words1 = normalizeTitleWords(title1);
  const words2 = normalizeTitleWords(title2);

  const levels1 = words1.filter((w) => SENIORITY_AND_LEVEL_TOKENS.has(w)).sort().join('|');
  const levels2 = words2.filter((w) => SENIORITY_AND_LEVEL_TOKENS.has(w)).sort().join('|');
  if (levels1 !== levels2) return true;

  const grades1 = words1.filter((w) => GRADE_OR_NUMERAL_REGEX.test(w)).sort().join('|');
  const grades2 = words2.filter((w) => GRADE_OR_NUMERAL_REGEX.test(w)).sort().join('|');
  if (grades1 !== grades2) return true;

  return false;
}

function normalizeLocation(loc?: string): string {
  if (!loc) return '';
  const cleaned = loc.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compact = cleaned.replace(/\s+/g, '');
  if (UNSPECIFIED_LOCATIONS.has(compact)) return '';
  return cleaned;
}

export function areLocationsCompatible(loc1?: string, loc2?: string): boolean {
  const n1 = normalizeLocation(loc1);
  const n2 = normalizeLocation(loc2);
  if (!n1 || !n2) return true;
  if (n1 === n2) return true;
  const w1 = n1.split(/\s+/);
  const w2 = n2.split(/\s+/);
  if (w1.length === 1 && w2.includes(w1[0])) return true;
  if (w2.length === 1 && w1.includes(w2[0])) return true;
  return false;
}

function normalizeRefNumber(ref?: string): string | null {
  if (!ref) return null;
  const cleaned = ref.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleaned || cleaned.length < 3 || PLACEHOLDER_TEXT.has(cleaned)) {
    return null;
  }
  return cleaned;
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
 * Strict, accurate duplicate vacancy check.
 * Only flags genuinely identical vacancies while allowing distinct roles,
 * seniority levels, grades, branch cities, and shared career portal URLs.
 */
export function checkDuplicateVacancy(
  candidate: Partial<Vacancy>,
  existingVacancies: Vacancy[],
  currentVacancyId?: string
): DuplicateMatchResult {
  const candTitleClean = cleanTitle(candidate.title || '');
  const candRef = normalizeRefNumber(candidate.referenceNumber);

  for (const existing of existingVacancies) {
    if (currentVacancyId && existing.id === currentVacancyId) {
      continue;
    }
    if (existing.status === 'duplicate' || existing.status === 'archived') {
      continue;
    }

    const sameOrg = isSameOrg(candidate.organization, existing.organization);
    if (!sameOrg) {
      continue;
    }

    const sameLocation = areLocationsCompatible(candidate.location, existing.location);
    if (!sameLocation) {
      continue;
    }

    const exTitleClean = cleanTitle(existing.title || '');
    const exRef = normalizeRefNumber(existing.referenceNumber);
    const titleSim = stringSimilarity(
      normalizeTitleWords(candidate.title).join(' '),
      normalizeTitleWords(existing.title).join(' ')
    );
    const conflictingRoleLevel = hasConflictingLevelOrGrade(candidate.title, existing.title);

    // Tier 1: Exact Normalized Title + Same Organization + Compatible Location
    if (candTitleClean && exTitleClean && candTitleClean === exTitleClean) {
      return {
        isDuplicate: true,
        matchedVacancy: existing,
        reason: `Identical position title "${candidate.title}" at "${existing.organization}"${existing.location ? ` (${existing.location})` : ''} already on record.`,
        similarityScore: 0.98,
      };
    }

    // Tier 2: Identical Valid Reference Number + Same Organization + Matching Role
    // (Allows multi-position announcements sharing one batch announcement reference code)
    if (candRef && exRef && candRef === exRef && !conflictingRoleLevel && titleSim >= 0.6) {
      return {
        isDuplicate: true,
        matchedVacancy: existing,
        reason: `Identical reference code "${candidate.referenceNumber}" and matching role "${existing.title}" already on record for ${existing.organization}.`,
        similarityScore: 1.0,
      };
    }

    // Tier 3: Near-Identical Title Formatting Variation (>= 90% token overlap, same level/grade)
    if (candTitleClean && exTitleClean && !conflictingRoleLevel && titleSim >= 0.9) {
      return {
        isDuplicate: true,
        matchedVacancy: existing,
        reason: `Near-identical position title (${Math.round(titleSim * 100)}%) with existing "${existing.title}" at ${existing.organization}.`,
        similarityScore: titleSim,
      };
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
    if (cand.status === 'duplicate' || cand.status === 'archived') continue;

    for (let j = i + 1; j < vacancies.length; j++) {
      const existing = vacancies[j];
      if (existing.status === 'duplicate' || existing.status === 'archived') continue;

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
