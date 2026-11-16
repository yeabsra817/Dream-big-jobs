import { Vacancy } from '../types/job';
import { JobSeekerProfile } from '../types/jobSeeker';
import { InternationalJob, ExperienceScholarship } from '../types/international';

export type RecommendationSourceType = 'domestic_job' | 'international_job' | 'scholarship';

export interface RecommendedOpportunity {
  id: string;
  sourceType: RecommendationSourceType;
  title: string;
  organization: string;
  location: string;
  category: string;
  salary?: string;
  deadline: string;
  matchScore: number;
  eligibilityStatus: 'Eligible' | 'Partially Qualified';
  isFullyQualified: boolean;
  matchReasons: string[];
  missingMandatoryQualifications: string[];
  requiredExperienceText: string;
  requiredEducationText: string;
  applyUrl?: string;
  vacancy?: Vacancy;
  internationalJob?: InternationalJob;
  scholarship?: ExperienceScholarship;
}

const EDUCATION_RANK: Record<string, number> = {
  none: 0,
  certificate: 1,
  tvet: 1,
  diploma: 2,
  associate: 2,
  bachelor: 3,
  undergraduate: 3,
  master: 4,
  postgraduate: 4,
  phd: 5,
  doctorate: 5,
};

const RANK_LABELS: Record<number, string> = {
  1: 'TVET / Certificate',
  2: 'Diploma / Associate',
  3: "Bachelor's Degree",
  4: "Master's Degree",
  5: 'PhD / Doctorate',
};

export function detectEducationRank(text?: string): number {
  const normalized = (text || '').toLowerCase();
  if (!normalized) return 0;
  if (/(phd|doctorate|doctoral)/i.test(normalized)) return EDUCATION_RANK.phd;
  if (/(master|msc|ma\b|mba|mph|llm|postgraduate|post-graduate)/i.test(normalized)) return EDUCATION_RANK.master;
  if (/(bachelor|bsc|ba\b|b\.?tech|b\.?eng|undergraduate|first degree|university degree|\bdegree\b)/i.test(normalized)) {
    return EDUCATION_RANK.bachelor;
  }
  if (/(diploma|associate|level iv|level 4|hnd)/i.test(normalized)) return EDUCATION_RANK.diploma;
  if (/(certificate|tvet|high school|grade 12|secondary)/i.test(normalized)) return EDUCATION_RANK.certificate;
  return 0;
}

export function getProfileMaxEducationRank(profile: JobSeekerProfile): { rank: number; label: string } {
  let maxRank = 0;
  let maxLabel = '';
  for (const edu of profile.education || []) {
    const r = detectEducationRank(`${edu.qualification} ${edu.fieldOfStudy} ${edu.additionalInfo || ''}`);
    if (r > maxRank) {
      maxRank = r;
      maxLabel = `${edu.qualification}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}`;
    }
  }
  return { rank: maxRank, label: maxLabel };
}

export function parseMinRequiredYears(text?: string): number | null {
  const normalized = (text || '').toLowerCase().trim();
  if (!normalized || /(not stated|none|fresh graduate|entry|0\s*year|no experience)/i.test(normalized)) {
    return 0;
  }
  const rangeMatch = normalized.match(/(\d+)\s*(?:-|to|\+)\s*(\d+)?\s*(?:years?|yrs?)/i);
  if (rangeMatch) {
    return parseInt(rangeMatch[1], 10);
  }
  const singleMatch = normalized.match(/(?:at least|minimum|min\.?|over|\+)?\s*(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/i);
  if (singleMatch) {
    return parseInt(singleMatch[1], 10);
  }
  return null;
}

export function getProfileExplicitExperienceYears(profile: JobSeekerProfile): number {
  const fromField = parseMinRequiredYears(profile.yearsOfExperience);
  let expYearsFromEntries = 0;
  const nowYear = new Date().getFullYear();
  for (const exp of profile.experience || []) {
    const startYearMatch = (exp.startDate || '').match(/(19|20)\d{2}/);
    if (!startYearMatch) continue;
    const startY = parseInt(startYearMatch[0], 10);
    let endY = nowYear;
    if (!exp.isCurrent) {
      const endYearMatch = (exp.endDate || '').match(/(19|20)\d{2}/);
      if (endYearMatch) endY = parseInt(endYearMatch[0], 10);
    }
    if (endY >= startY && endY - startY <= 50) {
      expYearsFromEntries += Math.max(0.5, endY - startY);
    }
  }
  return Math.max(fromField ?? 0, Math.floor(expYearsFromEntries));
}

export function isDeadlineExpired(deadline?: string): boolean {
  if (!deadline) return false;
  const trimmed = deadline.trim().toLowerCase();
  if (!trimmed || /rolling|ongoing|open|not stated|asap|until filled/i.test(trimmed)) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  // Compare end of deadline day (24h grace margin to avoid premature expiry within deadline day)
  return parsed.getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

export function isDeadlineApproaching(deadline?: string, withinHours = 72): boolean {
  if (!deadline) return false;
  const trimmed = deadline.trim().toLowerCase();
  if (!trimmed || /rolling|ongoing|open|not stated|asap|until filled/i.test(trimmed)) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = parsed.getTime() - Date.now();
  return diffMs > 0 && diffMs <= withinHours * 60 * 60 * 1000;
}

// Broad sector keyword mapping across all Ethiopian & international sectors
const SECTOR_ALIAS_GROUPS: Array<{ label: string; keywords: string[] }> = [
  { label: 'banking', keywords: ['bank', 'banking', 'commercial bank', 'branch manager', 'credit', 'teller', 'treasury', 'loan officer', 'customer service officer'] },
  { label: 'microfinance', keywords: ['microfinance', 'mfi', 'sacco', 'micro-credit', 'micro finance'] },
  { label: 'insurance', keywords: ['insurance', 'underwriting', 'claims', 'actuarial', 'brokerage'] },
  { label: 'wash', keywords: ['wash', 'water supply', 'sanitation', 'hygiene', 'hydrogeology', 'water engineering', 'emergency wash'] },
  { label: 'ingo', keywords: ['international ngo', 'ngo', 'un ', 'unicef', 'undp', 'wfp', 'unhcr', 'humanitarian', 'save the children', 'nrc', 'drc', 'mercy corps', 'plan international', 'oxfam', 'care'] },
  { label: 'local_ngo', keywords: ['local ngo', 'civil society', 'cso', 'association', 'charity', 'community development'] },
  { label: 'government', keywords: ['government', 'ministry', 'public sector', 'bureau', 'federal', 'regional state', 'municipality', 'agency'] },
  { label: 'embassy', keywords: ['embassy', 'diplomatic', 'consulate', 'high commission', 'au ', 'african union', 'delegation'] },
  { label: 'airlines', keywords: ['airline', 'aviation', 'ethiopian airlines', 'flight', 'cabin crew', 'cargo', 'freight', 'airport'] },
  { label: 'hospitality', keywords: ['hotel', 'hospitality', 'tourism', 'travel', 'resort', 'lodge', 'catering', 'chef'] },
  { label: 'manufacturing', keywords: ['manufacturing', 'factory', 'industrial', 'plant', 'production', 'textile', 'brewery', 'cement', 'pharmaceutical manufacturing'] },
  { label: 'private', keywords: ['private', 'corporate', 'company', 'plc', 'share company', 'enterprise', 'telecom', 'safaricom', 'logistics', 'supply chain', 'procurement', 'sales', 'marketing', 'human resource', 'administration'] },
  { label: 'it', keywords: ['software', 'developer', 'engineer', 'it ', 'technology', 'data', 'network', 'cyber', 'devops', 'ict'] },
  { label: 'health', keywords: ['medical', 'health', 'hospital', 'clinic', 'nurse', 'doctor', 'pharmacist', 'public health', 'nutrition'] },
  { label: 'finance', keywords: ['accounting', 'finance', 'auditor', 'audit', 'tax', 'cpa', 'acca', 'ifrs'] },
  { label: 'education', keywords: ['education', 'university', 'college', 'teacher', 'lecturer', 'instructor', 'academic'] },
  { label: 'engineering', keywords: ['civil', 'construction', 'electrical', 'mechanical', 'architect', 'surveyor', 'site engineer'] },
  { label: 'other', keywords: ['other', 'general', 'all sector', 'any sector', 'multi-sector'] },
];

function extractSectorTags(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const group of SECTOR_ALIAS_GROUPS) {
    if (group.keywords.some((kw) => lower.includes(kw))) {
      found.push(group.label);
    }
  }
  return found;
}

function tokenizeProfileKeywords(profile: JobSeekerProfile) {
  const stopWords = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'to', 'at', 'or', 'on', 'officer', 'staff', 'job']);
  const splitClean = (values: string[]) =>
    Array.from(
      new Set(
        values
          .join(' ')
          .toLowerCase()
          .split(/[^a-z0-9+]+/)
          .filter((w) => w.length >= 3 && !stopWords.has(w))
      )
    );

  const preferredSectorsRaw = [
    profile.preferredIndustry || '',
    profile.staffDepartmentOrSector || '',
    ...(profile.preferredSectors || []),
    ...(profile.professionalInterests || []),
  ].filter(Boolean);

  return {
    titleTokens: splitClean([
      profile.currentPosition || '',
      profile.desiredJobTitle || '',
      ...(profile.previousPositions || []),
      ...(profile.experience || []).map((e) => e.jobTitle || ''),
    ]),
    skillTokens: (profile.skills || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    expertiseTokens: (profile.areasOfExpertise || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    interestTokens: (profile.professionalInterests || []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    certTokens: (profile.certifications || []).map((c) => `${c.name} ${c.issuingOrganization}`.trim().toLowerCase()).filter(Boolean),
    studyTokens: splitClean((profile.education || []).map((e) => `${e.fieldOfStudy} ${e.qualification}`)),
    preferredSectorTags: extractSectorTags(preferredSectorsRaw.join(' ')),
    preferredSectorsRaw: preferredSectorsRaw.map((s) => s.toLowerCase()),
  };
}

function detectMissingMandatoryLicenses(requiredText: string, profile: JobSeekerProfile): string[] {
  const req = requiredText.toLowerCase();
  const userText = [
    ...(profile.certifications || []).map((c) => `${c.name} ${c.issuingOrganization}`),
    ...(profile.skills || []),
    ...(profile.areasOfExpertise || []),
    ...(profile.education || []).map((e) => `${e.qualification} ${e.fieldOfStudy}`),
    profile.currentPosition || '',
    profile.desiredJobTitle || '',
  ]
    .join(' ')
    .toLowerCase();

  const missing: string[] = [];
  const mandatoryChecks: Array<{ pattern: RegExp; userPattern: RegExp; label: string }> = [
    { pattern: /\b(cpa|acca)\b/i, userPattern: /\b(cpa|acca|chartered accountant)\b/i, label: 'CPA / ACCA certification required' },
    { pattern: /\bmedical license\b|\bmd degree\b|\bregistered nurse\b|\bpracticing license\b/i, userPattern: /\b(md|medicine|nursing|nurse|medical|clinical|health|license)\b/i, label: 'Valid medical/practicing license required' },
    { pattern: /\bpmp certified\b|\bpmp certification\b/i, userPattern: /\bpmp\b/i, label: 'PMP certification required' },
    { pattern: /\bdriving license\b|\bdriver'?s license\b/i, userPattern: /\b(driving|driver)\b/i, label: 'Valid driving license required' },
  ];

  for (const check of mandatoryChecks) {
    if (check.pattern.test(req) && !check.userPattern.test(userText)) {
      missing.push(check.label);
    }
  }
  return missing;
}

export function hasSufficientProfileForRecommendations(profile: JobSeekerProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    (profile.currentPosition && profile.currentPosition.trim().length >= 2) ||
      (profile.desiredJobTitle && profile.desiredJobTitle.trim().length >= 2) ||
      (profile.skills && profile.skills.length > 0) ||
      (profile.areasOfExpertise && profile.areasOfExpertise.length > 0) ||
      (profile.education && profile.education.length > 0) ||
      (profile.experience && profile.experience.length > 0) ||
      (profile.yearsOfExperience && profile.yearsOfExperience.trim().length > 0) ||
      (profile.professionalInterests && profile.professionalInterests.length > 0) ||
      (profile.preferredSectors && profile.preferredSectors.length > 0) ||
      (profile.preferredIndustry && profile.preferredIndustry.trim().length >= 2)
  );
}

export function hasCompletedMandatoryPreferences(profile: JobSeekerProfile | null | undefined): boolean {
  if (!profile) return false;
  const hasExperience = Boolean(
    (profile.yearsOfExperience && profile.yearsOfExperience.trim().length > 0) ||
      (profile.experience && profile.experience.length > 0) ||
      (profile.previousPositions && profile.previousPositions.length > 0)
  );
  const hasSectorOrRole = Boolean(
    (profile.preferredSectors && profile.preferredSectors.length > 0) ||
      (profile.preferredIndustry && profile.preferredIndustry.trim().length >= 2) ||
      (profile.desiredJobTitle && profile.desiredJobTitle.trim().length >= 2) ||
      (profile.currentPosition && profile.currentPosition.trim().length >= 2) ||
      (profile.skills && profile.skills.length > 0)
  );
  return hasExperience && hasSectorOrRole;
}

export function isVerifiedActiveVacancy(v: Vacancy): boolean {
  if (!v || !v.id || !v.title) return false;
  if (v.status !== 'published') return false;
  if (v.isExpired) return false;
  if (isDeadlineExpired(v.applicationDeadline)) return false;
  // Never recommend clearly placeholder/fake jobs
  const lowerTitle = v.title.toLowerCase();
  if (/\b(scam|fake test|dummy)\b/.test(lowerTitle)) return false;
  return true;
}

export function computeStaffOpportunityRecommendations(
  profile: JobSeekerProfile,
  domesticVacancies: Vacancy[],
  internationalJobs: InternationalJob[] = [],
  scholarships: ExperienceScholarship[] = [],
  limit: number = 30
): RecommendedOpportunity[] {
  if (!hasSufficientProfileForRecommendations(profile)) {
    return [];
  }
  if (profile.accountStatus === 'suspended') {
    return [];
  }

  const results: RecommendedOpportunity[] = [];
  const userExpYears = getProfileExplicitExperienceYears(profile);
  const { rank: userEduRank, label: userEduLabel } = getProfileMaxEducationRank(profile);
  const tokens = tokenizeProfileKeywords(profile);
  const userLocation = `${profile.preferredWorkLocation || ''} ${profile.locationCity || ''} ${profile.locationRegion || ''}`.toLowerCase();

  // 1. Evaluate Verified Domestic Vacancies Across ALL Sectors
  for (const v of domesticVacancies || []) {
    if (!isVerifiedActiveVacancy(v)) continue;

    const combinedText = `${v.title} ${v.organization} ${v.category} ${v.requiredFieldOfStudy} ${v.educationQualification} ${(v.requiredSkills || []).join(' ')} ${v.description} ${(v.responsibilities || []).join(' ')} ${v.specialRequirements || ''}`.toLowerCase();
    const vacSectorTags = extractSectorTags(`${v.category} ${v.title} ${v.organization} ${v.description} ${v.isWashNgo ? 'wash' : ''}`);

    const missingMandatory: string[] = [];

    const reqYears = parseMinRequiredYears(v.experienceYears);
    if (reqYears !== null && reqYears > userExpYears) {
      missingMandatory.push(`Minimum ${reqYears} yrs experience required (profile has ${userExpYears} yrs)`);
    }

    const reqEduRank = detectEducationRank(v.educationQualification);
    if (reqEduRank > 0 && userEduRank < reqEduRank) {
      if (userEduRank > 0 || reqEduRank >= EDUCATION_RANK.master) {
        missingMandatory.push(`${RANK_LABELS[reqEduRank] || v.educationQualification} required`);
      }
    }

    const licenseGaps = detectMissingMandatoryLicenses(
      `${v.specialRequirements || ''} ${v.educationQualification || ''} ${v.title || ''}`,
      profile
    );
    missingMandatory.push(...licenseGaps);

    let score = 0;
    const reasons: string[] = [];

    // Role & Position Match
    const matchedTitleWords = tokens.titleTokens.filter((t) => combinedText.includes(t));
    if (matchedTitleWords.length > 0) {
      score += Math.min(35, matchedTitleWords.length * 14);
      reasons.push(`Role alignment: ${matchedTitleWords.slice(0, 3).join(', ')}`);
    }

    // Sector / Category Match (supports multi-sector & WASH/NGO/Banking/Embassies/Airlines/Other/etc.)
    const matchedSectorTag = tokens.preferredSectorTags.find((tag) => vacSectorTags.includes(tag));
    const wantsOtherOrAll = tokens.preferredSectorTags.includes('other') || tokens.preferredSectorsRaw.some((s) => /\b(other|all|any)\b/i.test(s));
    const directSectorMatch = tokens.preferredSectorsRaw.some((sec) =>
      sec.split(/[\s,/&]+/).some((w) => w.length > 2 && `${v.category} ${v.title}`.toLowerCase().includes(w))
    );
    if (matchedSectorTag || directSectorMatch || wantsOtherOrAll) {
      score += matchedSectorTag || directSectorMatch ? 24 : 22;
      reasons.push(
        v.isWashNgo
          ? 'Preferred Sector: WASH / Humanitarian NGO'
          : matchedSectorTag || directSectorMatch
          ? `Preferred Sector: ${v.category}`
          : `General / Other Sector Match: ${v.category}`
      );
    }

    // Skills & Areas of Expertise Match
    const matchedSkills = Array.from(
      new Set(
        [...tokens.skillTokens, ...tokens.expertiseTokens].filter(
          (s) => s.length >= 2 && combinedText.includes(s.toLowerCase())
        )
      )
    );
    if (matchedSkills.length > 0) {
      score += Math.min(30, matchedSkills.length * 10);
      reasons.push(`Matching skills: ${matchedSkills.slice(0, 3).join(', ')}`);
    }

    // Certifications Match
    const matchedCerts = (profile.certifications || [])
      .filter((c) => c.name && combinedText.includes(c.name.toLowerCase()))
      .map((c) => c.name);
    if (matchedCerts.length > 0) {
      score += 15;
      reasons.push(`Certification match: ${matchedCerts.slice(0, 2).join(', ')}`);
    }

    // Field of Study / Education Match
    const matchedStudy = tokens.studyTokens.filter((s) =>
      `${v.requiredFieldOfStudy} ${v.title} ${v.description}`.toLowerCase().includes(s)
    );
    if (matchedStudy.length > 0) {
      score += 15;
      reasons.push(`Field of study match: ${matchedStudy.slice(0, 2).join(', ')}`);
    } else if (reqEduRank > 0 && userEduRank >= reqEduRank && userEduLabel) {
      score += 10;
      reasons.push(`Education eligible (${userEduLabel})`);
    }

    // Professional Interests Match
    const matchedInterests = tokens.interestTokens.filter((i) => combinedText.includes(i));
    if (matchedInterests.length > 0) {
      score += 10;
      reasons.push(`Career interest: ${matchedInterests[0]}`);
    }

    // Experience Eligibility Confirmation
    if (reqYears !== null && userExpYears >= reqYears) {
      score += 10;
      if (reqYears > 0) reasons.push(`Meets ${reqYears}+ yrs experience requirement`);
    }

    // Location alignment
    const locCityLower = (profile.locationCity || '').toLowerCase().trim();
    const vLocLower = (v.location || '').toLowerCase();
    if (
      (locCityLower && vLocLower.includes(locCityLower)) ||
      (userLocation && vLocLower.split(/[\s,/]+/).some((w) => w.length > 3 && userLocation.includes(w))) ||
      vLocLower.includes('remote')
    ) {
      score += 8;
      reasons.push(`Preferred location: ${v.location}`);
    }

    // Require genuine match signal before recommending (never recommend unrelated jobs)
    const hasRelevantMatch =
      matchedTitleWords.length > 0 ||
      matchedSkills.length > 0 ||
      matchedStudy.length > 0 ||
      Boolean(matchedSectorTag || directSectorMatch || wantsOtherOrAll);

    if (!hasRelevantMatch || score < 22 || reasons.length === 0) continue;

    // Exclude severely under-qualified jobs (e.g. PhD/Master's when rank < Bachelor's, or >5yr gap)
    if (reqYears !== null && reqYears - userExpYears > 5) continue;
    if (reqEduRank >= EDUCATION_RANK.phd && userEduRank < EDUCATION_RANK.master) continue;

    const isFullyQualified = missingMandatory.length === 0;
    // Rank fully qualified higher than partially qualified
    const adjustedScore = isFullyQualified
      ? Math.min(99, score)
      : Math.max(30, Math.min(82, score - missingMandatory.length * 10));

    results.push({
      id: v.id,
      sourceType: 'domestic_job',
      title: v.title,
      organization: v.organization,
      location: v.location,
      category: v.category,
      salary: v.salary && v.salary !== 'Not specified' ? v.salary : undefined,
      deadline: v.applicationDeadline,
      matchScore: adjustedScore,
      eligibilityStatus: isFullyQualified ? 'Eligible' : 'Partially Qualified',
      isFullyQualified,
      matchReasons: reasons.slice(0, 5),
      missingMandatoryQualifications: missingMandatory,
      requiredExperienceText: v.experienceYears || 'Not specified',
      requiredEducationText: v.educationQualification || 'Not specified',
      applyUrl: v.applicationUrl,
      vacancy: v,
    });
  }

  // 2. Evaluate Verified Public International Jobs
  for (const ij of internationalJobs || []) {
    if (
      ij.verificationStatus !== 'VERIFIED' ||
      (ij.approvalStatus && ij.approvalStatus !== 'approved_public') ||
      ij.applicationStatus === 'closed' ||
      ij.applicationStatus === 'expired' ||
      ij.ethiopiansEligible === 'no' ||
      isDeadlineExpired(ij.applicationDeadline)
    ) {
      continue;
    }

    const missingMandatory: string[] = [];
    const reqYears = parseMinRequiredYears(ij.requiredExperience);
    if (reqYears !== null && reqYears > userExpYears) {
      missingMandatory.push(`Minimum ${reqYears} yrs experience required (profile has ${userExpYears} yrs)`);
    }

    const reqEduRank = detectEducationRank(ij.requiredEducation);
    if (reqEduRank > 0 && userEduRank < reqEduRank && (userEduRank > 0 || reqEduRank >= EDUCATION_RANK.master)) {
      missingMandatory.push(`${RANK_LABELS[reqEduRank] || ij.requiredEducation} required`);
    }

    const licenseGaps = detectMissingMandatoryLicenses(`${ij.jobTitle} ${ij.requiredEducation}`, profile);
    missingMandatory.push(...licenseGaps);

    const combinedText = `${ij.jobTitle} ${ij.category} ${ij.requiredEducation} ${ij.employerOrProgramme} ${ij.country} ${ij.languageRequirements}`.toLowerCase();

    let score = 0;
    const reasons: string[] = [];

    const matchedTitle = tokens.titleTokens.filter((t) => combinedText.includes(t));
    if (matchedTitle.length > 0) {
      score += Math.min(35, matchedTitle.length * 14);
      reasons.push(`International role fit (${matchedTitle.slice(0, 3).join(', ')})`);
    }
    const matchedSkills = Array.from(
      new Set([...tokens.skillTokens, ...tokens.expertiseTokens].filter((s) => combinedText.includes(s)))
    );
    if (matchedSkills.length > 0) {
      score += Math.min(25, matchedSkills.length * 10);
      reasons.push(`Skill/expertise alignment: ${matchedSkills.slice(0, 3).join(', ')}`);
    }
    const matchedInterests = tokens.interestTokens.filter((i) => combinedText.includes(i));
    if (matchedInterests.length > 0) {
      score += 12;
      reasons.push(`Career interest match: ${matchedInterests[0]}`);
    }
    if (ij.ethiopiansEligible === 'yes') {
      score += 8;
      reasons.push(`Open to Ethiopian applicants (${ij.country})`);
    }

    if (score >= 28 && reasons.length >= 1 && (matchedTitle.length > 0 || matchedSkills.length > 0)) {
      if (reqYears !== null && reqYears - userExpYears > 5) continue;
      const isFullyQualified = missingMandatory.length === 0;
      results.push({
        id: ij.id,
        sourceType: 'international_job',
        title: ij.jobTitle,
        organization: ij.employerOrProgramme,
        location: `${ij.location}, ${ij.country}`,
        category: ij.category || 'International Recruitment',
        salary: ij.salary && !/not stated/i.test(ij.salary) ? ij.salary : undefined,
        deadline: ij.applicationDeadline,
        matchScore: isFullyQualified ? Math.min(99, score) : Math.max(30, score - 12),
        eligibilityStatus: isFullyQualified ? 'Eligible' : 'Partially Qualified',
        isFullyQualified,
        matchReasons: reasons,
        missingMandatoryQualifications: missingMandatory,
        requiredExperienceText: ij.requiredExperience || 'Official requirements apply',
        requiredEducationText: ij.requiredEducation || 'Official requirements apply',
        applyUrl: ij.directApplicationUrl || ij.originalSourceUrl,
        internationalJob: ij,
      });
    }
  }

  // 3. Evaluate Verified Public Scholarships
  for (const sc of scholarships || []) {
    if (
      sc.verificationStatus !== 'VERIFIED' ||
      (sc.approvalStatus && sc.approvalStatus !== 'approved_public') ||
      sc.applicationStatus === 'closed' ||
      sc.applicationStatus === 'expired' ||
      sc.ethiopiansEligible === 'no' ||
      isDeadlineExpired(sc.applicationDeadline)
    ) {
      continue;
    }

    const missingMandatory: string[] = [];
    const reqYears = parseMinRequiredYears(sc.academicRequirements);
    if (reqYears !== null && reqYears > userExpYears) {
      missingMandatory.push(`Minimum ${reqYears} yrs experience required`);
    }
    if (sc.studyLevel === 'Postgraduate / Master' && userEduRank > 0 && userEduRank < EDUCATION_RANK.bachelor) {
      missingMandatory.push("Bachelor's Degree required");
    }
    if (sc.studyLevel === 'PhD / Research' && userEduRank < EDUCATION_RANK.master) {
      missingMandatory.push("Master's Degree required");
    }

    const combinedText = `${sc.scholarshipName} ${sc.studyProgramme} ${sc.academicRequirements} ${sc.universityOrInstitution} ${sc.country} ${sc.experienceCompensationNotes}`.toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    const matchedStudy = tokens.studyTokens.filter((s) => combinedText.includes(s));
    if (matchedStudy.length > 0) {
      score += Math.min(30, matchedStudy.length * 12);
      reasons.push(`Academic background fit (${matchedStudy.slice(0, 2).join(', ')})`);
    }
    const matchedDomain = [...tokens.titleTokens, ...tokens.expertiseTokens, ...tokens.interestTokens].filter((t) =>
      combinedText.includes(t)
    );
    if (matchedDomain.length > 0) {
      score += Math.min(30, matchedDomain.length * 10);
      reasons.push(`Programme match: ${matchedDomain.slice(0, 3).join(', ')}`);
    }
    if (sc.professionalExperienceCompensates === 'confirmed_yes' && userExpYears >= 2) {
      score += 15;
      reasons.push(`Values your ${userExpYears}+ yrs experience`);
    }

    if (score >= 28 && reasons.length >= 1) {
      const isFullyQualified = missingMandatory.length === 0;
      results.push({
        id: sc.id,
        sourceType: 'scholarship',
        title: sc.scholarshipName,
        organization: sc.universityOrInstitution,
        location: sc.country,
        category: `Scholarship (${sc.studyLevel})`,
        deadline: sc.applicationDeadline,
        matchScore: isFullyQualified ? Math.min(99, score) : Math.max(30, score - 12),
        eligibilityStatus: isFullyQualified ? 'Eligible' : 'Partially Qualified',
        isFullyQualified,
        matchReasons: reasons,
        missingMandatoryQualifications: missingMandatory,
        requiredExperienceText: sc.experienceCompensationNotes || 'Experience valued',
        requiredEducationText: sc.academicRequirements || sc.studyLevel,
        applyUrl: sc.officialApplicationUrl || sc.originalSourceUrl,
        scholarship: sc,
      });
    }
  }

  return results
    .sort((a, b) => {
      if (a.isFullyQualified !== b.isFullyQualified) return a.isFullyQualified ? -1 : 1;
      return b.matchScore - a.matchScore;
    })
    .slice(0, limit);
}
