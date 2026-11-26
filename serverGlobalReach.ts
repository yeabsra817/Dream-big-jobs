import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import type { GoogleGenAI } from '@google/genai';
import { validatePublicCrawlUrl } from './serverAutonomousWebCrawler';
import type {
  GlobalReachContact,
  GlobalReachContactCategory,
  GlobalReachCycleLog,
  GlobalReachDashboardResponse,
  GlobalReachDatabaseStats,
  GlobalReachEntityType,
  GlobalReachGeneratedDraft,
  GlobalReachNotification,
  GlobalReachOrgSize,
  GlobalReachOutreachApproach,
  GlobalReachOutreachLog,
  GlobalReachRegion,
  GlobalReachSchedulerState,
  GlobalReachSourceStatus,
  GlobalReachSponsorshipTier,
  GlobalReachSuppressionEntry,
  GlobalReachUserProfile,
  GlobalReachVerificationStatus,
} from './src/types/globalReach';
import {
  GLOBAL_REACH_APPROACH_LABELS,
  buildEditableOutreachTemplate,
  buildWhatsAppChatUrl,
  extractDomainFromEmail,
  extractDomainFromUrl,
  formatEatTimestamp,
  inspectInstagramUrl,
  inspectLinkedInUrl,
  isValidPublicEmailSyntax,
  normalizePublishedWhatsAppDigits,
  sanitizeExternalHttpUrl,
  scoreGlobalReachContact,
} from './src/utils/globalReachEngine';

export interface RegisterGlobalReachDeps {
  app: Express;
  runtimeBaseDir: string;
  isVercel: boolean;
  ensureRuntimeDataDir: () => void;
  loadJsonFileSafe: <T>(filePath: string, fallback: T) => T;
  writeJsonFileAtomic: (filePath: string, data: unknown) => void;
  isPersistentOwnerRequest: (req: Request) => boolean;
  getRequesterUid: (req: Request) => string;
  getRequesterEmail: (req: Request) => string;
  appendAuditLog: (entry: {
    action: string;
    actorEmail?: string;
    actorUid?: string;
    targetType: string;
    targetId?: string;
    summary: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => unknown;
  pushAdminNotification?: (notif: {
    type: string;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
  }) => unknown;
  getAiClient: () => Promise<GoogleGenAI | null> | GoogleGenAI | null;
}

export interface GlobalReachWorkspace {
  workspaceId: string;
  isOwnerWorkspace: boolean;
  profile: GlobalReachUserProfile;
  contacts: GlobalReachContact[];
  notifications: GlobalReachNotification[];
  suppressionList: GlobalReachSuppressionEntry[];
  recentCycles: GlobalReachCycleLog[];
  scheduler: GlobalReachSchedulerState;
  sources: GlobalReachSourceStatus[];
  apiErrorCount: number;
}

export interface GlobalReachDatabase {
  version: number;
  updatedAt: string;
  workspaces: Record<string, GlobalReachWorkspace>;
}

export const OWNER_WORKSPACE_ID = 'owner_yeabsra';
const HOURLY_INTERVAL_MS = 60 * 60 * 1000;
const STALE_LOCK_MS = 15 * 60 * 1000;
const MAX_CONTACTS_PER_WORKSPACE = 1200;
const MAX_CYCLES_HISTORY = 120;
const MAX_NOTIFICATIONS = 150;
const FETCH_TIMEOUT_MS = 7500;
const MAX_HTML_BYTES = 550_000;
const USER_AGENT =
  'HopelandGlobalReach/1.0 (+https://www.hopelandjobs.tech; respectful public contact discovery)';

const DISPOSABLE_OR_SUSPICIOUS_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'localhost',
  'sentry.io',
  'wixpress.com',
  'cloudflare.com',
  'w3.org',
  'schema.org',
  'googleusercontent.com',
]);

const IGNORED_EMAIL_PREFIXES = [
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'abuse',
  'webmaster',
  'privacy',
  'gdpr',
  'dpo',
  'security',
  'dmca',
  'copyright',
  'unsubscribe',
  'bounce',
];

export function createYeabsraOwnerProfile(): GlobalReachUserProfile {
  return {
    userId: OWNER_WORKSPACE_ID,
    isOwnerProfile: true,
    fullName: 'Yeabsra Tefera',
    nationality: 'Ethiopian',
    currentCountry: 'Ethiopia',
    email: 'yeabsra45@gmail.com',
    educationDegree: 'BA in Accounting and Finance',
    educationInstitution: 'Mekelle University',
    graduationYear: '2016',
    totalExperienceYears: 9,
    managementExperienceYears: 3,
    currentOrRecentRole: 'Bank Branch Manager',
    coreExperienceAreas: [
      'Banking operations',
      'Branch management',
      'Financial management',
      'Customer service',
      'Deposit mobilization',
      'Business development',
      'Staff supervision',
      'Financial services',
      'Banking administration',
    ],
    additionalCapabilities: [
      'Independent website development',
      'Digital business development',
      'Website project management',
      'Technology and online business projects',
    ],
    primaryObjectives: [
      'International banking employment',
      'Finance and accounting employment',
      'NGO and international organization employment',
      'Employer-sponsored international employment',
      'Legal work visa and relocation opportunities',
      'Website development contracts',
      'Business partnerships',
      'Professional mentorship',
      'Referrals and professional introductions',
      'Genuine individuals or organizations willing to guide toward international opportunities',
    ],
    personalStorySummary:
      'Ethiopian banking professional with 9 years in banking (including 3 years as Branch Manager) and independent website development capabilities, seeking genuine international opportunities to contribute skills and improve the future of my mother, wife, and children.',
    targetRegions: [
      'Europe',
      'North America',
      'Middle East',
      'Asia',
      'Africa',
      'Australia & Oceania',
      'South America',
    ],
    targetIndustries: [
      'Banking & Financial Services',
      'Accounting & Finance',
      'Fintech & Microfinance',
      'International NGOs & Foundations',
      'Small & Medium Businesses',
      'Technology & Web Development',
      'International Recruitment',
    ],
    updatedAt: new Date().toISOString(),
  };
}

export function createDefaultRegisteredUserProfile(
  userId: string,
  email: string
): GlobalReachUserProfile {
  return {
    userId,
    isOwnerProfile: false,
    fullName: '',
    nationality: '',
    currentCountry: '',
    email: email || '',
    educationDegree: '',
    educationInstitution: '',
    graduationYear: '',
    totalExperienceYears: 0,
    managementExperienceYears: 0,
    currentOrRecentRole: '',
    coreExperienceAreas: [],
    additionalCapabilities: [],
    primaryObjectives: [
      'International employment opportunities',
      'Professional mentorship',
      'Business partnerships',
      'Professional networking',
    ],
    personalStorySummary: '',
    targetRegions: [
      'Europe',
      'North America',
      'Middle East',
      'Asia',
      'Africa',
      'Australia & Oceania',
      'South America',
    ],
    targetIndustries: [],
    updatedAt: new Date().toISOString(),
  };
}

function createInitialSources(): GlobalReachSourceStatus[] {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasTavily = Boolean(process.env.TAVILY_API_KEY?.trim());
  const hasBrave = Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());

  return [
    {
      id: 'official_org_websites',
      name: 'Official Organization, Chamber, Bank & Foundation Websites',
      category: 'official_web',
      status: 'operational',
      description:
        'SSRF-guarded live discovery & verification across real global public websites (banks, fintechs, chambers of commerce, international NGOs, foundations, small businesses, and mentorship networks).',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'reliefweb_public_api',
      name: 'ReliefWeb Official Public API (Global NGOs, UN & Foundations)',
      category: 'public_api',
      status: 'operational',
      description:
        'Public humanitarian, development, finance, and international organization directory API with verified organization homepages and country metadata.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'gleif_lei_registry',
      name: 'GLEIF Official Global LEI Registry (Banks, PLCs & Enterprises)',
      category: 'public_api',
      status: 'operational',
      description:
        'Global Legal Entity Identifier public registry covering verified banks, financial institutions, PLCs, and enterprises worldwide.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'github_public_founders',
      name: 'GitHub Public Profiles & Tech Organizations API',
      category: 'public_api',
      status: 'operational',
      description:
        'Publicly listed founders, CTOs, small web/software businesses, and fintech teams that voluntarily publish business emails, websites, and social links.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'gemini_search_grounding',
      name: 'Gemini AI Outreach & Optional Search Enrichment',
      category: 'optional_api',
      status: hasGemini ? 'operational' : 'requires_api_key',
      envVarName: 'GEMINI_API_KEY',
      description: hasGemini
        ? 'Configured on server for personalized AI introduction drafting across all 8 outreach approaches.'
        : 'Set GEMINI_API_KEY on the server to enable AI-personalized message drafting.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'tavily_search_api',
      name: 'Tavily Web Search API (Optional Expansion)',
      category: 'optional_api',
      status: hasTavily ? 'operational' : 'requires_api_key',
      envVarName: 'TAVILY_API_KEY',
      description: hasTavily
        ? 'Configured on server for additional web search expansion.'
        : 'Optional — requires TAVILY_API_KEY on server for broader search engine queries.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'brave_search_api',
      name: 'Brave Search API (Optional Expansion)',
      category: 'optional_api',
      status: hasBrave ? 'operational' : 'requires_api_key',
      envVarName: 'BRAVE_SEARCH_API_KEY',
      description: hasBrave
        ? 'Configured on server for additional web search expansion.'
        : 'Optional — requires BRAVE_SEARCH_API_KEY on server for broader search engine queries.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'linkedin_official_api',
      name: 'LinkedIn Direct API Integration',
      category: 'platform_restricted',
      status: 'requires_platform_permission',
      description:
        'LinkedIn prohibits unauthorized automated scraping. Global Reach discovers official LinkedIn links published on public websites/APIs and opens exact profile URLs for human review and connection.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'instagram_graph_api',
      name: 'Instagram Graph API Integration',
      category: 'platform_restricted',
      status: 'requires_platform_permission',
      description:
        'Instagram prohibits unauthorized scraping. Global Reach extracts official public Instagram business links from verified company websites and opens them directly.',
      contactsDiscoveredTotal: 0,
    },
    {
      id: 'whatsapp_business_api',
      name: 'WhatsApp Business Cloud API',
      category: 'platform_restricted',
      status: 'requires_platform_permission',
      description:
        'Global Reach never scrapes private phone numbers. Official wa.me click-to-chat links are generated strictly from exact published WhatsApp Business numbers found on official websites.',
      contactsDiscoveredTotal: 0,
    },
  ];
}

function createInitialSchedulerState(): GlobalReachSchedulerState {
  const nextRun = new Date(Date.now() + HOURLY_INTERVAL_MS).toISOString();
  return {
    status: 'active_waiting',
    enabled: true,
    paused: false,
    intervalMinutes: 60,
    isRunningNow: false,
    lockAcquiredAt: null,
    lastAttemptAt: null,
    lastSuccessfulRunAt: null,
    lastSuccessfulRunEat: null,
    nextScheduledRunAt: nextRun,
    nextScheduledRunEat: formatEatTimestamp(nextRun),
    totalCyclesCompleted: 0,
    totalCyclesFailed: 0,
    consecutiveFailures: 0,
    lastError: null,
    checkpointIndex: 0,
    lastRegionScanned: null,
    recoveryNotes: null,
  };
}

function createWorkspace(
  workspaceId: string,
  isOwnerWorkspace: boolean,
  email: string
): GlobalReachWorkspace {
  return {
    workspaceId,
    isOwnerWorkspace,
    profile: isOwnerWorkspace
      ? createYeabsraOwnerProfile()
      : createDefaultRegisteredUserProfile(workspaceId, email),
    contacts: [],
    notifications: [],
    suppressionList: [],
    recentCycles: [],
    scheduler: createInitialSchedulerState(),
    sources: createInitialSources(),
    apiErrorCount: 0,
  };
}

interface GlobalRegionRotationSlot {
  region: GlobalReachRegion;
  countries: Array<{ name: string; iso2: string; city: string }>;
  githubLocations: string[];
  officialDirectorySeeds: Array<{
    name: string;
    country: string;
    city: string;
    industry: string;
    entityType: GlobalReachEntityType;
    organizationSize: GlobalReachOrgSize;
    category: GlobalReachContactCategory;
    website: string;
    sponsorshipHint: GlobalReachSponsorshipTier;
    mentorshipHint?: boolean;
    webDevHint?: boolean;
  }>;
}

/**
 * Rotating global public organization seed directory across all 7 continents/regions.
 * Every URL is a genuine public organization website that is LIVE-FETCHED and LIVE-VERIFIED
 * via SSRF-guarded HTTP during discovery; emails/WhatsApp/LinkedIn/Instagram are NEVER fabricated —
 * only extracted when actually published on the live official website!
 */
const GLOBAL_ROTATION_SLOTS: GlobalRegionRotationSlot[] = [
  {
    region: 'Europe',
    countries: [
      { name: 'Germany', iso2: 'DE', city: 'Frankfurt' },
      { name: 'United Kingdom', iso2: 'GB', city: 'London' },
      { name: 'Netherlands', iso2: 'NL', city: 'Amsterdam' },
      { name: 'Ireland', iso2: 'IE', city: 'Dublin' },
    ],
    githubLocations: ['London', 'Berlin', 'Amsterdam', 'Dublin'],
    officialDirectorySeeds: [
      {
        name: 'Triodos Bank',
        country: 'Netherlands',
        city: 'Zeist',
        industry: 'Sustainable Banking & Financial Services',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'potential_employers',
        website: 'https://www.triodos.com/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Oikocredit International',
        country: 'Netherlands',
        city: 'Amersfoort',
        industry: 'Microfinance & Impact Investing',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'finance_professionals',
        website: 'https://www.oikocredit.coop/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'FMO Entrepreneurial Development Bank',
        country: 'Netherlands',
        city: 'The Hague',
        industry: 'Development Banking & Finance',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'banking_executives',
        website: 'https://www.fmo.nl/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'ProCredit Holding',
        country: 'Germany',
        city: 'Frankfurt',
        industry: 'SME Commercial Banking',
        entityType: 'organization',
        organizationSize: 'plc_listed',
        category: 'potential_employers',
        website: 'https://www.procredit-holding.com/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'European Microfinance Network (EMN)',
        country: 'Belgium',
        city: 'Brussels',
        industry: 'Microfinance & Financial Inclusion Network',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'mentors',
        website: 'https://www.european-microfinance.org/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
      {
        name: 'MicroMentor (Mercy Corps)',
        country: 'United Kingdom',
        city: 'Edinburgh',
        industry: 'Global Business Mentorship & Entrepreneurship',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'mentors',
        website: 'https://www.micromentor.org/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
    ],
  },
  {
    region: 'Middle East',
    countries: [
      { name: 'United Arab Emirates', iso2: 'AE', city: 'Dubai' },
      { name: 'Qatar', iso2: 'QA', city: 'Doha' },
      { name: 'Saudi Arabia', iso2: 'SA', city: 'Riyadh' },
      { name: 'Bahrain', iso2: 'BH', city: 'Manama' },
    ],
    githubLocations: ['Dubai', 'Abu Dhabi', 'Riyadh', 'Doha'],
    officialDirectorySeeds: [
      {
        name: 'Dubai International Financial Centre (DIFC)',
        country: 'United Arab Emirates',
        city: 'Dubai',
        industry: 'Banking, Fintech & Financial Services Hub',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'banking_executives',
        website: 'https://www.difc.ae/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Dubai Chamber of Commerce',
        country: 'United Arab Emirates',
        city: 'Dubai',
        industry: 'Chamber of Commerce & Business Network',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'business_owners',
        website: 'https://www.dubaichamber.com/',
        sponsorshipHint: 'unknown_sponsorship',
        webDevHint: true,
      },
      {
        name: 'Qatar Financial Centre (QFC)',
        country: 'Qatar',
        city: 'Doha',
        industry: 'Financial Services & International Business',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'finance_professionals',
        website: 'https://www.qfc.qa/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Bahrain FinTech Bay',
        country: 'Bahrain',
        city: 'Manama',
        industry: 'Fintech & Digital Banking Ecosystem',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'entrepreneurs',
        website: 'https://www.bahrainfintechbay.com/',
        sponsorshipHint: 'unknown_sponsorship',
        webDevHint: true,
        mentorshipHint: true,
      },
      {
        name: 'AstroLabs MENA',
        country: 'United Arab Emirates',
        city: 'Dubai',
        industry: 'Startup Expansion, Tech & Business Services',
        entityType: 'organization',
        organizationSize: 'small_business',
        category: 'entrepreneurs',
        website: 'https://astrolabs.com/',
        sponsorshipHint: 'international_recruiter',
        webDevHint: true,
        mentorshipHint: true,
      },
    ],
  },
  {
    region: 'North America',
    countries: [
      { name: 'Canada', iso2: 'CA', city: 'Toronto' },
      { name: 'United States', iso2: 'US', city: 'New York' },
      { name: 'Canada', iso2: 'CA', city: 'Vancouver' },
    ],
    githubLocations: ['Toronto', 'Vancouver', 'New York', 'Austin'],
    officialDirectorySeeds: [
      {
        name: 'Accion International',
        country: 'United States',
        city: 'Washington, D.C.',
        industry: 'Global Financial Inclusion & Banking NGO',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'ngos_and_foundations',
        website: 'https://www.accion.org/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Kiva Microfunds',
        country: 'United States',
        city: 'San Francisco',
        industry: 'Microfinance & Social Impact Lending',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'finance_professionals',
        website: 'https://www.kiva.org/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Toronto Region Immigrant Employment Council (TRIEC)',
        country: 'Canada',
        city: 'Toronto',
        industry: 'International Talent & Mentorship Network',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'mentors',
        website: 'https://triec.ca/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
      {
        name: 'Windmill Microlending',
        country: 'Canada',
        city: 'Calgary',
        industry: 'Skilled Immigrant Career Finance & Support',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'mentors',
        website: 'https://windmillmicrolending.org/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
      {
        name: 'Opportunity International',
        country: 'United States',
        city: 'Chicago',
        industry: 'Microfinance, Banking & Global Development',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'ngos_and_foundations',
        website: 'https://opportunity.org/',
        sponsorshipHint: 'international_recruiter',
      },
    ],
  },
  {
    region: 'Europe',
    countries: [
      { name: 'Switzerland', iso2: 'CH', city: 'Zurich' },
      { name: 'Sweden', iso2: 'SE', city: 'Stockholm' },
      { name: 'Norway', iso2: 'NO', city: 'Oslo' },
      { name: 'Luxembourg', iso2: 'LU', city: 'Luxembourg' },
    ],
    githubLocations: ['Stockholm', 'Zurich', 'Oslo', 'Copenhagen'],
    officialDirectorySeeds: [
      {
        name: 'responsAbility Investments',
        country: 'Switzerland',
        city: 'Zurich',
        industry: 'Impact Asset Management & Financial Inclusion',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'investors',
        website: 'https://www.responsability.com/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'BlueOrchard Finance',
        country: 'Switzerland',
        city: 'Zurich',
        industry: 'Impact Investing & Microfinance',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'investors',
        website: 'https://www.blueorchard.com/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'ADA Microfinance Luxembourg',
        country: 'Luxembourg',
        city: 'Luxembourg',
        industry: 'Inclusive Finance & International NGO',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'ngos_and_foundations',
        website: 'https://www.ada-microfinance.org/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Norfund (Norwegian Investment Fund)',
        country: 'Norway',
        city: 'Oslo',
        industry: 'Development Finance & Banking Investments',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'investors',
        website: 'https://www.norfund.no/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Swedfund International',
        country: 'Sweden',
        city: 'Stockholm',
        industry: 'Development Finance Institution',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'finance_professionals',
        website: 'https://www.swedfund.se/',
        sponsorshipHint: 'international_recruiter',
      },
    ],
  },
  {
    region: 'Asia',
    countries: [
      { name: 'Singapore', iso2: 'SG', city: 'Singapore' },
      { name: 'Japan', iso2: 'JP', city: 'Tokyo' },
      { name: 'Malaysia', iso2: 'MY', city: 'Kuala Lumpur' },
    ],
    githubLocations: ['Singapore', 'Tokyo', 'Kuala Lumpur'],
    officialDirectorySeeds: [
      {
        name: 'Singapore FinTech Association',
        country: 'Singapore',
        city: 'Singapore',
        industry: 'Fintech & Digital Financial Services',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'banking_executives',
        website: 'https://singaporefintech.org/',
        sponsorshipHint: 'unknown_sponsorship',
        webDevHint: true,
      },
      {
        name: 'AVPN (Asian Venture Philanthropy Network)',
        country: 'Singapore',
        city: 'Singapore',
        industry: 'Philanthropy, Impact Investors & Foundations',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'philanthropists',
        website: 'https://avpn.asia/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
      {
        name: 'Asian Development Bank Institute (ADBI)',
        country: 'Japan',
        city: 'Tokyo',
        industry: 'Development Banking & Economic Policy',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'finance_professionals',
        website: 'https://www.adb.org/adbi',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Impact Investment Exchange (IIX)',
        country: 'Singapore',
        city: 'Singapore',
        industry: 'Impact Finance & Sustainable Markets',
        entityType: 'organization',
        organizationSize: 'small_business',
        category: 'investors',
        website: 'https://iixglobal.com/',
        sponsorshipHint: 'international_recruiter',
      },
    ],
  },
  {
    region: 'Africa',
    countries: [
      { name: 'Kenya', iso2: 'KE', city: 'Nairobi' },
      { name: 'South Africa', iso2: 'ZA', city: 'Johannesburg' },
      { name: 'Rwanda', iso2: 'RW', city: 'Kigali' },
      { name: 'Mauritius', iso2: 'MU', city: 'Port Louis' },
    ],
    githubLocations: ['Nairobi', 'Cape Town', 'Kigali', 'Johannesburg'],
    officialDirectorySeeds: [
      {
        name: 'Trade and Development Bank Group (TDB)',
        country: 'Kenya',
        city: 'Nairobi',
        industry: 'Regional Development & Commercial Banking',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'potential_employers',
        website: 'https://www.tdbgroup.org/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Afreximbank',
        country: 'Egypt',
        city: 'Cairo',
        industry: 'Pan-African Trade & Export-Import Banking',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'potential_employers',
        website: 'https://www.afreximbank.com/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Kigali International Financial Centre',
        country: 'Rwanda',
        city: 'Kigali',
        industry: 'International Financial Services & Fintech Hub',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'banking_executives',
        website: 'https://kifc.rw/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'Tony Elumelu Foundation',
        country: 'Nigeria',
        city: 'Lagos',
        industry: 'Entrepreneurship, Mentorship & Philanthropy',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'philanthropists',
        website: 'https://www.tonyelumelufoundation.org/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
      {
        name: 'FSD Africa',
        country: 'Kenya',
        city: 'Nairobi',
        industry: 'Financial Sector Deepening & Capital Markets',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'finance_professionals',
        website: 'https://fsdafrica.org/',
        sponsorshipHint: 'international_recruiter',
      },
    ],
  },
  {
    region: 'Australia & Oceania',
    countries: [
      { name: 'Australia', iso2: 'AU', city: 'Sydney' },
      { name: 'New Zealand', iso2: 'NZ', city: 'Auckland' },
    ],
    githubLocations: ['Sydney', 'Melbourne', 'Auckland'],
    officialDirectorySeeds: [
      {
        name: 'Good Return',
        country: 'Australia',
        city: 'Sydney',
        industry: 'Responsible Finance & Impact Investment NGO',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'ngos_and_foundations',
        website: 'https://goodreturn.org.au/',
        sponsorshipHint: 'international_recruiter',
      },
      {
        name: 'FinTech Australia',
        country: 'Australia',
        city: 'Sydney',
        industry: 'Fintech & Financial Innovation Network',
        entityType: 'organization',
        organizationSize: 'small_business',
        category: 'entrepreneurs',
        website: 'https://www.fintechaustralia.org.au/',
        sponsorshipHint: 'unknown_sponsorship',
        webDevHint: true,
      },
      {
        name: 'FinTechNZ',
        country: 'New Zealand',
        city: 'Auckland',
        industry: 'Financial Technology & Digital Banking Network',
        entityType: 'organization',
        organizationSize: 'small_business',
        category: 'entrepreneurs',
        website: 'https://fintechnz.org.nz/',
        sponsorshipHint: 'unknown_sponsorship',
        webDevHint: true,
      },
    ],
  },
  {
    region: 'South America',
    countries: [
      { name: 'Brazil', iso2: 'BR', city: 'Sao Paulo' },
      { name: 'Chile', iso2: 'CL', city: 'Santiago' },
      { name: 'Colombia', iso2: 'CO', city: 'Bogota' },
    ],
    githubLocations: ['Sao Paulo', 'Santiago', 'Bogota'],
    officialDirectorySeeds: [
      {
        name: 'Start-Up Chile',
        country: 'Chile',
        city: 'Santiago',
        industry: 'Global Startup Accelerator & Entrepreneur Visa Hub',
        entityType: 'organization',
        organizationSize: 'medium_enterprise',
        category: 'entrepreneurs',
        website: 'https://startupchile.org/',
        sponsorshipHint: 'international_recruiter',
        webDevHint: true,
        mentorshipHint: true,
      },
      {
        name: 'Endeavor Global',
        country: 'Brazil',
        city: 'Sao Paulo',
        industry: 'High-Impact Entrepreneurship & Mentorship Network',
        entityType: 'organization',
        organizationSize: 'ngo_foundation',
        category: 'mentors',
        website: 'https://endeavor.org/',
        sponsorshipHint: 'mentorship_networking',
        mentorshipHint: true,
      },
      {
        name: 'CAF Development Bank of Latin America',
        country: 'Colombia',
        city: 'Bogota',
        industry: 'Multilateral Development Banking',
        entityType: 'organization',
        organizationSize: 'large_international',
        category: 'banking_executives',
        website: 'https://www.caf.com/',
        sponsorshipHint: 'international_recruiter',
      },
    ],
  },
];

const ISO2_COUNTRY_TO_REGION: Record<string, { name: string; region: GlobalReachRegion }> = {
  DE: { name: 'Germany', region: 'Europe' },
  GB: { name: 'United Kingdom', region: 'Europe' },
  UK: { name: 'United Kingdom', region: 'Europe' },
  NL: { name: 'Netherlands', region: 'Europe' },
  IE: { name: 'Ireland', region: 'Europe' },
  CH: { name: 'Switzerland', region: 'Europe' },
  SE: { name: 'Sweden', region: 'Europe' },
  NO: { name: 'Norway', region: 'Europe' },
  LU: { name: 'Luxembourg', region: 'Europe' },
  FR: { name: 'France', region: 'Europe' },
  BE: { name: 'Belgium', region: 'Europe' },
  DK: { name: 'Denmark', region: 'Europe' },
  FI: { name: 'Finland', region: 'Europe' },
  AT: { name: 'Austria', region: 'Europe' },
  ES: { name: 'Spain', region: 'Europe' },
  IT: { name: 'Italy', region: 'Europe' },
  AE: { name: 'United Arab Emirates', region: 'Middle East' },
  QA: { name: 'Qatar', region: 'Middle East' },
  SA: { name: 'Saudi Arabia', region: 'Middle East' },
  BH: { name: 'Bahrain', region: 'Middle East' },
  OM: { name: 'Oman', region: 'Middle East' },
  KW: { name: 'Kuwait', region: 'Middle East' },
  JO: { name: 'Jordan', region: 'Middle East' },
  CA: { name: 'Canada', region: 'North America' },
  US: { name: 'United States', region: 'North America' },
  SG: { name: 'Singapore', region: 'Asia' },
  JP: { name: 'Japan', region: 'Asia' },
  MY: { name: 'Malaysia', region: 'Asia' },
  KR: { name: 'South Korea', region: 'Asia' },
  IN: { name: 'India', region: 'Asia' },
  KE: { name: 'Kenya', region: 'Africa' },
  ZA: { name: 'South Africa', region: 'Africa' },
  RW: { name: 'Rwanda', region: 'Africa' },
  MU: { name: 'Mauritius', region: 'Africa' },
  EG: { name: 'Egypt', region: 'Africa' },
  NG: { name: 'Nigeria', region: 'Africa' },
  ET: { name: 'Ethiopia', region: 'Africa' },
  AU: { name: 'Australia', region: 'Australia & Oceania' },
  NZ: { name: 'New Zealand', region: 'Australia & Oceania' },
  BR: { name: 'Brazil', region: 'South America' },
  CL: { name: 'Chile', region: 'South America' },
  CO: { name: 'Colombia', region: 'South America' },
};

function inferRegionFromCountry(country: string, fallback: GlobalReachRegion = 'Europe'): GlobalReachRegion {
  const c = (country || '').toLowerCase();
  if (!c) return fallback;
  if (/germany|united kingdom|uk|britain|netherlands|ireland|switzerland|sweden|norway|finland|denmark|luxembourg|belgium|france|austria|spain|italy|poland|portugal|czech|europe/.test(c)) {
    return 'Europe';
  }
  if (/united arab emirates|uae|dubai|abu dhabi|qatar|saudi|bahrain|oman|kuwait|jordan|israel|middle east/.test(c)) {
    return 'Middle East';
  }
  if (/canada|united states|usa|america|mexico/.test(c)) {
    return 'North America';
  }
  if (/singapore|japan|malaysia|korea|india|china|hong kong|thailand|vietnam|indonesia|philippines|asia/.test(c)) {
    return 'Asia';
  }
  if (/australia|new zealand|oceania/.test(c)) {
    return 'Australia & Oceania';
  }
  if (/brazil|chile|colombia|argentina|peru|uruguay|ecuador|south america/.test(c)) {
    return 'South America';
  }
  if (/kenya|south africa|rwanda|mauritius|egypt|nigeria|ghana|ethiopia|morocco|tanzania|uganda|africa/.test(c)) {
    return 'Africa';
  }
  return fallback;
}

export function buildCanonicalDedupKey(input: {
  publicEmail?: string;
  linkedInUrl?: string;
  whatsAppBusinessNumber?: string;
  officialWebsite?: string;
  fullName?: string;
  companyName?: string;
}): string {
  const email = (input.publicEmail || '').trim().toLowerCase();
  if (email && isValidPublicEmailSyntax(email)) {
    return `email:${email}`;
  }
  const li = inspectLinkedInUrl(input.linkedInUrl).validUrl;
  if (li) {
    return `li:${li.toLowerCase().replace(/\/+$/, '')}`;
  }
  const waDigits = normalizePublishedWhatsAppDigits(input.whatsAppBusinessNumber);
  if (waDigits) {
    return `wa:${waDigits}`;
  }
  const domain = extractDomainFromUrl(input.officialWebsite);
  const nameSlug = (input.fullName || input.companyName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48);
  if (domain) {
    return `dom:${domain}|${nameSlug}`;
  }
  return `name:${nameSlug || crypto.randomUUID()}`;
}

export async function safePublicFetch(
  rawUrl: string,
  options?: {
    accept?: string;
    timeoutMs?: number;
    maxBytes?: number;
    headers?: Record<string, string>;
  }
): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  body: string;
  error?: string;
}> {
  let currentUrl = rawUrl;
  const maxRedirects = 3;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await validatePublicCrawlUrl(currentUrl);
    if (!check.ok || !check.normalizedUrl) {
      return {
        ok: false,
        status: 0,
        finalUrl: currentUrl,
        body: '',
        error: check.reason || 'Blocked by SSRF security check',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options?.timeoutMs || FETCH_TIMEOUT_MS);
    try {
      const resp = await fetch(check.normalizedUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: options?.accept || 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          ...(options?.headers || {}),
        },
      });
      clearTimeout(timer);

      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get('location');
        if (loc) {
          currentUrl = new URL(loc, check.normalizedUrl).toString();
          continue;
        }
      }

      const text = await resp.text();
      const body = text.slice(0, options?.maxBytes || MAX_HTML_BYTES);
      return {
        ok: resp.status >= 200 && resp.status < 400,
        status: resp.status,
        finalUrl: check.normalizedUrl,
        body,
      };
    } catch (err: any) {
      clearTimeout(timer);
      return {
        ok: false,
        status: 0,
        finalUrl: currentUrl,
        body: '',
        error: err?.name === 'AbortError' ? 'Request timed out' : String(err?.message || 'Network error'),
      };
    }
  }

  return {
    ok: false,
    status: 0,
    finalUrl: currentUrl,
    body: '',
    error: 'Too many redirects',
  };
}

interface ExtractedWebsiteContactSignals {
  publicEmail?: string;
  emailMatchesOfficialDomain: boolean;
  linkedInUrl?: string;
  instagramUrl?: string;
  whatsAppBusinessNumber?: string;
  whatsAppBusinessUrl?: string;
  publicBusinessPhone?: string;
  contactPageUrl?: string;
  sponsorshipTierDetected?: GlobalReachSponsorshipTier;
  sponsorshipNote?: string;
  mentorshipDetected: boolean;
  internationalRecruiterDetected: boolean;
}

export function extractPublicContactsFromHtml(
  html: string,
  pageUrl: string
): ExtractedWebsiteContactSignals {
  const officialDomain = extractDomainFromUrl(pageUrl);
  const emailsFound: string[] = [];

  // 1. Prefer explicit mailto: links
  const mailtoRegex = /href\s*=\s*["']mailto:([^"'?#\s]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRegex.exec(html)) !== null) {
    const candidate = decodeURIComponent(m[1]).trim().toLowerCase();
    if (isValidPublicEmailSyntax(candidate)) {
      emailsFound.push(candidate);
    }
  }

  // 2. Also scan visible text (stripping script/style) for public business emails
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const emailRegex = /\b([a-z0-9._%+-]{2,64}@[a-z0-9.-]{2,120}\.[a-z]{2,16})\b/gi;
  while ((m = emailRegex.exec(visibleText)) !== null) {
    const candidate = m[1].trim().toLowerCase();
    if (isValidPublicEmailSyntax(candidate)) {
      emailsFound.push(candidate);
    }
  }

  const filteredEmails = Array.from(new Set(emailsFound)).filter((em) => {
    const [local, dom] = em.split('@');
    if (!local || !dom) return false;
    if (DISPOSABLE_OR_SUSPICIOUS_DOMAINS.has(dom)) return false;
    if (/\.(png|jpg|jpeg|svg|webp|gif|css|js)$/i.test(em)) return false;
    if (IGNORED_EMAIL_PREFIXES.some((p) => local === p || local.startsWith(`${p}.`) || local.startsWith(`${p}-`))) {
      return false;
    }
    return true;
  });

  // Prefer official-domain matching professional email
  const domainMatchingEmail = filteredEmails.find((em) => {
    const dom = extractDomainFromEmail(em);
    return officialDomain && (dom === officialDomain || dom.endsWith(`.${officialDomain}`) || officialDomain.endsWith(`.${dom}`));
  });
  const chosenEmail = domainMatchingEmail || filteredEmails[0];

  // 3. Official LinkedIn profile/company link
  let linkedInUrl: string | undefined;
  const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in|school)\/[a-zA-Z0-9\-_%]+/i);
  if (liMatch) {
    const checked = inspectLinkedInUrl(liMatch[0]);
    if (checked.validUrl) linkedInUrl = checked.validUrl;
  }

  // 4. Official Instagram business link
  let instagramUrl: string | undefined;
  const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|accounts\/)[a-zA-Z0-9._]{2,40}\/?/i);
  if (igMatch) {
    const checked = inspectInstagramUrl(igMatch[0]);
    if (checked.validUrl) instagramUrl = checked.validUrl;
  }

  // 5. Published WhatsApp Business link (STRICT — only explicit wa.me / api.whatsapp.com links)
  let whatsAppBusinessNumber: string | undefined;
  let whatsAppBusinessUrl: string | undefined;
  const waMatch = html.match(/https?:\/\/(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\+?\d[\d\s\-]{7,18}/i);
  if (waMatch) {
    const digits = normalizePublishedWhatsAppDigits(waMatch[0]);
    if (digits) {
      whatsAppBusinessNumber = `+${digits}`;
      whatsAppBusinessUrl = buildWhatsAppChatUrl(whatsAppBusinessNumber) || undefined;
    }
  }

  // 6. Published business telephone (explicit tel: links only)
  let publicBusinessPhone: string | undefined;
  const telMatch = html.match(/href\s*=\s*["']tel:(\+?[0-9\s\-().]{7,24})["']/i);
  if (telMatch) {
    const cleaned = telMatch[1].trim();
    const digitCount = cleaned.replace(/[^\d]/g, '').length;
    if (digitCount >= 8 && digitCount <= 16) {
      publicBusinessPhone = cleaned;
    }
  }

  // 7. Official Contact page link
  let contactPageUrl: string | undefined;
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  while ((m = hrefRegex.exec(html)) !== null) {
    const href = m[1].trim();
    if (/(?:^|\/)(?:contact|contact-us|contactus|get-in-touch|connect|about\/contact|careers)(?:\/|$|\?)/i.test(href)) {
      try {
        const resolved = new URL(href, pageUrl).toString();
        const resDom = extractDomainFromUrl(resolved);
        if (resDom && officialDomain && (resDom === officialDomain || resDom.endsWith(`.${officialDomain}`))) {
          contactPageUrl = resolved;
          break;
        }
      } catch {
        // skip invalid relative link
      }
    }
  }

  // 8. Honest sponsorship / international hiring / mentorship signals
  const lower = visibleText.toLowerCase();
  let sponsorshipTierDetected: GlobalReachSponsorshipTier | undefined;
  let sponsorshipNote: string | undefined;

  if (/visa sponsorship available|we sponsor work visas|work permit sponsorship provided|employer-sponsored visa/i.test(lower)) {
    sponsorshipTierDetected = 'confirmed_sponsorship';
    sponsorshipNote = 'Official webpage explicitly references visa or work-permit sponsorship.';
  } else if (/sponsored international|previously sponsored|tier 2 sponsor|licensed sponsor|blue card/i.test(lower)) {
    sponsorshipTierDetected = 'previous_sponsorship_evidence';
    sponsorshipNote = 'Official webpage references licensed sponsor status or international work-permit pathways.';
  } else if (/international applicants|global careers|worldwide remote|relocation support|diverse global team|careers/i.test(lower)) {
    sponsorshipTierDetected = 'international_recruiter';
    sponsorshipNote = 'Official webpage indicates international hiring or global team operations (sponsorship not independently confirmed).';
  }

  const mentorshipDetected = /\b(mentor|mentorship|mentoring|fellowship|career coaching|advisory network)\b/i.test(lower);
  const internationalRecruiterDetected =
    sponsorshipTierDetected === 'confirmed_sponsorship' ||
    sponsorshipTierDetected === 'previous_sponsorship_evidence' ||
    sponsorshipTierDetected === 'international_recruiter';

  return {
    publicEmail: chosenEmail,
    emailMatchesOfficialDomain: Boolean(domainMatchingEmail),
    linkedInUrl,
    instagramUrl,
    whatsAppBusinessNumber,
    whatsAppBusinessUrl,
    publicBusinessPhone,
    contactPageUrl,
    sponsorshipTierDetected,
    sponsorshipNote,
    mentorshipDetected,
    internationalRecruiterDetected,
  };
}

export async function verifyLiveContact(
  contact: GlobalReachContact
): Promise<{
  verificationStatus: GlobalReachVerificationStatus;
  verificationNotes: string;
  httpStatus?: number;
  emailMatchesOfficialDomain: boolean;
  enrichedFields: Partial<GlobalReachContact>;
  lastVerifiedAt: string;
}> {
  const nowIso = new Date().toISOString();
  const emailDomain = extractDomainFromEmail(contact.publicEmail);
  if (emailDomain && DISPOSABLE_OR_SUSPICIOUS_DOMAINS.has(emailDomain)) {
    return {
      verificationStatus: 'invalid_or_outdated_contact',
      verificationNotes: `Blocked suspicious or disposable email domain (${emailDomain}).`,
      emailMatchesOfficialDomain: false,
      enrichedFields: {},
      lastVerifiedAt: nowIso,
    };
  }

  const targetWebsite = sanitizeExternalHttpUrl(contact.officialWebsite || contact.sourceUrl);
  if (!targetWebsite) {
    return {
      verificationStatus: contact.publicEmail ? 'public_contact_unverified' : 'unverified_contact',
      verificationNotes: 'No valid official website URL available for live verification.',
      emailMatchesOfficialDomain: false,
      enrichedFields: {},
      lastVerifiedAt: nowIso,
    };
  }

  const homeFetch = await safePublicFetch(targetWebsite);
  if (!homeFetch.ok) {
    return {
      verificationStatus:
        homeFetch.status >= 400 || homeFetch.error?.includes('SSRF') || homeFetch.error?.includes('Blocked')
          ? 'invalid_or_outdated_contact'
          : 'public_contact_unverified',
      verificationNotes: homeFetch.error
        ? `Live verification check failed: ${homeFetch.error}`
        : `Official website returned HTTP ${homeFetch.status}.`,
      httpStatus: homeFetch.status || undefined,
      emailMatchesOfficialDomain: false,
      enrichedFields: {},
      lastVerifiedAt: nowIso,
    };
  }

  let extracted = extractPublicContactsFromHtml(homeFetch.body, homeFetch.finalUrl);

  // If no direct email found on homepage and an official contact page link exists, check contact page too
  if (!extracted.publicEmail && extracted.contactPageUrl && extracted.contactPageUrl !== homeFetch.finalUrl) {
    const contactFetch = await safePublicFetch(extracted.contactPageUrl, { timeoutMs: 5500 });
    if (contactFetch.ok) {
      const contactSignals = extractPublicContactsFromHtml(contactFetch.body, contactFetch.finalUrl);
      extracted = {
        ...extracted,
        publicEmail: contactSignals.publicEmail || extracted.publicEmail,
        emailMatchesOfficialDomain:
          contactSignals.emailMatchesOfficialDomain || extracted.emailMatchesOfficialDomain,
        linkedInUrl: extracted.linkedInUrl || contactSignals.linkedInUrl,
        instagramUrl: extracted.instagramUrl || contactSignals.instagramUrl,
        whatsAppBusinessNumber:
          extracted.whatsAppBusinessNumber || contactSignals.whatsAppBusinessNumber,
        whatsAppBusinessUrl: extracted.whatsAppBusinessUrl || contactSignals.whatsAppBusinessUrl,
        publicBusinessPhone: extracted.publicBusinessPhone || contactSignals.publicBusinessPhone,
        sponsorshipTierDetected:
          contactSignals.sponsorshipTierDetected || extracted.sponsorshipTierDetected,
        sponsorshipNote: contactSignals.sponsorshipNote || extracted.sponsorshipNote,
        mentorshipDetected: extracted.mentorshipDetected || contactSignals.mentorshipDetected,
        internationalRecruiterDetected:
          extracted.internationalRecruiterDetected || contactSignals.internationalRecruiterDetected,
      };
    }
  }

  const finalEmail = contact.publicEmail || extracted.publicEmail;
  const officialDomain = extractDomainFromUrl(homeFetch.finalUrl);
  const finalEmailDom = extractDomainFromEmail(finalEmail);
  const domainMatches = Boolean(
    finalEmail &&
      officialDomain &&
      finalEmailDom &&
      (finalEmailDom === officialDomain ||
        finalEmailDom.endsWith(`.${officialDomain}`) ||
        officialDomain.endsWith(`.${finalEmailDom}`))
  );

  let status: GlobalReachVerificationStatus = 'verified_organization';
  let notes = `Live official website verified (HTTP ${homeFetch.status} on ${officialDomain}).`;

  if (finalEmail && domainMatches) {
    status = 'verified_public_professional_contact';
    notes = `Live official website verified (HTTP ${homeFetch.status}) and public email matches official domain (${officialDomain}).`;
  } else if (finalEmail && !domainMatches) {
    status = 'public_contact_unverified';
    notes = `Official website verified (HTTP ${homeFetch.status}), but public email (${finalEmailDom}) uses a different domain than ${officialDomain}.`;
  }

  const enrichedFields: Partial<GlobalReachContact> = {
    officialWebsite: homeFetch.finalUrl,
    publicEmail: finalEmail,
    linkedInUrl: contact.linkedInUrl || extracted.linkedInUrl,
    instagramUrl: contact.instagramUrl || extracted.instagramUrl,
    whatsAppBusinessNumber: contact.whatsAppBusinessNumber || extracted.whatsAppBusinessNumber,
    whatsAppBusinessUrl: contact.whatsAppBusinessUrl || extracted.whatsAppBusinessUrl,
    publicBusinessPhone: contact.publicBusinessPhone || extracted.publicBusinessPhone,
    contactPageUrl: contact.contactPageUrl || extracted.contactPageUrl,
    mentorshipAvailable: contact.mentorshipAvailable || extracted.mentorshipDetected,
    internationalRecruiterSignal:
      contact.internationalRecruiterSignal || extracted.internationalRecruiterDetected,
  };

  if (
    extracted.sponsorshipTierDetected &&
    (contact.sponsorshipTier === 'unknown_sponsorship' ||
      extracted.sponsorshipTierDetected === 'confirmed_sponsorship')
  ) {
    enrichedFields.sponsorshipTier = extracted.sponsorshipTierDetected;
    if (extracted.sponsorshipNote) {
      enrichedFields.sponsorshipEvidenceNote = extracted.sponsorshipNote;
    }
  }

  return {
    verificationStatus: status,
    verificationNotes: notes,
    httpStatus: homeFetch.status,
    emailMatchesOfficialDomain: domainMatches,
    enrichedFields,
    lastVerifiedAt: nowIso,
  };
}

interface RawDiscoveredCandidate {
  entityType: GlobalReachEntityType;
  fullName: string;
  companyName: string;
  positionOrRole: string;
  industry: string;
  organizationSize: GlobalReachOrgSize;
  country: string;
  city?: string;
  region: GlobalReachRegion;
  officialWebsite?: string;
  publicEmail?: string;
  publicBusinessPhone?: string;
  whatsAppBusinessNumber?: string;
  whatsAppBusinessUrl?: string;
  linkedInUrl?: string;
  instagramUrl?: string;
  contactPageUrl?: string;
  sourceUrl: string;
  sourceName: string;
  sourceId: string;
  sponsorshipTier: GlobalReachSponsorshipTier;
  sponsorshipEvidenceNote: string;
  mentorshipAvailable: boolean;
  websiteDevProspect: boolean;
  internationalRecruiterSignal: boolean;
  category: GlobalReachContactCategory;
  tags: string[];
}

async function discoverFromOfficialSeeds(
  slot: GlobalRegionRotationSlot,
  countryFilter?: string,
  limit = 4
): Promise<{ candidates: RawDiscoveredCandidate[]; errors: string[] }> {
  const candidates: RawDiscoveredCandidate[] = [];
  const errors: string[] = [];

  const seeds = slot.officialDirectorySeeds.filter((s) =>
    countryFilter ? s.country.toLowerCase().includes(countryFilter.toLowerCase()) : true
  );
  const chosen = (seeds.length > 0 ? seeds : slot.officialDirectorySeeds).slice(0, limit);

  for (const seed of chosen) {
    candidates.push({
      entityType: seed.entityType,
      fullName: seed.name,
      companyName: seed.name,
      positionOrRole: seed.entityType === 'organization' ? 'Official Organization Contact' : 'Leadership',
      industry: seed.industry,
      organizationSize: seed.organizationSize,
      country: seed.country,
      city: seed.city,
      region: inferRegionFromCountry(seed.country, slot.region),
      officialWebsite: seed.website,
      sourceUrl: seed.website,
      sourceName: 'Official Organization Website',
      sourceId: 'official_org_websites',
      sponsorshipTier: seed.sponsorshipHint,
      sponsorshipEvidenceNote:
        seed.sponsorshipHint === 'mentorship_networking'
          ? 'Mentorship, networking, or career guidance organization (not an automatic visa sponsor).'
          : seed.sponsorshipHint === 'international_recruiter'
          ? 'Organization operates internationally; verify individual role sponsorship on official careers page.'
          : 'Sponsorship policy not independently confirmed.',
      mentorshipAvailable: Boolean(seed.mentorshipHint),
      websiteDevProspect: Boolean(seed.webDevHint),
      internationalRecruiterSignal: seed.sponsorshipHint === 'international_recruiter',
      category: seed.category,
      tags: [seed.industry, seed.country, slot.region],
    });
  }

  return { candidates, errors };
}

async function discoverFromReliefWebApi(
  slot: GlobalRegionRotationSlot,
  offset: number
): Promise<{ candidates: RawDiscoveredCandidate[]; errors: string[] }> {
  const candidates: RawDiscoveredCandidate[] = [];
  const errors: string[] = [];

  const url = `https://api.reliefweb.int/v1/sources?appname=hopelandjobs&limit=10&offset=${(offset * 5) % 80}&preset=latest&fields[include][]=name&fields[include][]=homepage&fields[include][]=country&fields[include][]=type&fields[include][]=url`;
  const resp = await safePublicFetch(url, { accept: 'application/json', timeoutMs: 7000 });
  if (!resp.ok) {
    errors.push(`ReliefWeb API returned status ${resp.status}: ${resp.error || 'unavailable'}`);
    return { candidates, errors };
  }

  try {
    const parsed = JSON.parse(resp.body);
    const items: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
    for (const item of items) {
      const fields = item?.fields || {};
      const name = String(fields.name || '').trim();
      const homepage = sanitizeExternalHttpUrl(fields.homepage);
      if (!name || !homepage) continue;

      const countryObj = Array.isArray(fields.country) ? fields.country[0] : fields.country;
      const countryName = String(countryObj?.name || slot.countries[0]?.name || 'International').trim();
      const typeName = String(fields.type?.name || 'International Organization');
      const region = inferRegionFromCountry(countryName, slot.region);

      candidates.push({
        entityType: 'organization',
        fullName: name,
        companyName: name,
        positionOrRole: `${typeName} — Official Headquarters`,
        industry: 'International NGO, Humanitarian & Development Finance',
        organizationSize: 'ngo_foundation',
        country: countryName,
        region,
        officialWebsite: homepage,
        sourceUrl: sanitizeExternalHttpUrl(fields.url) || homepage,
        sourceName: 'ReliefWeb Official Public API',
        sourceId: 'reliefweb_public_api',
        sponsorshipTier: 'international_recruiter',
        sponsorshipEvidenceNote:
          'Listed international NGO / organization in ReliefWeb public directory; visa sponsorship depends on specific international vacancy.',
        mentorshipAvailable: false,
        websiteDevProspect: false,
        internationalRecruiterSignal: true,
        category: 'ngos_and_foundations',
        tags: ['NGO', 'International Organization', typeName, countryName],
      });
      if (candidates.length >= 3) break;
    }
  } catch (err: any) {
    errors.push(`ReliefWeb API JSON parse failed: ${err?.message || 'unknown error'}`);
  }

  return { candidates, errors };
}

async function discoverFromGleifApi(
  slot: GlobalRegionRotationSlot,
  pageSeed: number
): Promise<{ candidates: RawDiscoveredCandidate[]; errors: string[] }> {
  const candidates: RawDiscoveredCandidate[] = [];
  const errors: string[] = [];

  const targetCountry = slot.countries[pageSeed % slot.countries.length] || slot.countries[0];
  if (!targetCountry) return { candidates, errors };

  const searchTerms = ['Bank', 'Finance', 'Capital', 'Microfinance', 'Fintech'];
  const term = searchTerms[pageSeed % searchTerms.length];
  const url = `https://api.gleif.org/api/v1/lei-records?filter[entity.legalAddress.country]=${encodeURIComponent(
    targetCountry.iso2
  )}&filter[entity.legalName]=${encodeURIComponent(term)}&page[size]=6&page[number]=1`;

  const resp = await safePublicFetch(url, { accept: 'application/vnd.api+json,application/json', timeoutMs: 7000 });
  if (!resp.ok) {
    errors.push(`GLEIF LEI API (${targetCountry.iso2}) returned status ${resp.status}: ${resp.error || 'unavailable'}`);
    return { candidates, errors };
  }

  try {
    const parsed = JSON.parse(resp.body);
    const items: any[] = Array.isArray(parsed?.data) ? parsed.data : [];
    for (const item of items) {
      const attrs = item?.attributes || {};
      const entity = attrs?.entity || {};
      const legalName = String(entity?.legalName?.name || '').trim();
      const status = String(entity?.status || '').toUpperCase();
      if (!legalName || status !== 'ACTIVE') continue;

      const lei = String(item?.id || '').trim();
      const city = String(entity?.legalAddress?.city || targetCountry.city || '').trim();
      const countryMeta = ISO2_COUNTRY_TO_REGION[targetCountry.iso2] || {
        name: targetCountry.name,
        region: slot.region,
      };
      const isPlc = /\b(plc|ag|nv|se|inc\.|corp\.|sa|ltd)\b/i.test(legalName);
      const isBank = /\b(bank|banking|credit|microfinance)\b/i.test(legalName);

      candidates.push({
        entityType: 'organization',
        fullName: legalName,
        companyName: legalName,
        positionOrRole: 'Registered Legal Financial Institution (GLEIF LEI Active)',
        industry: isBank ? 'Banking & Financial Services' : 'Finance & Capital Services',
        organizationSize: isPlc ? 'plc_listed' : 'medium_enterprise',
        country: countryMeta.name,
        city: city || undefined,
        region: countryMeta.region,
        officialWebsite: undefined,
        sourceUrl: lei
          ? `https://search.gleif.org/#/record/${encodeURIComponent(lei)}`
          : 'https://www.gleif.org/',
        sourceName: 'GLEIF Official Global LEI Registry',
        sourceId: 'gleif_lei_registry',
        sponsorshipTier: 'unknown_sponsorship',
        sponsorshipEvidenceNote:
          'Verified active legal entity in GLEIF Global LEI Registry; visa sponsorship policy is unknown until checked directly.',
        mentorshipAvailable: false,
        websiteDevProspect: false,
        internationalRecruiterSignal: isBank,
        category: isBank ? 'potential_employers' : 'finance_professionals',
        tags: ['GLEIF LEI Verified', term, countryMeta.name],
      });
      if (candidates.length >= 2) break;
    }
  } catch (err: any) {
    errors.push(`GLEIF LEI API parse error: ${err?.message || 'unknown error'}`);
  }

  return { candidates, errors };
}

async function discoverFromGitHubPublicProfiles(
  slot: GlobalRegionRotationSlot,
  cycleSeed: number,
  customQuery?: string
): Promise<{ candidates: RawDiscoveredCandidate[]; errors: string[] }> {
  const candidates: RawDiscoveredCandidate[] = [];
  const errors: string[] = [];

  const loc = slot.githubLocations[cycleSeed % slot.githubLocations.length] || slot.countries[0]?.city || 'London';
  const topicList = ['founder', 'fintech', 'finance', 'ceo', 'agency', 'mentor'];
  const topic = (customQuery || topicList[cycleSeed % topicList.length]).replace(/[^\w\s-]/g, '').trim();
  const q = encodeURIComponent(`${topic} location:"${loc}"`);
  const searchUrl = `https://api.github.com/search/users?q=${q}&per_page=5&page=1`;

  const ghHeaders: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (process.env.GITHUB_TOKEN?.trim()) {
    ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN.trim()}`;
  }

  const searchResp = await safePublicFetch(searchUrl, {
    accept: 'application/vnd.github+json',
    timeoutMs: 6500,
    headers: ghHeaders,
  });

  if (!searchResp.ok) {
    errors.push(`GitHub Public API returned HTTP ${searchResp.status}: ${searchResp.error || 'rate limited'}`);
    return { candidates, errors };
  }

  try {
    const parsed = JSON.parse(searchResp.body);
    const items: any[] = Array.isArray(parsed?.items) ? parsed.items : [];
    for (const userStub of items.slice(0, 3)) {
      const login = String(userStub?.login || '').trim();
      if (!login) continue;
      const profileResp = await safePublicFetch(`https://api.github.com/users/${encodeURIComponent(login)}`, {
        accept: 'application/vnd.github+json',
        timeoutMs: 5500,
        headers: ghHeaders,
      });
      if (!profileResp.ok) continue;

      const u = JSON.parse(profileResp.body);
      const displayName = String(u?.name || u?.login || '').trim();
      const rawBlog = String(u?.blog || '').trim();
      const normalizedBlog = rawBlog
        ? sanitizeExternalHttpUrl(rawBlog.startsWith('http') ? rawBlog : `https://${rawBlog}`)
        : null;
      const publicEmail = isValidPublicEmailSyntax(u?.email) ? String(u.email).trim().toLowerCase() : undefined;
      const bio = String(u?.bio || '').trim();
      const company = String(u?.company || '').replace(/^@/, '').trim() || displayName;
      const isOrg = String(u?.type || '').toLowerCase() === 'organization';

      // Only save GitHub public profiles that actually publish a website or public email
      if (!normalizedBlog && !publicEmail) continue;

      const countryName = slot.countries[0]?.name || 'International';
      const isFounderOrOwner = /\b(founder|ceo|owner|director|cto|co-founder|entrepreneur|agency)\b/i.test(
        `${bio} ${company}`
      );
      const isFinance = /\b(bank|finance|fintech|accounting|payment|wealth|invest)\b/i.test(`${bio} ${company}`);
      const isMentor = /\b(mentor|advisor|coach|community|open source)\b/i.test(bio);

      candidates.push({
        entityType: isOrg ? 'organization' : 'individual',
        fullName: displayName,
        companyName: company,
        positionOrRole:
          bio.slice(0, 95) ||
          (isOrg ? 'Technology / Business Organization' : 'Founder / Technology Professional'),
        industry: isFinance ? 'Fintech & Financial Technology' : 'Technology, Web & Digital Business',
        organizationSize: isOrg ? 'small_business' : 'solo_founder',
        country: countryName,
        city: String(u?.location || loc).slice(0, 60),
        region: slot.region,
        officialWebsite: normalizedBlog || undefined,
        publicEmail,
        sourceUrl: sanitizeExternalHttpUrl(u?.html_url) || `https://github.com/${login}`,
        sourceName: 'GitHub Public Profiles API',
        sourceId: 'github_public_founders',
        sponsorshipTier: isMentor ? 'mentorship_networking' : 'unknown_sponsorship',
        sponsorshipEvidenceNote: isMentor
          ? 'Public technology leader/mentor profile; suitable for networking, mentorship, or web collaboration.'
          : 'Public founder/organization profile; visa sponsorship policy is unknown.',
        mentorshipAvailable: isMentor,
        websiteDevProspect: true,
        internationalRecruiterSignal: false,
        category: isFinance
          ? 'finance_professionals'
          : isMentor
          ? 'mentors'
          : isFounderOrOwner
          ? 'entrepreneurs'
          : 'website_development_clients',
        tags: ['Public Profile', isFounderOrOwner ? 'Founder/Leader' : 'Tech', loc],
      });
    }
  } catch (err: any) {
    errors.push(`GitHub Public API parse error: ${err?.message || 'unknown error'}`);
  }

  return { candidates, errors };
}

export function computeRealDatabaseStats(ws: GlobalReachWorkspace): GlobalReachDatabaseStats {
  const nowMs = Date.now();
  const oneHourAgoMs = nowMs - HOURLY_INTERVAL_MS;
  const contacts = ws.contacts;

  const newContactsThisHour = contacts.filter((c) => {
    const t = Date.parse(c.discoveredAt);
    return !Number.isNaN(t) && t >= oneHourAgoMs;
  }).length;

  const uniqueCompanies = new Set(
    contacts.map((c) => (c.companyName || '').trim().toLowerCase()).filter(Boolean)
  ).size;

  const verifiedContactsFound = contacts.filter(
    (c) =>
      c.verificationStatus === 'verified_organization' ||
      c.verificationStatus === 'verified_public_professional_contact'
  ).length;

  const potentialEmployersFound = contacts.filter(
    (c) =>
      c.category === 'potential_employers' ||
      c.category === 'banking_executives' ||
      c.category === 'international_recruitment_professionals' ||
      c.internationalRecruiterSignal
  ).length;

  const potentialMentorsFound = contacts.filter(
    (c) => c.mentorshipAvailable || c.category === 'mentors'
  ).length;

  const contactsWithPublicEmail = contacts.filter((c) => Boolean(c.publicEmail)).length;
  const contactsWithPublicWhatsApp = contacts.filter(
    (c) => Boolean(c.whatsAppBusinessUrl || c.whatsAppBusinessNumber)
  ).length;
  const contactsWithLinkedIn = contacts.filter((c) => Boolean(c.linkedInUrl)).length;
  const contactsWithInstagram = contacts.filter((c) => Boolean(c.instagramUrl)).length;

  const potentialSponsorshipOpportunities = contacts.filter(
    (c) =>
      c.sponsorshipTier === 'confirmed_sponsorship' ||
      c.sponsorshipTier === 'previous_sponsorship_evidence' ||
      c.sponsorshipTier === 'international_recruiter'
  ).length;

  const websiteDevelopmentProspects = contacts.filter(
    (c) => c.websiteDevProspect || c.category === 'website_development_clients'
  ).length;

  const outreachSentCount = contacts.reduce(
    (sum, c) => sum + (Array.isArray(c.outreachHistory) ? c.outreachHistory.length : 0),
    0
  );

  const upcomingFollowUpsCount = contacts.filter((c) => Boolean(c.nextFollowUpDate)).length;

  return {
    automationStatus: ws.scheduler.status,
    lastSuccessfulSearchAt: ws.scheduler.lastSuccessfulRunAt,
    lastSuccessfulSearchEat: ws.scheduler.lastSuccessfulRunEat,
    nextScheduledSearchAt: ws.scheduler.nextScheduledRunAt,
    nextScheduledSearchEat: ws.scheduler.nextScheduledRunEat,
    totalSearchCyclesCompleted: ws.scheduler.totalCyclesCompleted,
    newContactsThisHour,
    totalContacts: contacts.length,
    newCompaniesDiscovered: uniqueCompanies,
    verifiedContactsFound,
    potentialEmployersFound,
    potentialMentorsFound,
    contactsWithPublicEmail,
    contactsWithPublicWhatsApp,
    contactsWithLinkedIn,
    contactsWithInstagram,
    potentialSponsorshipOpportunities,
    websiteDevelopmentProspects,
    searchFailures: ws.scheduler.totalCyclesFailed,
    apiErrors: ws.apiErrorCount,
    outreachSentCount,
    upcomingFollowUpsCount,
  };
}

export function registerGlobalReachRoutes(deps: RegisterGlobalReachDeps) {
  const {
    app,
    runtimeBaseDir,
    isVercel,
    ensureRuntimeDataDir,
    loadJsonFileSafe,
    writeJsonFileAtomic,
    isPersistentOwnerRequest,
    getRequesterUid,
    getRequesterEmail,
    appendAuditLog,
    pushAdminNotification,
    getAiClient,
  } = deps;

  const dbPath = path.join(runtimeBaseDir, 'data', 'global_reach_db.json');
  const backupPath = `${dbPath}.bak`;

  function loadDb(): GlobalReachDatabase {
    ensureRuntimeDataDir();
    let loaded: GlobalReachDatabase | null = null;
    try {
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.workspaces) {
          loaded = parsed as GlobalReachDatabase;
        }
      }
    } catch {
      // Attempt automatic backup recovery
      try {
        if (fs.existsSync(backupPath)) {
          const bakRaw = fs.readFileSync(backupPath, 'utf8');
          const bakParsed = JSON.parse(bakRaw);
          if (bakParsed && typeof bakParsed === 'object' && bakParsed.workspaces) {
            loaded = bakParsed as GlobalReachDatabase;
          }
        }
      } catch {
        // Fallback below
      }
    }

    if (!loaded) {
      loaded = loadJsonFileSafe<GlobalReachDatabase>(dbPath, {
        version: 1,
        updatedAt: new Date().toISOString(),
        workspaces: {},
      });
    }

    if (!loaded.workspaces) loaded.workspaces = {};
    if (!loaded.workspaces[OWNER_WORKSPACE_ID]) {
      loaded.workspaces[OWNER_WORKSPACE_ID] = createWorkspace(
        OWNER_WORKSPACE_ID,
        true,
        'yeabsra45@gmail.com'
      );
    }

    // Refresh live env-dependent source status labels without losing counts
    for (const ws of Object.values(loaded.workspaces)) {
      const freshSources = createInitialSources();
      const existingMap = new Map((ws.sources || []).map((s) => [s.id, s]));
      ws.sources = freshSources.map((fsItem) => {
        const prev = existingMap.get(fsItem.id);
        return prev
          ? {
              ...fsItem,
              lastRunAt: prev.lastRunAt,
              lastError: prev.lastError,
              contactsDiscoveredTotal: prev.contactsDiscoveredTotal || 0,
            }
          : fsItem;
      });
      if (!ws.scheduler) ws.scheduler = createInitialSchedulerState();
      if (!Array.isArray(ws.contacts)) ws.contacts = [];
      if (!Array.isArray(ws.notifications)) ws.notifications = [];
      if (!Array.isArray(ws.suppressionList)) ws.suppressionList = [];
      if (!Array.isArray(ws.recentCycles)) ws.recentCycles = [];
    }

    return loaded;
  }

  function saveDb(db: GlobalReachDatabase) {
    ensureRuntimeDataDir();
    db.updatedAt = new Date().toISOString();
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }
    } catch {
      // non-fatal backup copy error
    }
    writeJsonFileAtomic(dbPath, db);
  }

  /**
   * Resolves the authenticated caller's strictly isolated workspace.
   * Owner -> owner_yeabsra (with Yeabsra Tefera's private profile).
   * Registered user -> user_<uid> (isolated blank/custom profile, NEVER Yeabsra's data).
   * Unauthenticated -> null (401 Unauthorized).
   */
  function resolveAuthenticatedWorkspace(req: Request): {
    workspaceId: string;
    isOwner: boolean;
    actorEmail: string;
  } | null {
    if (isPersistentOwnerRequest(req)) {
      return {
        workspaceId: OWNER_WORKSPACE_ID,
        isOwner: true,
        actorEmail: getRequesterEmail(req) || 'yeabsra45@gmail.com',
      };
    }
    const uid = (getRequesterUid(req) || '').trim();
    const email = (getRequesterEmail(req) || '').trim().toLowerCase();
    if (!uid && !email) {
      return null;
    }
    const safeKey = (uid || email).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    if (!safeKey) return null;
    return {
      workspaceId: `user_${safeKey}`,
      isOwner: false,
      actorEmail: email || uid,
    };
  }

  function getOrCreateWorkspace(
    db: GlobalReachDatabase,
    identity: { workspaceId: string; isOwner: boolean; actorEmail: string }
  ): GlobalReachWorkspace {
    if (!db.workspaces[identity.workspaceId]) {
      db.workspaces[identity.workspaceId] = createWorkspace(
        identity.workspaceId,
        identity.isOwner,
        identity.actorEmail
      );
      saveDb(db);
    }
    return db.workspaces[identity.workspaceId];
  }

  function pushWorkspaceNotification(
    ws: GlobalReachWorkspace,
    notif: Omit<GlobalReachNotification, 'id' | 'createdAt' | 'read'>
  ) {
    const entry: GlobalReachNotification = {
      id: `grn_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notif,
    };
    ws.notifications.unshift(entry);
    if (ws.notifications.length > MAX_NOTIFICATIONS) {
      ws.notifications = ws.notifications.slice(0, MAX_NOTIFICATIONS);
    }
    if (ws.isOwnerWorkspace && pushAdminNotification) {
      pushAdminNotification({
        type: `global_reach_${notif.type}`,
        title: `Global Reach: ${notif.title}`,
        message: notif.message,
        severity:
          notif.type === 'search_failure' || notif.type === 'automation_stopped'
            ? 'warning'
            : 'info',
      });
    }
  }

  function isSuppressed(ws: GlobalReachWorkspace, email?: string, website?: string): boolean {
    const cleanEmail = (email || '').trim().toLowerCase();
    const dom = extractDomainFromEmail(cleanEmail) || extractDomainFromUrl(website);
    return ws.suppressionList.some((s) => {
      if (s.email && cleanEmail && s.email.toLowerCase() === cleanEmail) return true;
      if (s.domain && dom && s.domain.toLowerCase() === dom) return true;
      return false;
    });
  }

  async function runDiscoveryCycleForWorkspace(
    workspaceId: string,
    options: {
      trigger: GlobalReachCycleLog['trigger'];
      countryFilter?: string;
      regionFilter?: GlobalReachRegion;
      customQuery?: string;
    }
  ): Promise<{ cycleLog: GlobalReachCycleLog; newContacts: GlobalReachContact[] }> {
    const db = loadDb();
    const ws = db.workspaces[workspaceId];
    if (!ws) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    const nowIso = new Date().toISOString();

    // Respect pause / disable for automated triggers
    if (
      options.trigger !== 'manual' &&
      (!ws.scheduler.enabled || ws.scheduler.paused)
    ) {
      const skipped: GlobalReachCycleLog = {
        id: `grc_${Date.now()}`,
        trigger: options.trigger,
        startedAt: nowIso,
        finishedAt: nowIso,
        durationMs: 0,
        status: 'skipped_paused',
        regionScanned: ws.scheduler.lastRegionScanned || 'Europe',
        countriesScanned: [],
        sourcesChecked: 0,
        newContactsAdded: 0,
        duplicatesPrevented: 0,
        verifiedCount: 0,
        errors: [],
      };
      return { cycleLog: skipped, newContacts: [] };
    }

    // Overlap lock with stale-lock crash recovery
    if (ws.scheduler.isRunningNow) {
      const lockMs = ws.scheduler.lockAcquiredAt ? Date.parse(ws.scheduler.lockAcquiredAt) : 0;
      if (!Number.isNaN(lockMs) && Date.now() - lockMs < STALE_LOCK_MS) {
        const skipped: GlobalReachCycleLog = {
          id: `grc_${Date.now()}`,
          trigger: options.trigger,
          startedAt: nowIso,
          finishedAt: nowIso,
          durationMs: 0,
          status: 'skipped_locked',
          regionScanned: ws.scheduler.lastRegionScanned || 'Europe',
          countriesScanned: [],
          sourcesChecked: 0,
          newContactsAdded: 0,
          duplicatesPrevented: 0,
          verifiedCount: 0,
          errors: ['Previous discovery cycle still in progress (overlap lock active).'],
        };
        return { cycleLog: skipped, newContacts: [] };
      }
      ws.scheduler.recoveryNotes = `Recovered stale lock from ${ws.scheduler.lockAcquiredAt} at ${nowIso}.`;
    }

    const startMs = Date.now();
    ws.scheduler.isRunningNow = true;
    ws.scheduler.lockAcquiredAt = nowIso;
    ws.scheduler.lastAttemptAt = nowIso;
    ws.scheduler.status = 'running';
    saveDb(db);

    // Choose rotating slot across the 7 global regions
    let slot = GLOBAL_ROTATION_SLOTS[ws.scheduler.checkpointIndex % GLOBAL_ROTATION_SLOTS.length];
    if (options.regionFilter) {
      const matchedSlot = GLOBAL_ROTATION_SLOTS.find((s) => s.region === options.regionFilter);
      if (matchedSlot) slot = matchedSlot;
    }

    const cycleErrors: string[] = [];
    const newContacts: GlobalReachContact[] = [];
    let duplicatesPrevented = 0;
    let verifiedCount = 0;
    let sourcesChecked = 0;

    try {
      const [officialRes, reliefRes, gleifRes, githubRes] = await Promise.all([
        discoverFromOfficialSeeds(slot, options.countryFilter, 3),
        discoverFromReliefWebApi(slot, ws.scheduler.checkpointIndex),
        discoverFromGleifApi(slot, ws.scheduler.checkpointIndex),
        discoverFromGitHubPublicProfiles(slot, ws.scheduler.checkpointIndex, options.customQuery),
      ]);

      sourcesChecked = 4;
      const sourceResults: Array<{
        id: string;
        candidates: RawDiscoveredCandidate[];
        errors: string[];
      }> = [
        { id: 'official_org_websites', ...officialRes },
        { id: 'reliefweb_public_api', ...reliefRes },
        { id: 'gleif_lei_registry', ...gleifRes },
        { id: 'github_public_founders', ...githubRes },
      ];

      const allCandidates: RawDiscoveredCandidate[] = [];
      for (const sr of sourceResults) {
        const srcRec = ws.sources.find((s) => s.id === sr.id);
        if (srcRec) {
          srcRec.lastRunAt = new Date().toISOString();
          if (sr.errors.length > 0) {
            srcRec.lastError = sr.errors[0];
          } else {
            srcRec.lastError = undefined;
          }
        }
        if (sr.errors.length > 0) {
          cycleErrors.push(...sr.errors);
          ws.apiErrorCount += sr.errors.length;
        }
        allCandidates.push(...sr.candidates);
      }

      const existingDedupKeys = new Set(ws.contacts.map((c) => c.dedupKey));

      // Verify and persist unique candidates (cap per cycle for responsive hourly runs)
      for (const raw of allCandidates.slice(0, 10)) {
        if (
          options.countryFilter &&
          !raw.country.toLowerCase().includes(options.countryFilter.toLowerCase())
        ) {
          continue;
        }

        const provisionalKey = buildCanonicalDedupKey({
          publicEmail: raw.publicEmail,
          linkedInUrl: raw.linkedInUrl,
          whatsAppBusinessNumber: raw.whatsAppBusinessNumber,
          officialWebsite: raw.officialWebsite,
          fullName: raw.fullName,
          companyName: raw.companyName,
        });

        if (existingDedupKeys.has(provisionalKey)) {
          duplicatesPrevented += 1;
          continue;
        }

        const discoveredIso = new Date().toISOString();
        let contact: GlobalReachContact = {
          id: `grc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          ownerUserId: workspaceId,
          entityType: raw.entityType,
          fullName: raw.fullName,
          companyName: raw.companyName,
          positionOrRole: raw.positionOrRole,
          industry: raw.industry,
          organizationSize: raw.organizationSize,
          country: raw.country,
          city: raw.city,
          region: raw.region,
          officialWebsite: raw.officialWebsite,
          publicEmail: raw.publicEmail,
          publicBusinessPhone: raw.publicBusinessPhone,
          whatsAppBusinessNumber: raw.whatsAppBusinessNumber,
          whatsAppBusinessUrl: raw.whatsAppBusinessUrl,
          linkedInUrl: raw.linkedInUrl,
          instagramUrl: raw.instagramUrl,
          contactPageUrl: raw.contactPageUrl,
          sourceUrl: raw.sourceUrl,
          sourceName: raw.sourceName,
          discoveredAt: discoveredIso,
          verificationStatus: raw.officialWebsite
            ? 'public_contact_unverified'
            : raw.sourceId === 'gleif_lei_registry'
            ? 'verified_organization'
            : 'unverified_contact',
          verificationNotes:
            raw.sourceId === 'gleif_lei_registry'
              ? 'Active registered legal entity confirmed via GLEIF Global LEI public registry.'
              : 'Discovered from public source; pending live website verification.',
          emailMatchesOfficialDomain: false,
          sponsorshipTier: raw.sponsorshipTier,
          sponsorshipEvidenceNote: raw.sponsorshipEvidenceNote,
          mentorshipAvailable: raw.mentorshipAvailable,
          websiteDevProspect: raw.websiteDevProspect,
          internationalRecruiterSignal: raw.internationalRecruiterSignal,
          category: raw.category,
          relevanceScore: 50,
          relevanceReasons: [],
          isImportant: false,
          isSavedByUser: false,
          personalNotes: '',
          outreachHistory: [],
          tags: raw.tags,
          dedupKey: provisionalKey,
          updatedAt: discoveredIso,
        };

        // Live SSRF-guarded verification when official website is available
        if (contact.officialWebsite) {
          const verification = await verifyLiveContact(contact);
          contact = {
            ...contact,
            ...verification.enrichedFields,
            verificationStatus: verification.verificationStatus,
            verificationNotes: verification.verificationNotes,
            httpStatus: verification.httpStatus,
            emailMatchesOfficialDomain: verification.emailMatchesOfficialDomain,
            lastVerifiedAt: verification.lastVerifiedAt,
          };
          contact.dedupKey = buildCanonicalDedupKey(contact);
        } else if (raw.sourceId === 'gleif_lei_registry') {
          contact.lastVerifiedAt = discoveredIso;
        }

        // Re-check canonical dedup key after live email/LinkedIn extraction
        if (existingDedupKeys.has(contact.dedupKey)) {
          duplicatesPrevented += 1;
          continue;
        }

        // Skip invalid/broken contacts automatically unless explicitly from GLEIF active registry
        if (contact.verificationStatus === 'invalid_or_outdated_contact') {
          continue;
        }

        // Skip suppressed domains/emails
        if (isSuppressed(ws, contact.publicEmail, contact.officialWebsite)) {
          continue;
        }

        const scored = scoreGlobalReachContact(contact, ws.profile);
        contact.relevanceScore = scored.score;
        contact.relevanceReasons = scored.reasons;

        existingDedupKeys.add(contact.dedupKey);
        ws.contacts.unshift(contact);
        newContacts.push(contact);

        if (
          contact.verificationStatus === 'verified_organization' ||
          contact.verificationStatus === 'verified_public_professional_contact'
        ) {
          verifiedCount += 1;
        }

        const srcRec = ws.sources.find((s) => s.id === raw.sourceId);
        if (srcRec) {
          srcRec.contactsDiscoveredTotal = (srcRec.contactsDiscoveredTotal || 0) + 1;
        }

        // Targeted notifications for high-value discoveries
        if (contact.sponsorshipTier === 'confirmed_sponsorship' || contact.sponsorshipTier === 'previous_sponsorship_evidence') {
          pushWorkspaceNotification(ws, {
            type: 'sponsorship_evidence',
            title: `Sponsorship signal: ${contact.companyName}`,
            message: `${contact.companyName} (${contact.country}) shows sponsorship evidence — score ${contact.relevanceScore}/100.`,
            contactId: contact.id,
          });
        } else if (contact.relevanceScore >= 75) {
          const isBanking = /bank|finance|microfinance|fintech|accounting/i.test(contact.industry);
          pushWorkspaceNotification(ws, {
            type: isBanking
              ? 'banking_finance_opportunity'
              : contact.mentorshipAvailable
              ? 'mentor_found'
              : contact.websiteDevProspect
              ? 'web_dev_prospect'
              : 'high_relevance_contact',
            title: `High-relevance contact (${contact.relevanceScore}/100): ${contact.fullName}`,
            message: `Discovered in ${contact.country} via ${contact.sourceName}. ${contact.relevanceReasons[0] || ''}`,
            contactId: contact.id,
          });
        }
      }

      if (ws.contacts.length > MAX_CONTACTS_PER_WORKSPACE) {
        // Keep user-saved and important contacts first when trimming
        ws.contacts.sort((a, b) => {
          const pinA = a.isImportant || a.isSavedByUser ? 1 : 0;
          const pinB = b.isImportant || b.isSavedByUser ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          return Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt);
        });
        ws.contacts = ws.contacts.slice(0, MAX_CONTACTS_PER_WORKSPACE);
      }

      const finishedIso = new Date().toISOString();
      const nextScheduledIso = new Date(Date.now() + HOURLY_INTERVAL_MS).toISOString();
      ws.scheduler.checkpointIndex = (ws.scheduler.checkpointIndex + 1) % GLOBAL_ROTATION_SLOTS.length;
      ws.scheduler.lastRegionScanned = slot.region;
      ws.scheduler.lastSuccessfulRunAt = finishedIso;
      ws.scheduler.lastSuccessfulRunEat = formatEatTimestamp(finishedIso);
      ws.scheduler.nextScheduledRunAt = ws.scheduler.enabled && !ws.scheduler.paused ? nextScheduledIso : null;
      ws.scheduler.nextScheduledRunEat = ws.scheduler.nextScheduledRunAt
        ? formatEatTimestamp(ws.scheduler.nextScheduledRunAt)
        : null;
      ws.scheduler.totalCyclesCompleted += 1;
      ws.scheduler.consecutiveFailures = 0;
      ws.scheduler.lastError = cycleErrors.length > 0 ? cycleErrors[0] : null;
      ws.scheduler.isRunningNow = false;
      ws.scheduler.lockAcquiredAt = null;
      ws.scheduler.status = !ws.scheduler.enabled
        ? 'disabled'
        : ws.scheduler.paused
        ? 'paused'
        : 'active_waiting';

      const cycleLog: GlobalReachCycleLog = {
        id: `grc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        trigger: options.trigger,
        startedAt: nowIso,
        finishedAt: finishedIso,
        durationMs: Date.now() - startMs,
        status: cycleErrors.length > 0 && newContacts.length === 0 ? 'partial' : 'completed',
        regionScanned: slot.region,
        countriesScanned: slot.countries.map((c) => c.name),
        sourcesChecked,
        newContactsAdded: newContacts.length,
        duplicatesPrevented,
        verifiedCount,
        errors: cycleErrors.slice(0, 8),
      };

      ws.recentCycles.unshift(cycleLog);
      if (ws.recentCycles.length > MAX_CYCLES_HISTORY) {
        ws.recentCycles = ws.recentCycles.slice(0, MAX_CYCLES_HISTORY);
      }

      saveDb(db);
      return { cycleLog, newContacts };
    } catch (err: any) {
      const finishedIso = new Date().toISOString();
      const errMsg = String(err?.message || 'Unexpected discovery cycle failure');
      ws.scheduler.isRunningNow = false;
      ws.scheduler.lockAcquiredAt = null;
      ws.scheduler.totalCyclesFailed += 1;
      ws.scheduler.consecutiveFailures += 1;
      ws.scheduler.lastError = errMsg;
      ws.scheduler.status = 'error';
      ws.apiErrorCount += 1;

      pushWorkspaceNotification(ws, {
        type: 'search_failure',
        title: 'Hourly Global Reach search cycle failed',
        message: `Discovery cycle encountered an error: ${errMsg}. Automatic retry scheduled on next cycle.`,
      });

      const cycleLog: GlobalReachCycleLog = {
        id: `grc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        trigger: options.trigger,
        startedAt: nowIso,
        finishedAt: finishedIso,
        durationMs: Date.now() - startMs,
        status: 'failed',
        regionScanned: slot.region,
        countriesScanned: slot.countries.map((c) => c.name),
        sourcesChecked,
        newContactsAdded: 0,
        duplicatesPrevented: 0,
        verifiedCount: 0,
        errors: [errMsg],
      };

      ws.recentCycles.unshift(cycleLog);
      if (ws.recentCycles.length > MAX_CYCLES_HISTORY) {
        ws.recentCycles = ws.recentCycles.slice(0, MAX_CYCLES_HISTORY);
      }

      saveDb(db);
      return { cycleLog, newContacts: [] };
    }
  }

  // ==================== REST API ENDPOINTS ====================

  app.get('/api/global-reach/dashboard', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required to access Global Reach.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);

    // Optional filtering on query params
    const qSearch = String(req.query.search || '').trim().toLowerCase();
    const qCountry = String(req.query.country || 'all').trim();
    const qRegion = String(req.query.region || 'all').trim();
    const qIndustry = String(req.query.industry || 'all').trim();
    const qEntityType = String(req.query.entityType || 'all').trim();
    const qCategory = String(req.query.category || 'all').trim();
    const qChannel = String(req.query.channel || 'all').trim();
    const qVerification = String(req.query.verificationStatus || 'all').trim();
    const qSponsorship = String(req.query.sponsorshipTier || 'all').trim();
    const qImportantOnly = req.query.importantOnly === 'true';

    const filteredContacts = ws.contacts.filter((c) => {
      if (qCountry !== 'all' && c.country.toLowerCase() !== qCountry.toLowerCase()) return false;
      if (qRegion !== 'all' && c.region !== qRegion) return false;
      if (qIndustry !== 'all' && c.industry.toLowerCase() !== qIndustry.toLowerCase()) return false;
      if (qEntityType !== 'all' && c.entityType !== qEntityType) return false;
      if (qCategory !== 'all' && c.category !== qCategory) return false;
      if (qVerification !== 'all' && c.verificationStatus !== qVerification) return false;
      if (qSponsorship !== 'all' && c.sponsorshipTier !== qSponsorship) return false;
      if (qImportantOnly && !c.isImportant) return false;
      if (qChannel !== 'all') {
        if (qChannel === 'gmail' && !c.publicEmail) return false;
        if (qChannel === 'whatsapp' && !(c.whatsAppBusinessUrl || c.whatsAppBusinessNumber)) return false;
        if (qChannel === 'linkedin' && !c.linkedInUrl) return false;
        if (qChannel === 'instagram' && !c.instagramUrl) return false;
        if (qChannel === 'contact_page' && !c.contactPageUrl) return false;
        if (qChannel === 'phone' && !c.publicBusinessPhone) return false;
      }
      if (qSearch) {
        const hay = [
          c.fullName,
          c.companyName,
          c.positionOrRole,
          c.industry,
          c.country,
          c.city,
          c.publicEmail,
          c.personalNotes,
          ...(c.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(qSearch)) return false;
      }
      return true;
    });

    const availableCountries = Array.from(new Set(ws.contacts.map((c) => c.country).filter(Boolean))).sort();
    const availableIndustries = Array.from(new Set(ws.contacts.map((c) => c.industry).filter(Boolean))).sort();

    const payload: GlobalReachDashboardResponse = {
      success: true,
      workspaceId: ws.workspaceId,
      isOwnerWorkspace: ws.isOwnerWorkspace,
      profile: ws.profile,
      contacts: filteredContacts,
      stats: computeRealDatabaseStats(ws),
      scheduler: ws.scheduler,
      sources: ws.sources,
      recentCycles: ws.recentCycles.slice(0, 25),
      notifications: ws.notifications.slice(0, 40),
      unreadNotificationsCount: ws.notifications.filter((n) => !n.read).length,
      suppressionList: ws.suppressionList,
      availableCountries,
      availableIndustries,
      aiProviderConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    };

    return res.json(payload);
  });

  app.put('/api/global-reach/profile', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const body = req.body || {};

    const cleanArray = (val: unknown, max = 20): string[] =>
      Array.isArray(val)
        ? val
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .slice(0, max)
        : [];

    ws.profile = {
      ...ws.profile,
      fullName: typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 120) : ws.profile.fullName,
      nationality: typeof body.nationality === 'string' ? body.nationality.trim().slice(0, 80) : ws.profile.nationality,
      currentCountry: typeof body.currentCountry === 'string' ? body.currentCountry.trim().slice(0, 80) : ws.profile.currentCountry,
      email: typeof body.email === 'string' ? body.email.trim().slice(0, 140) : ws.profile.email,
      educationDegree: typeof body.educationDegree === 'string' ? body.educationDegree.trim().slice(0, 140) : ws.profile.educationDegree,
      educationInstitution: typeof body.educationInstitution === 'string' ? body.educationInstitution.trim().slice(0, 140) : ws.profile.educationInstitution,
      graduationYear: typeof body.graduationYear === 'string' ? body.graduationYear.trim().slice(0, 10) : ws.profile.graduationYear,
      totalExperienceYears:
        typeof body.totalExperienceYears === 'number' && Number.isFinite(body.totalExperienceYears)
          ? Math.max(0, Math.min(60, Math.round(body.totalExperienceYears)))
          : ws.profile.totalExperienceYears,
      managementExperienceYears:
        typeof body.managementExperienceYears === 'number' && Number.isFinite(body.managementExperienceYears)
          ? Math.max(0, Math.min(50, Math.round(body.managementExperienceYears)))
          : ws.profile.managementExperienceYears,
      currentOrRecentRole:
        typeof body.currentOrRecentRole === 'string'
          ? body.currentOrRecentRole.trim().slice(0, 120)
          : ws.profile.currentOrRecentRole,
      coreExperienceAreas: Array.isArray(body.coreExperienceAreas)
        ? cleanArray(body.coreExperienceAreas, 25)
        : ws.profile.coreExperienceAreas,
      additionalCapabilities: Array.isArray(body.additionalCapabilities)
        ? cleanArray(body.additionalCapabilities, 20)
        : ws.profile.additionalCapabilities,
      primaryObjectives: Array.isArray(body.primaryObjectives)
        ? cleanArray(body.primaryObjectives, 15)
        : ws.profile.primaryObjectives,
      personalStorySummary:
        typeof body.personalStorySummary === 'string'
          ? body.personalStorySummary.trim().slice(0, 1200)
          : ws.profile.personalStorySummary,
      targetRegions: Array.isArray(body.targetRegions)
        ? (cleanArray(body.targetRegions, 7) as GlobalReachRegion[])
        : ws.profile.targetRegions,
      targetIndustries: Array.isArray(body.targetIndustries)
        ? cleanArray(body.targetIndustries, 20)
        : ws.profile.targetIndustries,
      updatedAt: new Date().toISOString(),
    };

    // Re-score user's contacts against updated profile
    for (const c of ws.contacts) {
      const scored = scoreGlobalReachContact(c, ws.profile);
      c.relevanceScore = scored.score;
      c.relevanceReasons = scored.reasons;
    }

    saveDb(db);
    return res.json({ success: true, profile: ws.profile });
  });

  app.post('/api/global-reach/discover-now', async (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    getOrCreateWorkspace(db, identity);

    const countryFilter = typeof req.body?.country === 'string' ? req.body.country.trim().slice(0, 80) : undefined;
    const regionFilter = typeof req.body?.region === 'string' && req.body.region !== 'all'
      ? (req.body.region.trim() as GlobalReachRegion)
      : undefined;
    const customQuery = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 80) : undefined;

    const result = await runDiscoveryCycleForWorkspace(identity.workspaceId, {
      trigger: 'manual',
      countryFilter: countryFilter || undefined,
      regionFilter,
      customQuery: customQuery || undefined,
    });

    const refreshed = loadDb().workspaces[identity.workspaceId];
    appendAuditLog({
      actorEmail: identity.actorEmail,
      action: 'global_reach_manual_discovery',
      targetType: 'global_reach',
      summary: `Added ${result.cycleLog.newContactsAdded} contacts, prevented ${result.cycleLog.duplicatesPrevented} duplicates (${result.cycleLog.regionScanned}).`,
    });

    return res.json({
      success: true,
      cycleLog: result.cycleLog,
      newContacts: result.newContacts,
      stats: computeRealDatabaseStats(refreshed),
      scheduler: refreshed.scheduler,
    });
  });

  app.post('/api/global-reach/contacts', async (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const body = req.body || {};

    const fullName = String(body.fullName || '').trim().slice(0, 140);
    const companyName = String(body.companyName || fullName).trim().slice(0, 160);
    if (!fullName) {
      return res.status(400).json({ success: false, error: 'Contact name or organization name is required.' });
    }

    const officialWebsite = sanitizeExternalHttpUrl(body.officialWebsite) || undefined;
    const publicEmail = isValidPublicEmailSyntax(body.publicEmail)
      ? String(body.publicEmail).trim().toLowerCase()
      : undefined;
    const linkedInUrl = inspectLinkedInUrl(body.linkedInUrl).validUrl || undefined;
    const instagramUrl = inspectInstagramUrl(body.instagramUrl).validUrl || undefined;
    const waDigits = normalizePublishedWhatsAppDigits(body.whatsAppBusinessNumber || body.whatsAppBusinessUrl);
    const whatsAppBusinessNumber = waDigits ? `+${waDigits}` : undefined;
    const whatsAppBusinessUrl = whatsAppBusinessNumber
      ? buildWhatsAppChatUrl(whatsAppBusinessNumber) || undefined
      : undefined;

    const dedupKey = buildCanonicalDedupKey({
      publicEmail,
      linkedInUrl,
      whatsAppBusinessNumber,
      officialWebsite,
      fullName,
      companyName,
    });

    if (ws.contacts.some((c) => c.dedupKey === dedupKey)) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate contact already exists in your Global Reach directory.',
      });
    }

    const nowIso = new Date().toISOString();
    const country = String(body.country || 'International').trim().slice(0, 80);
    const contact: GlobalReachContact = {
      id: `grc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      ownerUserId: identity.workspaceId,
      entityType: body.entityType === 'individual' ? 'individual' : 'organization',
      fullName,
      companyName,
      positionOrRole: String(body.positionOrRole || 'Professional Contact').trim().slice(0, 120),
      industry: String(body.industry || 'General Business').trim().slice(0, 100),
      organizationSize: (body.organizationSize || 'unknown') as GlobalReachOrgSize,
      country,
      city: typeof body.city === 'string' ? body.city.trim().slice(0, 80) : undefined,
      region: (body.region as GlobalReachRegion) || inferRegionFromCountry(country),
      officialWebsite,
      publicEmail,
      publicBusinessPhone: typeof body.publicBusinessPhone === 'string' ? body.publicBusinessPhone.trim().slice(0, 40) : undefined,
      whatsAppBusinessNumber,
      whatsAppBusinessUrl,
      linkedInUrl,
      instagramUrl,
      contactPageUrl: sanitizeExternalHttpUrl(body.contactPageUrl) || undefined,
      sourceUrl: sanitizeExternalHttpUrl(body.sourceUrl) || officialWebsite || 'https://www.hopelandjobs.tech',
      sourceName: String(body.sourceName || 'Manual User Entry').trim().slice(0, 100),
      discoveredAt: nowIso,
      verificationStatus: 'unverified_contact',
      verificationNotes: 'Manually added by user; run live verification to confirm official website/domain.',
      emailMatchesOfficialDomain: Boolean(
        publicEmail && officialWebsite && extractDomainFromEmail(publicEmail) === extractDomainFromUrl(officialWebsite)
      ),
      sponsorshipTier: (body.sponsorshipTier || 'unknown_sponsorship') as GlobalReachSponsorshipTier,
      sponsorshipEvidenceNote: String(body.sponsorshipEvidenceNote || 'Sponsorship policy not independently verified.').slice(0, 240),
      mentorshipAvailable: Boolean(body.mentorshipAvailable),
      websiteDevProspect: Boolean(body.websiteDevProspect),
      internationalRecruiterSignal: Boolean(body.internationalRecruiterSignal),
      category: (body.category || 'other_professional_connections') as GlobalReachContactCategory,
      relevanceScore: 50,
      relevanceReasons: [],
      isImportant: Boolean(body.isImportant),
      isSavedByUser: true,
      personalNotes: String(body.personalNotes || '').trim().slice(0, 2000),
      nextFollowUpDate: typeof body.nextFollowUpDate === 'string' ? body.nextFollowUpDate.trim() || undefined : undefined,
      outreachHistory: [],
      tags: Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 12) : [],
      dedupKey,
      updatedAt: nowIso,
    };

    const scored = scoreGlobalReachContact(contact, ws.profile);
    contact.relevanceScore = scored.score;
    contact.relevanceReasons = scored.reasons;

    ws.contacts.unshift(contact);
    saveDb(db);
    return res.status(201).json({ success: true, contact, stats: computeRealDatabaseStats(ws) });
  });

  app.patch('/api/global-reach/contacts/:id', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const contact = ws.contacts.find((c) => c.id === req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }

    const body = req.body || {};
    if (typeof body.fullName === 'string' && body.fullName.trim()) contact.fullName = body.fullName.trim().slice(0, 140);
    if (typeof body.companyName === 'string' && body.companyName.trim()) contact.companyName = body.companyName.trim().slice(0, 160);
    if (typeof body.positionOrRole === 'string') contact.positionOrRole = body.positionOrRole.trim().slice(0, 120);
    if (typeof body.industry === 'string') contact.industry = body.industry.trim().slice(0, 100);
    if (typeof body.country === 'string' && body.country.trim()) contact.country = body.country.trim().slice(0, 80);
    if (typeof body.city === 'string') contact.city = body.city.trim().slice(0, 80) || undefined;
    if (typeof body.category === 'string') contact.category = body.category as GlobalReachContactCategory;
    if (typeof body.sponsorshipTier === 'string') contact.sponsorshipTier = body.sponsorshipTier as GlobalReachSponsorshipTier;
    if (typeof body.personalNotes === 'string') contact.personalNotes = body.personalNotes.slice(0, 2000);
    if (typeof body.isImportant === 'boolean') contact.isImportant = body.isImportant;
    if (typeof body.isSavedByUser === 'boolean') contact.isSavedByUser = body.isSavedByUser;
    if (typeof body.mentorshipAvailable === 'boolean') contact.mentorshipAvailable = body.mentorshipAvailable;
    if (typeof body.websiteDevProspect === 'boolean') contact.websiteDevProspect = body.websiteDevProspect;
    if (body.nextFollowUpDate === null || body.nextFollowUpDate === '') {
      contact.nextFollowUpDate = undefined;
    } else if (typeof body.nextFollowUpDate === 'string') {
      contact.nextFollowUpDate = body.nextFollowUpDate.trim().slice(0, 40);
    }
    if (typeof body.publicEmail === 'string') {
      contact.publicEmail = isValidPublicEmailSyntax(body.publicEmail)
        ? body.publicEmail.trim().toLowerCase()
        : undefined;
    }
    if (typeof body.linkedInUrl === 'string') {
      contact.linkedInUrl = inspectLinkedInUrl(body.linkedInUrl).validUrl || undefined;
    }
    if (typeof body.instagramUrl === 'string') {
      contact.instagramUrl = inspectInstagramUrl(body.instagramUrl).validUrl || undefined;
    }
    if (typeof body.whatsAppBusinessNumber === 'string') {
      const digits = normalizePublishedWhatsAppDigits(body.whatsAppBusinessNumber);
      contact.whatsAppBusinessNumber = digits ? `+${digits}` : undefined;
      contact.whatsAppBusinessUrl = contact.whatsAppBusinessNumber
        ? buildWhatsAppChatUrl(contact.whatsAppBusinessNumber) || undefined
        : undefined;
    }

    const scored = scoreGlobalReachContact(contact, ws.profile);
    contact.relevanceScore = scored.score;
    contact.relevanceReasons = scored.reasons;
    contact.updatedAt = new Date().toISOString();

    saveDb(db);
    return res.json({ success: true, contact, stats: computeRealDatabaseStats(ws) });
  });

  app.delete('/api/global-reach/contacts/:id', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const before = ws.contacts.length;
    ws.contacts = ws.contacts.filter((c) => c.id !== req.params.id);
    if (ws.contacts.length === before) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }
    saveDb(db);
    return res.json({ success: true, stats: computeRealDatabaseStats(ws) });
  });

  app.post('/api/global-reach/contacts/:id/verify', async (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const idx = ws.contacts.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Contact not found.' });
    }

    const verification = await verifyLiveContact(ws.contacts[idx]);
    const updated: GlobalReachContact = {
      ...ws.contacts[idx],
      ...verification.enrichedFields,
      verificationStatus: verification.verificationStatus,
      verificationNotes: verification.verificationNotes,
      httpStatus: verification.httpStatus,
      emailMatchesOfficialDomain: verification.emailMatchesOfficialDomain,
      lastVerifiedAt: verification.lastVerifiedAt,
      updatedAt: new Date().toISOString(),
    };
    const scored = scoreGlobalReachContact(updated, ws.profile);
    updated.relevanceScore = scored.score;
    updated.relevanceReasons = scored.reasons;
    ws.contacts[idx] = updated;
    saveDb(db);

    return res.json({ success: true, contact: updated, stats: computeRealDatabaseStats(ws) });
  });

  app.post('/api/global-reach/ai/draft', async (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);

    const contactIds: string[] = Array.isArray(req.body?.contactIds)
      ? req.body.contactIds.slice(0, 10).map((v: any) => String(v))
      : req.body?.contactId
      ? [String(req.body.contactId)]
      : [];

    const approach = (req.body?.approach || 'employment_request') as GlobalReachOutreachApproach;
    const mode = req.body?.mode === 'manual_template' ? 'manual_template' : 'ai';

    if (contactIds.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one contactId is required.' });
    }

    const targets = contactIds
      .map((id) => ws.contacts.find((c) => c.id === id))
      .filter((c): c is GlobalReachContact => Boolean(c));

    if (targets.length === 0) {
      return res.status(404).json({ success: false, error: 'Selected contact(s) not found in your workspace.' });
    }

    // Explicit manual template mode requested by user
    if (mode === 'manual_template') {
      const drafts = targets.map((c) => buildEditableOutreachTemplate(c, ws.profile, approach));
      return res.json({ success: true, drafts });
    }

    // Server-side Gemini AI generation (never silently mask Gemini failures)
    const ai = await getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error:
          'GEMINI_API_KEY is not configured on the server. Use "Editable Template" mode or configure GEMINI_API_KEY in server environment variables.',
      });
    }

    const drafts: GlobalReachGeneratedDraft[] = [];
    const approachLabel = GLOBAL_REACH_APPROACH_LABELS[approach] || approach;

    try {
      for (const contact of targets) {
        const prompt = `You are drafting a respectful, concise, natural, human-sounding professional outreach message on behalf of the sender below.

STRICT ETHICS & ACCURACY RULES:
- Represent the sender's REAL background accurately. NEVER invent credentials, degrees, employers, or past work.
- NEVER sound desperate, spammy, robotic, or entitled. NEVER demand money or favors.
- NEVER falsely claim the recipient is wealthy, definitely willing to help, or confirmed to sponsor visas unless explicitly stated in the contact's verified info.
- Tailor specifically to this recipient's industry, country, and role so messages are never identical templates.
- Keep the email body under 210 words, crisp and dignified.

SENDER PROFILE:
- Name: ${ws.profile.fullName || 'Professional Applicant'}
- Nationality / Country: ${ws.profile.nationality || 'International'} / ${ws.profile.currentCountry || 'N/A'}
- Education: ${ws.profile.educationDegree || 'N/A'} (${ws.profile.educationInstitution || ''} ${ws.profile.graduationYear || ''})
- Experience: ${ws.profile.totalExperienceYears} years total, ${ws.profile.managementExperienceYears} years management (${ws.profile.currentOrRecentRole || 'Professional'})
- Core experience: ${ws.profile.coreExperienceAreas.join(', ') || 'Professional services'}
- Additional capabilities: ${ws.profile.additionalCapabilities.join(', ') || 'None specified'}
- Motivation: ${ws.profile.personalStorySummary || 'Seeking legitimate international career growth'}

TARGET RECIPIENT:
- Name: ${contact.fullName}
- Entity type: ${contact.entityType}
- Organization: ${contact.companyName}
- Role/Position: ${contact.positionOrRole}
- Industry: ${contact.industry}
- Location: ${[contact.city, contact.country].filter(Boolean).join(', ')} (${contact.region})
- Sponsorship evidence status: ${contact.sponsorshipTier} (${contact.sponsorshipEvidenceNote})

OUTREACH APPROACH: ${approachLabel}

Return ONLY valid JSON with keys:
{
  "subject": "string (clear professional email subject line, max 110 chars)",
  "message": "string (complete email body with greeting and sign-off using sender name and email)",
  "whatsappShortMessage": "string (concise polite WhatsApp introduction under 350 chars)",
  "linkedInNote": "string (polite LinkedIn connection note strictly under 280 chars)",
  "followUpMessage": "string (polite brief follow-up email 7-10 days later with easy opt-out courtesy)"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.6,
          },
        });

        const rawText = (response.text || '').trim();
        const parsed = JSON.parse(rawText);

        drafts.push({
          contactId: contact.id,
          contactName: contact.fullName,
          companyName: contact.companyName,
          approach,
          subject: String(parsed.subject || `${approachLabel} — ${ws.profile.fullName}`).slice(0, 180),
          message: String(parsed.message || '').trim(),
          whatsappShortMessage: String(parsed.whatsappShortMessage || '').slice(0, 500),
          linkedInNote: String(parsed.linkedInNote || '').slice(0, 295),
          followUpMessage: String(parsed.followUpMessage || '').trim(),
          generatedBy: 'gemini_ai',
          modelUsed: 'gemini-4-hydrogen',
          generatedAt: new Date().toISOString(),
        });
      }

      return res.json({ success: true, drafts });
    } catch (err: any) {
      ws.apiErrorCount += 1;
      saveDb(db);
      return res.status(502).json({
        success: false,
        error: `Gemini AI draft generation failed: ${err?.message || 'Upstream AI service error'}`,
      });
    }
  });

  app.post('/api/global-reach/outreach/log', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);

    const contactIds: string[] = Array.isArray(req.body?.contactIds)
      ? req.body.contactIds.map((v: any) => String(v))
      : req.body?.contactId
      ? [String(req.body.contactId)]
      : [];

    if (contactIds.length === 0) {
      return res.status(400).json({ success: false, error: 'contactIds required.' });
    }

    const nowIso = new Date().toISOString();
    let recordedCount = 0;
    let skippedSuppressedCount = 0;

    for (const id of contactIds) {
      const contact = ws.contacts.find((c) => c.id === id);
      if (!contact) continue;
      if (isSuppressed(ws, contact.publicEmail, contact.officialWebsite)) {
        skippedSuppressedCount += 1;
        continue;
      }

      const logEntry: GlobalReachOutreachLog = {
        id: `grol_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        channel: req.body?.channel || 'gmail',
        approach: req.body?.approach || 'employment_request',
        subject: typeof req.body?.subject === 'string' ? req.body.subject.slice(0, 200) : undefined,
        messagePreview: String(req.body?.messagePreview || '').slice(0, 400),
        recipientAddress: contact.publicEmail || contact.whatsAppBusinessNumber || contact.linkedInUrl,
        mode: req.body?.mode === 'bulk_bcc' ? 'bulk_bcc' : 'single',
        approvedByHuman: true,
        sentAt: nowIso,
        status: 'opened_in_platform',
        notes: typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 300) : undefined,
      };
      contact.outreachHistory.unshift(logEntry);
      if (typeof req.body?.nextFollowUpDate === 'string' && req.body.nextFollowUpDate.trim()) {
        contact.nextFollowUpDate = req.body.nextFollowUpDate.trim().slice(0, 40);
      }
      contact.updatedAt = nowIso;
      recordedCount += 1;
    }

    saveDb(db);
    return res.json({
      success: true,
      recordedCount,
      skippedSuppressedCount,
      stats: computeRealDatabaseStats(ws),
    });
  });

  app.post('/api/global-reach/scheduler/control', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const action = String(req.body?.action || '').toLowerCase();

    if (action === 'pause') {
      ws.scheduler.paused = true;
      ws.scheduler.status = 'paused';
      ws.scheduler.nextScheduledRunAt = null;
      ws.scheduler.nextScheduledRunEat = null;
      pushWorkspaceNotification(ws, {
        type: 'automation_stopped',
        title: 'Hourly Global Reach automation paused',
        message: 'Automatic hourly discovery has been paused by user control.',
      });
    } else if (action === 'resume' || action === 'enable') {
      ws.scheduler.enabled = true;
      ws.scheduler.paused = false;
      ws.scheduler.status = ws.scheduler.isRunningNow ? 'running' : 'active_waiting';
      const nextIso = new Date(Date.now() + HOURLY_INTERVAL_MS).toISOString();
      ws.scheduler.nextScheduledRunAt = nextIso;
      ws.scheduler.nextScheduledRunEat = formatEatTimestamp(nextIso);
    } else if (action === 'disable') {
      ws.scheduler.enabled = false;
      ws.scheduler.paused = true;
      ws.scheduler.status = 'disabled';
      ws.scheduler.nextScheduledRunAt = null;
      ws.scheduler.nextScheduledRunEat = null;
      pushWorkspaceNotification(ws, {
        type: 'automation_stopped',
        title: 'Hourly Global Reach automation disabled',
        message: 'Automatic hourly discovery has been disabled until re-enabled.',
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid scheduler action. Use pause, resume, enable, or disable.' });
    }

    saveDb(db);
    appendAuditLog({
      actorEmail: identity.actorEmail,
      action: `global_reach_scheduler_${action}`,
      targetType: 'global_reach',
      summary: `Global Reach hourly scheduler action: ${action}`,
    });

    return res.json({
      success: true,
      scheduler: ws.scheduler,
      stats: computeRealDatabaseStats(ws),
    });
  });

  app.post('/api/global-reach/notifications/ack', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    const id = typeof req.body?.id === 'string' ? req.body.id : null;
    if (id) {
      const target = ws.notifications.find((n) => n.id === id);
      if (target) target.read = true;
    } else {
      for (const n of ws.notifications) n.read = true;
    }
    saveDb(db);
    return res.json({
      success: true,
      unreadNotificationsCount: ws.notifications.filter((n) => !n.read).length,
    });
  });

  app.post('/api/global-reach/suppression', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);

    const email = isValidPublicEmailSyntax(req.body?.email)
      ? String(req.body.email).trim().toLowerCase()
      : undefined;
    const domain = typeof req.body?.domain === 'string'
      ? req.body.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      : undefined;

    if (!email && !domain) {
      return res.status(400).json({ success: false, error: 'Provide a valid email or domain to suppress.' });
    }

    const entry: GlobalReachSuppressionEntry = {
      id: `grs_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      email,
      domain: domain || undefined,
      contactName: typeof req.body?.contactName === 'string' ? req.body.contactName.slice(0, 120) : undefined,
      reason: String(req.body?.reason || 'User opt-out / do not contact').slice(0, 240),
      createdAt: new Date().toISOString(),
    };
    ws.suppressionList.unshift(entry);
    saveDb(db);
    return res.status(201).json({ success: true, suppressionList: ws.suppressionList });
  });

  app.delete('/api/global-reach/suppression/:id', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    ws.suppressionList = ws.suppressionList.filter((s) => s.id !== req.params.id);
    saveDb(db);
    return res.json({ success: true, suppressionList: ws.suppressionList });
  });

  app.delete('/api/global-reach/privacy/purge', (req: Request, res: Response) => {
    const identity = resolveAuthenticatedWorkspace(req);
    if (!identity) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    const db = loadDb();
    const ws = getOrCreateWorkspace(db, identity);
    ws.contacts = [];
    ws.notifications = [];
    saveDb(db);
    return res.json({ success: true, stats: computeRealDatabaseStats(ws) });
  });

  // ==================== HOURLY VERCEL CRON ENDPOINT ====================
  const handleHourlyCron = async (req: Request, res: Response) => {
    const configuredSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = String(req.headers.authorization || '');
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const altSecret = String(req.headers['x-cron-secret'] || '').trim();

    const authorized =
      isPersistentOwnerRequest(req) ||
      (configuredSecret.length > 0 && (bearer === configuredSecret || altSecret === configuredSecret));

    if (!authorized) {
      return res.status(401).json({ success: false, error: 'Unauthorized hourly cron request.' });
    }

    const db = loadDb();
    const activeWorkspaceIds = Object.keys(db.workspaces).filter(
      (id) => db.workspaces[id]?.scheduler?.enabled && !db.workspaces[id]?.scheduler?.paused
    );

    const results: Array<{ workspaceId: string; cycleLog: GlobalReachCycleLog }> = [];
    for (const wid of activeWorkspaceIds.slice(0, 5)) {
      const r = await runDiscoveryCycleForWorkspace(wid, { trigger: 'vercel_cron' });
      results.push({ workspaceId: wid, cycleLog: r.cycleLog });
    }

    return res.json({
      success: true,
      executedWorkspaces: results.length,
      results,
    });
  };

  app.get('/api/cron/global-reach', handleHourlyCron);
  app.post('/api/cron/global-reach', handleHourlyCron);

  // ==================== 24/7 AUTONOMOUS HOURLY SERVER SCHEDULER ====================
  let hourlyTimer: ReturnType<typeof setInterval> | null = null;
  let startupTimer: ReturnType<typeof setTimeout> | null = null;

  function bootAutonomousHourlyScheduler() {
    // Recover any stale running lock left over from an abrupt server restart
    const db = loadDb();
    let changed = false;
    for (const ws of Object.values(db.workspaces)) {
      if (ws.scheduler.isRunningNow) {
        ws.scheduler.isRunningNow = false;
        ws.scheduler.lockAcquiredAt = null;
        ws.scheduler.status = ws.scheduler.enabled && !ws.scheduler.paused ? 'active_waiting' : ws.scheduler.paused ? 'paused' : 'disabled';
        ws.scheduler.recoveryNotes = `Recovered gracefully after server restart at ${new Date().toISOString()}.`;
        changed = true;
      }
    }
    if (changed) saveDb(db);

    if (isVercel || process.env.DISABLE_BACKGROUND_SCHEDULERS === 'true') {
      return;
    }

    // Execute first real hourly cycle shortly after server activation if never run or >= 60 min overdue
    startupTimer = setTimeout(() => {
      const currentDb = loadDb();
      const ownerWs = currentDb.workspaces[OWNER_WORKSPACE_ID];
      if (!ownerWs || !ownerWs.scheduler.enabled || ownerWs.scheduler.paused) return;

      const lastRunMs = ownerWs.scheduler.lastSuccessfulRunAt
        ? Date.parse(ownerWs.scheduler.lastSuccessfulRunAt)
        : 0;
      const isDueNow =
        ownerWs.contacts.length === 0 ||
        !lastRunMs ||
        Number.isNaN(lastRunMs) ||
        Date.now() - lastRunMs >= HOURLY_INTERVAL_MS - 30_000;

      if (isDueNow) {
        runDiscoveryCycleForWorkspace(OWNER_WORKSPACE_ID, { trigger: 'startup_auto' }).catch(
          (err) => console.error('[GlobalReach] Initial discovery cycle failed:', err?.message || err)
        );
      }
    }, 3500);

    // Repeat strictly every 60 minutes 24/7 while server runs
    hourlyTimer = setInterval(() => {
      const currentDb = loadDb();
      const workspaceIds = Object.keys(currentDb.workspaces).filter(
        (id) => currentDb.workspaces[id]?.scheduler?.enabled && !currentDb.workspaces[id]?.scheduler?.paused
      );
      for (const wid of workspaceIds) {
        runDiscoveryCycleForWorkspace(wid, { trigger: 'hourly_scheduler' }).catch((err) =>
          console.error(`[GlobalReach] Hourly cycle failed for ${wid}:`, err?.message || err)
        );
      }
    }, HOURLY_INTERVAL_MS);

    if (typeof hourlyTimer.unref === 'function') hourlyTimer.unref();
    if (typeof startupTimer.unref === 'function') startupTimer.unref();
  }

  bootAutonomousHourlyScheduler();

  return {
    runDiscoveryCycleForWorkspace,
    loadDb,
    stopScheduler: () => {
      if (hourlyTimer) clearInterval(hourlyTimer);
      if (startupTimer) clearTimeout(startupTimer);
    },
  };
}
