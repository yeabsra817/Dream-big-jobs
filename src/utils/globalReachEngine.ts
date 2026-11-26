import type {
  GlobalReachContact,
  GlobalReachContactCategory,
  GlobalReachGeneratedDraft,
  GlobalReachOrgSize,
  GlobalReachOutreachApproach,
  GlobalReachSponsorshipTier,
  GlobalReachUserProfile,
  GlobalReachVerificationStatus,
} from '../types/globalReach';

export const GLOBAL_REACH_CATEGORY_LABELS: Record<GlobalReachContactCategory, string> = {
  potential_employers: 'Potential Employers',
  banking_executives: 'Banking Executives',
  finance_professionals: 'Finance Professionals',
  business_owners: 'Business Owners',
  entrepreneurs: 'Entrepreneurs',
  investors: 'Investors',
  mentors: 'Mentors',
  philanthropists: 'Philanthropists',
  ngos_and_foundations: 'NGOs and Foundations',
  website_development_clients: 'Website Development Clients',
  international_recruitment_professionals: 'International Recruitment Professionals',
  other_professional_connections: 'Other Professional Connections',
};

export const GLOBAL_REACH_VERIFICATION_LABELS: Record<GlobalReachVerificationStatus, string> = {
  verified_organization: 'Verified organization',
  verified_public_professional_contact: 'Verified public professional contact',
  public_contact_unverified: 'Public contact not independently verified',
  unverified_contact: 'Unverified contact',
  invalid_or_outdated_contact: 'Invalid or outdated contact',
};

export const GLOBAL_REACH_SPONSORSHIP_LABELS: Record<GlobalReachSponsorshipTier, string> = {
  confirmed_sponsorship: 'Confirmed sponsorship opportunities',
  previous_sponsorship_evidence: 'Evidence of previous sponsorship',
  international_recruiter: 'Employers that recruit internationally',
  unknown_sponsorship: 'Employers with unknown sponsorship policies',
  mentorship_networking: 'Mentorship and networking contacts',
};

export const GLOBAL_REACH_APPROACH_LABELS: Record<GlobalReachOutreachApproach, string> = {
  employment_request: 'Employment Request',
  banking_finance_career: 'Banking & Finance Career Introduction',
  website_development: 'Website Development Services',
  business_partnership: 'Business Partnership',
  professional_mentorship: 'Professional Mentorship',
  employment_referral: 'Employment Referral',
  international_relocation_guidance: 'International Relocation Guidance',
  professional_networking: 'Professional Networking',
};

export const GLOBAL_REACH_ORG_SIZE_LABELS: Record<GlobalReachOrgSize, string> = {
  solo_founder: 'Individual / Founder',
  small_business: 'Small Business',
  medium_enterprise: 'Medium Company',
  large_international: 'Large International',
  plc_listed: 'PLC / Listed Company',
  ngo_foundation: 'NGO / Foundation',
  unknown: 'Organization',
};

export const GLOBAL_REACH_ALL_CATEGORIES = Object.keys(
  GLOBAL_REACH_CATEGORY_LABELS
) as GlobalReachContactCategory[];

export const GLOBAL_REACH_ALL_APPROACHES = Object.keys(
  GLOBAL_REACH_APPROACH_LABELS
) as GlobalReachOutreachApproach[];

export function sanitizeExternalHttpUrl(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractDomainFromUrl(raw?: string | null): string {
  const safe = sanitizeExternalHttpUrl(raw);
  if (!safe) return '';
  try {
    return new URL(safe).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function extractDomainFromEmail(email?: string | null): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return '';
  return trimmed.slice(at + 1);
}

export function isValidPublicEmailSyntax(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return /^[a-z0-9._%+-]{1,64}@[a-z0-9.-]{2,253}\.[a-z]{2,24}$/.test(trimmed);
}

/**
 * Normalizes an ALREADY PUBLISHED international WhatsApp Business phone number
 * or official wa.me link. NEVER fabricates or guesses numbers from name/country.
 */
export function normalizePublishedWhatsAppDigits(rawPhoneOrUrl?: string | null): string | null {
  if (!rawPhoneOrUrl || typeof rawPhoneOrUrl !== 'string') return null;
  const trimmed = rawPhoneOrUrl.trim();
  if (!trimmed) return null;

  const waMatch = trimmed.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d[\d\s\-()]{6,19})/i);
  const candidate = waMatch ? waMatch[1] : trimmed;

  // Must explicitly include international prefix (+) or come from a wa.me URL
  if (!waMatch && !candidate.startsWith('+') && !candidate.startsWith('00')) {
    return null;
  }

  let digits = candidate.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length < 8 || digits.length > 15) return null;
  if (/^0+$/.test(digits)) return null;
  return digits;
}

export function buildWhatsAppChatUrl(
  publishedWhatsAppNumberOrUrl?: string | null,
  prefilledMessage?: string
): string | null {
  const digits = normalizePublishedWhatsAppDigits(publishedWhatsAppNumberOrUrl);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  const msg = (prefilledMessage || '').trim();
  if (!msg) return base;
  return `${base}?text=${encodeURIComponent(msg.slice(0, 1400))}`;
}

export function buildSingleGmailComposeUrl(params: {
  to: string;
  subject: string;
  body: string;
}): string | null {
  const to = (params.to || '').trim();
  if (!isValidPublicEmailSyntax(to)) return null;
  const qs = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to,
    su: (params.subject || '').slice(0, 220),
    body: (params.body || '').slice(0, 4500),
  });
  return `https://mail.google.com/mail/?${qs.toString()}`;
}

export interface GlobalReachBulkBccBatch {
  batchIndex: number;
  totalBatches: number;
  recipients: string[];
  gmailComposeUrl: string;
}

/**
 * Builds bulk Gmail compose links using BCC ONLY so recipients NEVER see each other's emails.
 */
export function buildBulkBccGmailBatches(params: {
  recipients: string[];
  subject: string;
  body: string;
  maxPerBatch?: number;
}): GlobalReachBulkBccBatch[] {
  const limit = Math.max(1, Math.min(40, params.maxPerBatch || 25));
  const uniqueValid = Array.from(
    new Set(
      (params.recipients || [])
        .map((e) => (e || '').trim().toLowerCase())
        .filter((e) => isValidPublicEmailSyntax(e))
    )
  );
  if (uniqueValid.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueValid.length; i += limit) {
    chunks.push(uniqueValid.slice(i, i + limit));
  }

  return chunks.map((chunk, idx) => {
    const qs = new URLSearchParams({
      view: 'cm',
      fs: '1',
      bcc: chunk.join(','),
      su: (params.subject || '').slice(0, 220),
      body: (params.body || '').slice(0, 4500),
    });
    return {
      batchIndex: idx + 1,
      totalBatches: chunks.length,
      recipients: chunk,
      gmailComposeUrl: `https://mail.google.com/mail/?${qs.toString()}`,
    };
  });
}

export function inspectLinkedInUrl(raw?: string | null): {
  validUrl: string | null;
  profileType: 'person' | 'company' | 'unknown';
  messagingNote: string;
} {
  const safe = sanitizeExternalHttpUrl(raw);
  if (!safe) {
    return {
      validUrl: null,
      profileType: 'unknown',
      messagingNote: 'No public LinkedIn profile URL available.',
    };
  }
  try {
    const parsed = new URL(safe);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('linkedin.com')) {
      return {
        validUrl: null,
        profileType: 'unknown',
        messagingNote: 'Link is not an official linkedin.com URL.',
      };
    }
    const p = parsed.pathname.toLowerCase();
    if (p.startsWith('/in/')) {
      return {
        validUrl: safe,
        profileType: 'person',
        messagingNote:
          'Direct LinkedIn messaging may require a connection request or InMail depending on their LinkedIn privacy settings.',
      };
    }
    if (p.startsWith('/company/') || p.startsWith('/school/')) {
      return {
        validUrl: safe,
        profileType: 'company',
        messagingNote:
          'Official LinkedIn organization page. Follow or review Jobs/People tabs; direct page messaging depends on page settings.',
      };
    }
    return {
      validUrl: safe,
      profileType: 'unknown',
      messagingNote: 'Official LinkedIn link. Direct messaging depends on LinkedIn connection/InMail rules.',
    };
  } catch {
    return {
      validUrl: null,
      profileType: 'unknown',
      messagingNote: 'Invalid LinkedIn URL.',
    };
  }
}

export function inspectInstagramUrl(raw?: string | null): {
  validUrl: string | null;
  messagingNote: string;
} {
  const safe = sanitizeExternalHttpUrl(raw);
  if (!safe) {
    return { validUrl: null, messagingNote: 'No public Instagram profile URL available.' };
  }
  try {
    const parsed = new URL(safe);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('instagram.com')) {
      return { validUrl: null, messagingNote: 'Link is not an official instagram.com URL.' };
    }
    return {
      validUrl: safe,
      messagingNote:
        'Public Instagram professional profile. Message delivery is governed by Instagram message-request settings.',
    };
  } catch {
    return { validUrl: null, messagingNote: 'Invalid Instagram URL.' };
  }
}

export function buildPublicTelUrl(rawPhone?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const cleaned = rawPhone.trim().replace(/[^\d+]/g, '');
  if (cleaned.length < 7 || cleaned.length > 18) return null;
  return `tel:${cleaned}`;
}

export function formatEatTimestamp(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d) + ' EAT'
    );
  } catch {
    return null;
  }
}

/**
 * Explainable 0-100 relevance scoring engine matching a discovered contact
 * against the active user's professional profile and objectives.
 */
export function scoreGlobalReachContact(
  contact: Partial<GlobalReachContact>,
  profile: GlobalReachUserProfile
): { score: number; reasons: string[] } {
  let score = 20;
  const reasons: string[] = [];

  const haystack = [
    contact.fullName,
    contact.companyName,
    contact.positionOrRole,
    contact.industry,
    contact.sponsorshipEvidenceNote,
    contact.verificationNotes,
    ...(contact.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const profileKeywords = [
    ...profile.coreExperienceAreas,
    ...profile.additionalCapabilities,
    ...profile.targetIndustries,
    profile.currentOrRecentRole,
    profile.educationDegree,
  ]
    .join(' ')
    .toLowerCase();

  // 1. Banking / finance / accounting alignment
  const bankingSignals = ['bank', 'finance', 'financial', 'microfinance', 'fintech', 'credit', 'accounting', 'treasury', 'audit', 'wealth', 'capital', 'investment'];
  const userHasFinance = bankingSignals.some((k) => profileKeywords.includes(k));
  const contactHasFinance = bankingSignals.some((k) => haystack.includes(k));
  if (userHasFinance && contactHasFinance) {
    score += 22;
    reasons.push(
      `Direct alignment with ${profile.totalExperienceYears > 0 ? `${profile.totalExperienceYears}-year ` : ''}banking, finance, and accounting background`
    );
  }

  // 2. Website development / digital business alignment
  const webSignals = ['web', 'software', 'digital', 'agency', 'startup', 'technology', 'ecommerce', 'saas', 'it ', 'consulting', 'small business'];
  const userHasWeb = webSignals.some((k) => profileKeywords.includes(k)) || profileKeywords.includes('website');
  if (userHasWeb && (contact.websiteDevProspect || webSignals.some((k) => haystack.includes(k)))) {
    score += 12;
    reasons.push('Potential fit for website development, digital projects, or business collaboration');
  }

  // 3. Sponsorship & international recruitment evidence
  if (contact.sponsorshipTier === 'confirmed_sponsorship') {
    score += 22;
    reasons.push('Confirmed international visa/work-permit sponsorship evidence on official source');
  } else if (contact.sponsorshipTier === 'previous_sponsorship_evidence') {
    score += 17;
    reasons.push('Evidence of prior international hiring or sponsorship history');
  } else if (contact.sponsorshipTier === 'international_recruiter' || contact.internationalRecruiterSignal) {
    score += 13;
    reasons.push('Organization recruits internationally or operates cross-border teams');
  }

  // 4. Mentorship / NGO / Foundation / Executive guidance value
  if (contact.mentorshipAvailable || contact.category === 'mentors') {
    score += 12;
    reasons.push('Publicly connected to mentorship, leadership guidance, or career support');
  }
  if (contact.category === 'ngos_and_foundations' || haystack.includes('ngo') || haystack.includes('foundation') || haystack.includes('humanitarian')) {
    score += 10;
    reasons.push('International NGO or foundation active in cross-border finance, operations, or development');
  }
  if (
    contact.entityType === 'individual' &&
    /(founder|ceo|director|manager|head of|vp|executive|partner|owner|hr|talent|recruit)/i.test(
      contact.positionOrRole || ''
    )
  ) {
    score += 10;
    reasons.push(`Decision-maker or senior leader (${contact.positionOrRole})`);
  }

  // 5. Direct verified communication channels & trust
  if (contact.verificationStatus === 'verified_public_professional_contact') {
    score += 12;
    reasons.push('Verified public professional contact matching official domain');
  } else if (contact.verificationStatus === 'verified_organization') {
    score += 9;
    reasons.push('Verified live official organization website');
  } else if (contact.verificationStatus === 'invalid_or_outdated_contact') {
    score -= 25;
    reasons.push('Contact link or domain failed live verification');
  }

  const channels: string[] = [];
  if (contact.publicEmail) channels.push('public email');
  if (contact.whatsAppBusinessUrl || contact.whatsAppBusinessNumber) channels.push('WhatsApp Business');
  if (contact.linkedInUrl) channels.push('LinkedIn');
  if (contact.instagramUrl) channels.push('Instagram');
  if (contact.contactPageUrl) channels.push('official contact page');

  if (channels.length >= 2) {
    score += 7;
    reasons.push(`Multiple public channels available (${channels.join(', ')})`);
  } else if (channels.length === 1) {
    score += 3;
    reasons.push(`Public channel available (${channels[0]})`);
  }

  // 6. Global region preference
  if (
    contact.region &&
    Array.isArray(profile.targetRegions) &&
    profile.targetRegions.includes(contact.region)
  ) {
    score += 5;
    reasons.push(`Located in target region (${contact.country || contact.region})`);
  }

  if (reasons.length === 0) {
    reasons.push('Relevant international professional contact for networking and career exploration');
  }

  return {
    score: Math.max(5, Math.min(99, Math.round(score))),
    reasons: reasons.slice(0, 5),
  };
}

/**
 * Editable, respectful, natural manual outreach starter template.
 * Clearly distinct from Gemini AI generation (never labeled as AI).
 */
export function buildEditableOutreachTemplate(
  contact: GlobalReachContact,
  profile: GlobalReachUserProfile,
  approach: GlobalReachOutreachApproach
): GlobalReachGeneratedDraft {
  const recipientSalutation =
    contact.entityType === 'individual' && contact.fullName
      ? `Dear ${contact.fullName},`
      : `Dear ${contact.companyName || contact.fullName} Team,`;

  const senderName = profile.fullName || 'Professional Applicant';
  const experienceLine =
    profile.totalExperienceYears > 0
      ? `${profile.totalExperienceYears} years of experience${
          profile.managementExperienceYears > 0
            ? `, including ${profile.managementExperienceYears} years in ${profile.currentOrRecentRole || 'management'}`
            : ''
        }`
      : profile.currentOrRecentRole || 'professional experience';

  const educationLine =
    profile.educationDegree && profile.educationInstitution
      ? `I hold a ${profile.educationDegree} from ${profile.educationInstitution}${
          profile.graduationYear ? ` (${profile.graduationYear})` : ''
        }.`
      : '';

  const locationContext = [contact.city, contact.country].filter(Boolean).join(', ') || contact.region;
  const orgLabel = contact.companyName || contact.fullName;

  const approachBodies: Record<GlobalReachOutreachApproach, { subject: string; body: string; wa: string; li: string }> = {
    employment_request: {
      subject: `International Employment Inquiry — ${senderName} (${profile.currentOrRecentRole || 'Banking & Finance'})`,
      body: `${recipientSalutation}\n\nI came across ${orgLabel}${locationContext ? ` in ${locationContext}` : ''} while researching respected organizations in ${contact.industry || 'international business'}. I am ${senderName}, a ${profile.nationality || 'global'} professional currently based in ${profile.currentCountry || 'my home country'} with ${experienceLine}. ${educationLine}\n\nMy background covers ${profile.coreExperienceAreas.slice(0, 5).join(', ')}. I am actively seeking a legitimate international employment opportunity where I can contribute measurable operational and financial discipline while building a stable future for my family.\n\nIf ${orgLabel} considers international candidates or has upcoming openings that fit my background, I would be grateful to share my CV or follow your official application process.\n\nThank you very much for your time and consideration.\n\nWarm regards,\n${senderName}\n${profile.email}`,
      wa: `Hello${contact.entityType === 'individual' ? ` ${contact.fullName}` : ''}, I am ${senderName} from ${profile.currentCountry}. I have ${experienceLine} and admired ${orgLabel}'s work in ${contact.industry}. Would you be open to letting me know if your team accepts international applications? Thank you.`,
      li: `Hello ${contact.entityType === 'individual' ? contact.fullName : `${orgLabel} team`}, I'm ${senderName} (${experienceLine}). I'm exploring international opportunities in ${contact.industry} and would value connecting with you.`,
    },
    banking_finance_career: {
      subject: `Banking & Finance Professional Introduction — ${senderName}`,
      body: `${recipientSalutation}\n\nI am writing to introduce myself as a banking and finance professional interested in ${orgLabel}'s work in ${contact.industry || 'financial services'}. I bring ${experienceLine}, specializing in ${profile.coreExperienceAreas.slice(0, 6).join(', ')}. ${educationLine}\n\nI am working toward continuing my banking and finance career internationally so I can contribute strong branch operations, customer growth, and risk-conscious administration to an international institution while supporting my family's future.\n\nI would greatly appreciate any advice on how international banking professionals can best qualify for roles within ${orgLabel} or your wider network.\n\nRespectfully,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName}, a banking professional from ${profile.currentCountry} with ${experienceLine}. I admire ${orgLabel}'s work and would appreciate knowing if you consider international banking/finance applicants.`,
      li: `Hello ${contact.entityType === 'individual' ? contact.fullName : ''}, I bring ${experienceLine} in banking operations and branch leadership. I'd be honored to connect and learn about finance opportunities in ${contact.country}.`,
    },
    website_development: {
      subject: `Website & Digital Project Collaboration Inquiry — ${senderName}`,
      body: `${recipientSalutation}\n\nI hope this message finds you well. Alongside my background in banking and financial operations (${experienceLine}), I work independently in ${profile.additionalCapabilities.slice(0, 4).join(', ')}.\n\nAfter reviewing ${orgLabel}'s online presence, I wanted to respectfully introduce myself in case you ever need dependable remote support with website updates, modern web applications, or digital project coordination. I focus on clear communication, practical business results, and reliable delivery.\n\nIf a short introduction or portfolio overview would be helpful now or in the future, I would be glad to send it over.\n\nBest regards,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName}. Alongside my finance background, I build modern business websites and digital tools remotely. If ${orgLabel} ever needs dependable website support, I'd be happy to share my work.`,
      li: `Hello, I'm ${senderName}. In addition to my finance background, I develop business websites and manage web projects remotely. Happy to connect if ${orgLabel} ever needs web support.`,
    },
    business_partnership: {
      subject: `Cross-Border Business & Digital Collaboration — ${senderName}`,
      body: `${recipientSalutation}\n\nI came across ${orgLabel} and was impressed by your work in ${contact.industry || 'business'} (${locationContext}). I am ${senderName}, combining ${experienceLine} in commercial banking and branch management with hands-on website and digital business development.\n\nI am building long-term, ethical international business relationships and exploring partnerships where financial operations discipline and digital execution can add real value across markets.\n\nIf you are open to a brief introductory exchange, I would appreciate the opportunity to learn about your priorities and see if there are constructive ways to collaborate.\n\nKind regards,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName} from ${profile.currentCountry}, combining ${experienceLine} in banking with digital business development. I'd value exploring constructive collaboration with ${orgLabel}.`,
      li: `Hello, I'm ${senderName} — banking operations leader & web developer. I'd appreciate connecting regarding potential cross-border collaboration with ${orgLabel}.`,
    },
    professional_mentorship: {
      subject: `Brief Professional Mentorship Inquiry — ${senderName}`,
      body: `${recipientSalutation}\n\nI respect the work you and ${orgLabel} have built in ${contact.industry || 'your field'}. I am ${senderName}, a ${profile.nationality || ''} professional based in ${profile.currentCountry || ''} with ${experienceLine}. ${educationLine}\n\nI am committed to growing professionally and pursuing a legitimate international career path to build a stronger future for my family. I am not asking for favors or shortcuts—only hoping to learn from experienced leaders about the certifications, positioning, or steps that truly matter when transitioning into international roles.\n\nIf you ever have ten minutes to share brief guidance or point me to a useful resource, I would be deeply appreciative.\n\nSincerely,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName}, a banking professional from ${profile.currentCountry} with ${experienceLine}. I deeply respect your work at ${orgLabel} and would be grateful for any brief career advice on transitioning internationally.`,
      li: `Hello ${contact.entityType === 'individual' ? contact.fullName : ''}, I'm ${senderName} (${experienceLine} in banking). I admire your career at ${orgLabel} and would value connecting to learn from your experience.`,
    },
    employment_referral: {
      subject: `Seeking Career Guidance & Potential Referral — ${senderName}`,
      body: `${recipientSalutation}\n\nI hope you are doing well. I am ${senderName}, currently based in ${profile.currentCountry} with ${experienceLine} in ${profile.coreExperienceAreas.slice(0, 4).join(', ')}. ${educationLine}\n\nI am actively applying for international banking, finance, and operations positions where my leadership and customer-growth track record can deliver value. If you happen to know hiring teams or recruiters in ${locationContext || 'your network'} who welcome qualified international candidates, I would be sincerely grateful for a referral or recommendation on where to apply.\n\nI am happy to send my concise CV at your convenience.\n\nThank you for your time,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName} (${experienceLine} in banking & finance). I'm seeking legitimate international roles and would appreciate any pointer to hiring teams in ${contact.country} who welcome international applicants.`,
      li: `Hello, I'm ${senderName} with ${experienceLine} in banking & finance. If you know teams in ${contact.country} open to international professionals, I'd be grateful to connect.`,
    },
    international_relocation_guidance: {
      subject: `Guidance on Legal International Career Pathways — ${senderName}`,
      body: `${recipientSalutation}\n\nI discovered ${orgLabel} while researching respected organizations and professionals in ${locationContext || 'international markets'}. I am ${senderName}, an ${profile.nationality} professional with ${experienceLine} in banking and branch leadership, alongside independent website development skills. ${educationLine}\n\nMy goal is to pursue a legal, employer-sponsored or skilled international career pathway so I can contribute professionally abroad and support my family's future. Because navigating international hiring norms from abroad can be challenging, I would deeply value any practical guidance you might share regarding realistic entry paths in ${contact.country || 'your region'}.\n\nThank you kindly for reading my note.\n\nWarm regards,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName} from ${profile.currentCountry} (${experienceLine} in banking + web dev). I'm researching legal international career pathways in ${contact.country} and would appreciate any brief guidance.`,
      li: `Hello, I'm ${senderName} (${experienceLine} in banking + web development). I'm researching legal skilled-migration and hiring pathways in ${contact.country} and would love to connect.`,
    },
    professional_networking: {
      subject: `Professional Connection from ${profile.currentCountry || 'Ethiopia'} — ${senderName}`,
      body: `${recipientSalutation}\n\nI came across ${orgLabel}'s work in ${contact.industry || 'your industry'} and wanted to reach out respectfully to introduce myself. I am ${senderName}, with ${experienceLine} in ${profile.coreExperienceAreas.slice(0, 4).join(', ')} as well as independent website development.\n\nI enjoy connecting with thoughtful international founders, finance leaders, and organizations to exchange ideas and stay informed about cross-border opportunities.\n\nWishing you and your team continued success in ${locationContext || 'your work'}.\n\nBest regards,\n${senderName}\n${profile.email}`,
      wa: `Hello, I'm ${senderName} from ${profile.currentCountry} (${experienceLine} in banking & web development). I came across ${orgLabel}'s work and wanted to introduce myself professionally.`,
      li: `Hello, I'm ${senderName} — banking branch leader & independent web developer in ${profile.currentCountry}. Impressed by ${orgLabel}'s work and would love to connect.`,
    },
  };

  const chosen = approachBodies[approach];

  return {
    contactId: contact.id,
    contactName: contact.fullName,
    companyName: contact.companyName,
    approach,
    subject: chosen.subject,
    message: chosen.body,
    whatsappShortMessage: chosen.wa,
    linkedInNote: chosen.li.slice(0, 290),
    followUpMessage: `${recipientSalutation}\n\nI hope your week is going well. I am following up respectfully on my earlier note regarding ${GLOBAL_REACH_APPROACH_LABELS[approach].toLowerCase()}. I completely understand how busy schedules get—if now is not a convenient time, please feel free to ignore this note or let me know if you prefer not to be contacted again.\n\nWarm regards,\n${senderName}`,
    generatedBy: 'manual_template',
    generatedAt: new Date().toISOString(),
  };
}
