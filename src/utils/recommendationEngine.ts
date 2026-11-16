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
  deadline: string;
  matchScore: number;
  eligibilityStatus: 'Eligible';
  matchReasons: string[];
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

function detectEducationRank(text?: string): number {
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

function getProfileMaxEducationRank(profile: JobSeekerProfile): { rank: number; label: string } {
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

function parseMinRequiredYears(text?: string): number | null {
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

function getProfileExplicitExperienceYears(profile: JobSeekerProfile): number {
  const fromField = parseMinRequiredYears(profile.yearsOfExperience);
  if (fromField !== null) return fromField;

  // Estimate conservatively ONLY from explicit startDate/endDate entries if user added roles
  let monthsTotal = 0;
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
      monthsTotal += Math.max(6, (endY - startY) * 12);
    }
  }
  return Math.floor(monthsTotal / 12);
}

function isDateExpired(deadline?: string): boolean {
  if (!deadline) return false;
  const trimmed = deadline.trim().toLowerCase();
  if (!trimmed || /rolling|ongoing|open|not stated|asap|until filled/i.test(trimmed)) return false;
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

function tokenizeProfileKeywords(profile: JobSeekerProfile): {
  titleTokens: string[];
  skillTokens: string[];
  expertiseTokens: string[];
  interestTokens: string[];
  certTokens: string[];
  studyTokens: string[];
} {
  const stopWords = new Set(['and', 'the', 'for', 'with', 'of', 'in', 'to', 'at', 'or', 'on', 'officer', 'staff']);
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
  };
}

function hasMandatoryLicenseMismatch(requiredText: string, profile: JobSeekerProfile): string | null {
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

  const mandatoryChecks: Array<{ pattern: RegExp; userPattern: RegExp; label: string }> = [
    { pattern: /\b(cpa|acca)\b/i, userPattern: /\b(cpa|acca|chartered accountant)\b/i, label: 'CPA / ACCA certification' },
    { pattern: /\bmedical license\b|\bmd degree\b|\bregistered nurse\b/i, userPattern: /\b(md|medicine|nursing|nurse|medical|clinical|health)\b/i, label: 'Medical / Nursing license' },
    { pattern: /\bpmp certified\b|\bpmp certification\b/i, userPattern: /\bpmp\b/i, label: 'PMP certification' },
  ];

  for (const check of mandatoryChecks) {
    if (check.pattern.test(req) && !check.userPattern.test(userText)) {
      return check.label;
    }
  }
  return null;
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
      (profile.professionalInterests && profile.professionalInterests.length > 0)
  );
}

export function computeStaffOpportunityRecommendations(
  profile: JobSeekerProfile,
  domesticVacancies: Vacancy[],
  internationalJobs: InternationalJob[],
  scholarships: ExperienceScholarship[],
  limit: number = 25
): RecommendedOpportunity[] {
  if (!hasSufficientProfileForRecommendations(profile)) {
    return [];
  }

  const results: RecommendedOpportunity[] = [];
  const userExpYears = getProfileExplicitExperienceYears(profile);
  const { rank: userEduRank, label: userEduLabel } = getProfileMaxEducationRank(profile);
  const tokens = tokenizeProfileKeywords(profile);
  const userPreferredIndustry = (profile.preferredIndustry || '').toLowerCase();
  const userLocation = `${profile.preferredWorkLocation || ''} ${profile.locationCity || ''}`.toLowerCase();

  // 1. Evaluate Domestic Vacancies
  for (const v of domesticVacancies || []) {
    if (v.status !== 'published' || v.isExpired || isDateExpired(v.applicationDeadline)) continue;

    const reqYears = parseMinRequiredYears(v.experienceYears);
    if (reqYears !== null && reqYears > userExpYears) {
      // Strictly exclude jobs requiring more years than documented on user's profile
      continue;
    }

    const reqEduRank = detectEducationRank(v.educationQualification);
    if (reqEduRank >= EDUCATION_RANK.bachelor && userEduRank > 0 && userEduRank < reqEduRank) {
      // User explicitly documented a lower education tier than required
      continue;
    }
    if (reqEduRank >= EDUCATION_RANK.master && userEduRank < EDUCATION_RANK.master) {
      // Do not recommend Master's/PhD-only roles unless user holds Master's/PhD
      continue;
    }

    const combinedText = `${v.title} ${v.category} ${v.requiredFieldOfStudy} ${v.educationQualification} ${(v.requiredSkills || []).join(' ')} ${v.description} ${(v.responsibilities || []).join(' ')}`.toLowerCase();
    const missingCert = hasMandatoryLicenseMismatch(`${v.specialRequirements || ''} ${v.educationQualification} ${v.title}`, profile);
    if (missingCert) continue;

    let score = 0;
    const reasons: string[] = [];

    // Role & Position Match
    const matchedTitleWords = tokens.titleTokens.filter((t) => combinedText.includes(t));
    if (matchedTitleWords.length > 0) {
      score += Math.min(35, matchedTitleWords.length * 14);
      reasons.push(`Role alignment (${matchedTitleWords.slice(0, 3).join(', ')})`);
    }

    // Industry / Category Match
    if (
      userPreferredIndustry &&
      userPreferredIndustry.split(/\s+/).some((w) => w.length > 3 && v.category.toLowerCase().includes(w))
    ) {
      score += 20;
      reasons.push(`Preferred sector: ${v.category}`);
    }

    // Skills & Areas of Expertise Match
    const matchedSkills = [...tokens.skillTokens, ...tokens.expertiseTokens].filter((s) =>
      combinedText.includes(s.toLowerCase())
    );
    if (matchedSkills.length > 0) {
      score += Math.min(30, matchedSkills.length * 10);
      reasons.push(`Verified skills/expertise: ${Array.from(new Set(matchedSkills)).slice(0, 3).join(', ')}`);
    }

    // Certifications Match
    const matchedCerts = (profile.certifications || [])
      .filter((c) => combinedText.includes(c.name.toLowerCase()))
      .map((c) => c.name);
    if (matchedCerts.length > 0) {
      score += 15;
      reasons.push(`Certification match: ${matchedCerts.slice(0, 2).join(', ')}`);
    }

    // Field of Study / Education Match
    const matchedStudy = tokens.studyTokens.filter((s) => `${v.requiredFieldOfStudy} ${v.title}`.toLowerCase().includes(s));
    if (matchedStudy.length > 0 || (reqEduRank > 0 && userEduRank >= reqEduRank && userEduLabel)) {
      score += 15;
      reasons.push(
        matchedStudy.length > 0
          ? `Field of study match (${matchedStudy.slice(0, 2).join(', ')})`
          : `Education eligible (${userEduLabel})`
      );
    }

    // Professional Interests Match
    const matchedInterests = tokens.interestTokens.filter((i) => combinedText.includes(i));
    if (matchedInterests.length > 0) {
      score += 10;
      reasons.push(`Matches career interest: ${matchedInterests[0]}`);
    }

    // Experience Eligibility Confirmation
    if (reqYears !== null && userExpYears >= reqYears) {
      score += 10;
      if (reqYears > 0) reasons.push(`Meets ${reqYears}+ yrs experience requirement`);
    }

    // Location bonus (only adds points, does not create a match on its own)
    if (userLocation && (v.location.toLowerCase().includes(profile.locationCity.toLowerCase()) || v.location.toLowerCase().includes('remote'))) {
      score += 5;
    }

    // Require genuine domain/skill/role match before recommending
    if (score >= 25 && reasons.length >= 1) {
      results.push({
        id: v.id,
        sourceType: 'domestic_job',
        title: v.title,
        organization: v.organization,
        location: v.location,
        category: v.category,
        deadline: v.applicationDeadline,
        matchScore: Math.min(99, score),
        eligibilityStatus: 'Eligible',
        matchReasons: reasons,
        requiredExperienceText: v.experienceYears || 'Not specified',
        requiredEducationText: v.educationQualification || 'Not specified',
        applyUrl: v.applicationUrl,
        vacancy: v,
      });
    }
  }

  // 2. Evaluate Verified Public International Jobs
  for (const ij of internationalJobs || []) {
    if (
      ij.verificationStatus !== 'VERIFIED' ||
      (ij.approvalStatus && ij.approvalStatus !== 'approved_public') ||
      ij.applicationStatus === 'closed' ||
      ij.applicationStatus === 'expired' ||
      ij.ethiopiansEligible === 'no' ||
      isDateExpired(ij.applicationDeadline)
    ) {
      continue;
    }

    const reqYears = parseMinRequiredYears(ij.requiredExperience);
    if (reqYears !== null && reqYears > userExpYears) continue;

    const reqEduRank = detectEducationRank(ij.requiredEducation);
    if (reqEduRank >= EDUCATION_RANK.master && userEduRank < EDUCATION_RANK.master) continue;
    if (reqEduRank >= EDUCATION_RANK.bachelor && userEduRank > 0 && userEduRank < reqEduRank) continue;

    const combinedText = `${ij.jobTitle} ${ij.category} ${ij.requiredEducation} ${ij.employerOrProgramme} ${ij.country} ${ij.languageRequirements}`.toLowerCase();
    const missingCert = hasMandatoryLicenseMismatch(`${ij.jobTitle} ${ij.requiredEducation}`, profile);
    if (missingCert) continue;

    let score = 0;
    const reasons: string[] = [];

    const matchedTitle = tokens.titleTokens.filter((t) => combinedText.includes(t));
    if (matchedTitle.length > 0) {
      score += Math.min(35, matchedTitle.length * 14);
      reasons.push(`International role fit (${matchedTitle.slice(0, 3).join(', ')})`);
    }
    const matchedSkills = [...tokens.skillTokens, ...tokens.expertiseTokens].filter((s) => combinedText.includes(s));
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

    if (score >= 28 && reasons.length >= 1) {
      results.push({
        id: ij.id,
        sourceType: 'international_job',
        title: ij.jobTitle,
        organization: ij.employerOrProgramme,
        location: `${ij.location}, ${ij.country}`,
        category: ij.category || 'International Recruitment',
        deadline: ij.applicationDeadline,
        matchScore: Math.min(99, score),
        eligibilityStatus: 'Eligible',
        matchReasons: reasons,
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
      isDateExpired(sc.applicationDeadline)
    ) {
      continue;
    }

    const reqYears = parseMinRequiredYears(sc.academicRequirements);
    if (reqYears !== null && reqYears > userExpYears) continue;

    // Master's scholarships typically require at least a Bachelor's degree; PhD requires Master's
    if (sc.studyLevel === 'Postgraduate / Master' && userEduRank > 0 && userEduRank < EDUCATION_RANK.bachelor) {
      continue;
    }
    if (sc.studyLevel === 'PhD / Research' && userEduRank < EDUCATION_RANK.master) {
      continue;
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
      reasons.push(`Programme interest/expertise match: ${matchedDomain.slice(0, 3).join(', ')}`);
    }
    if (sc.professionalExperienceCompensates === 'confirmed_yes' && userExpYears >= 2) {
      score += 15;
      reasons.push(`Values your ${userExpYears}+ yrs experience`);
    }

    if (score >= 28 && reasons.length >= 1) {
      results.push({
        id: sc.id,
        sourceType: 'scholarship',
        title: sc.scholarshipName,
        organization: sc.universityOrInstitution,
        location: sc.country,
        category: `Scholarship (${sc.studyLevel})`,
        deadline: sc.applicationDeadline,
        matchScore: Math.min(99, score),
        eligibilityStatus: 'Eligible',
        matchReasons: reasons,
        requiredExperienceText: sc.experienceCompensationNotes || 'Experience valued',
        requiredEducationText: sc.academicRequirements || sc.studyLevel,
        applyUrl: sc.officialApplicationUrl || sc.originalSourceUrl,
        scholarship: sc,
      });
    }
  }

  return results
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
