export interface Vacancy {
  id: string;
  title: string;
  organization: string;
  category: JobCategoryName;
  location: string;
  employmentType: 'Full-time' | 'Part-time' | 'Contract' | 'Permanent' | 'Internship' | 'Remote' | 'Other';
  vacanciesCount: string;
  jobGrade?: string;
  salary: string;
  educationQualification: string;
  requiredFieldOfStudy: string;
  experienceYears: string;
  requiredSkills: string[];
  description: string;
  responsibilities: string[];
  requiredDocuments: string[];
  applicationMethod: 'Online URL' | 'Email' | 'In-Person / Physical' | 'Postal / Mail' | 'Other';
  applicationEmail?: string;
  applicationUrl?: string;
  applicationInstructions: string;
  applicationDeadline: string;
  contactInfo: string;
  languageRequirements?: string;
  ageRequirements?: string;
  genderRequirements?: string;
  specialRequirements?: string;
  referenceNumber?: string;
  status: 'draft' | 'pending_review' | 'published' | 'expired' | 'closed' | 'archived' | 'duplicate';
  featured?: boolean;
  viewsCount: number;
  sharesCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  createdBy?: string;
  duplicateOfId?: string;
  duplicateReason?: string;
  isAiParsed?: boolean;
  missingFields?: string[];
  telegramPublished?: boolean;
  telegramMessageId?: number;
  telegramPublishedAt?: string;
  telegramPublishError?: string;
}

export type TelegramPostStatus =
  | 'ready'       // Yellow: READY TO POST (Waiting)
  | 'posting'     // Blue: POSTING (Currently sending)
  | 'success'     // Green: SUCCESSFULLY POSTED (Telegram confirmed)
  | 'failed'      // Red: FAILED (Telegram error)
  | 'already';    // Grey: ALREADY POSTED (Previously sent)

export interface TelegramBatchRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  status: 'draft' | 'in_progress' | 'completed' | 'partially_failed';
  jobs: Array<{
    vacancyId: string;
    title: string;
    organization: string;
    category?: string;
    status: 'success' | 'failed' | 'pending';
    telegramMessageId?: number;
    postedAt?: string;
    error?: string;
  }>;
}

export type JobCategoryName =
  | 'Banking and Financial Institutions'
  | 'Microfinance Institutions'
  | 'Embassy and Diplomatic Jobs'
  | 'NGO and International Organizations'
  | 'Hotel and Hospitality'
  | 'Tourism and Travel'
  | 'Government and Public Sector'
  | 'Private Companies'
  | 'Insurance Companies'
  | 'Education and Universities'
  | 'Healthcare and Medical'
  | 'IT and Technology'
  | 'Engineering and Construction'
  | 'Accounting and Finance'
  | 'Internships and Graduate Trainee Programs'
  | 'Remote and International Jobs';

export interface CategoryMeta {
  id: string;
  name: JobCategoryName;
  amharicName: string;
  iconName: string;
  description: string;
  featuredEmployers: string[];
  color: string;
  bgLight: string;
}

export interface DuplicateReportItem {
  id: string;
  batchId?: string;
  detectedAt: string;
  candidateTitle: string;
  candidateOrg: string;
  matchedVacancyId: string;
  matchedTitle: string;
  matchedOrg: string;
  matchedDeadline?: string;
  similarityScore: number;
  reason: string;
  status: 'discarded' | 'restored' | 'pending';
  candidateData: Partial<Vacancy>;
}

export interface SiteSettings {
  telegramChannelName: string;
  telegramChannelUrl: string;
  telegramGroupUrl: string;
  telegramBotToken?: string;
  telegramBotUsername?: string;
  telegramAutoPublish: boolean;
  gaMeasurementId?: string;
  gaTrackingEnabled?: boolean;
  excludeAdminTraffic?: boolean;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  aboutText: string;
  updatedAt: string;
  // Smart Alerts & Thresholds
  alertTrafficDropThreshold?: number; // e.g. 50% drop
  alertMinVisitorsBaseline?: number; // e.g. 2 visitors minimum before evaluating drop
  alertBrokenLinksEnabled?: boolean;
  alertAnalyticsFailureEnabled?: boolean;
  dismissedAlertIds?: string[];
  // Autonomous Self-Healing System
  autoRepairEnabled?: boolean;
  autoArchiveExpiredEnabled?: boolean;
  autoFixBrokenLinksEnabled?: boolean;
  autoHealDuplicatesEnabled?: boolean;
  lastSelfHealingRun?: string;
  totalSelfHealedCount?: number;
}

export interface BulkImportStats {
  totalDetected: number;
  successfullyOrganized: number;
  duplicatesDetected: number;
  missingInfoCount: number;
  readyForReview: number;
  readyForPublication: number;
}

export const OFFICIAL_CATEGORIES: CategoryMeta[] = [
  {
    id: 'banking-and-financial-institutions',
    name: 'Banking and Financial Institutions',
    amharicName: 'ባንክ እና የፋይናንስ ተቋማት',
    iconName: 'Landmark',
    description: 'Commercial Bank of Ethiopia, Awash, Dashen, Abyssinia, Coop Bank, Hibret, Zemen, and other commercial banks.',
    featuredEmployers: ['Commercial Bank of Ethiopia', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia'],
    color: '#0D9488',
    bgLight: '#F0FDFA',
  },
  {
    id: 'microfinance-institutions',
    name: 'Microfinance Institutions',
    amharicName: 'አነስተኛ የፋይናንስ ተቋማት',
    iconName: 'Coins',
    description: 'VisionFund, OCSSCO, Addis Credit, Wasasa, Harbu, and regional microfinance providers.',
    featuredEmployers: ['VisionFund Ethiopia', 'OCSSCO', 'Nisir Microfinance', 'Addis Credit & Saving'],
    color: '#16A34A',
    bgLight: '#F0FDF4',
  },
  {
    id: 'embassy-and-diplomatic-jobs',
    name: 'Embassy and Diplomatic Jobs',
    amharicName: 'ኤምባሲ እና ዲፕሎማሲያዊ የስራ እድሎች',
    iconName: 'Building2',
    description: 'US Embassy, British Embassy, EU Delegation, African Union, UNECA, and foreign missions in Addis Ababa.',
    featuredEmployers: ['US Embassy Addis Ababa', 'British Embassy', 'African Union (AU)', 'UN Economic Commission for Africa'],
    color: '#2563EB',
    bgLight: '#EFF6FF',
  },
  {
    id: 'ngo-and-international-organizations',
    name: 'NGO and International Organizations',
    amharicName: 'መንግስታዊ ያልሆኑ እና ዓለም አቀፍ ድርጅቶች',
    iconName: 'Globe2',
    description: 'UNDP, UNICEF, Save the Children, World Vision, CARE, IRC, Oxfam, ICRC, and local civil societies.',
    featuredEmployers: ['UNICEF Ethiopia', 'Save the Children', 'World Vision', 'Action Against Hunger'],
    color: '#0284C7',
    bgLight: '#F0F9FF',
  },
  {
    id: 'hotel-and-hospitality',
    name: 'Hotel and Hospitality',
    amharicName: 'ሆቴል እና መስተንግዶ',
    iconName: 'UtensilsCrossed',
    description: 'Sheraton Addis, Skylight Hotel, Radisson Blu, Hilton, Hyatt Regency, Kuriftu, and premier resorts.',
    featuredEmployers: ['Sheraton Addis Luxury Collection', 'Ethiopian Skylight Hotel', 'Radisson Blu Addis', 'Hyatt Regency'],
    color: '#D97706',
    bgLight: '#FFFBEB',
  },
  {
    id: 'tourism-and-travel',
    name: 'Tourism and Travel',
    amharicName: 'ቱሪዝም እና ጉዞ',
    iconName: 'Compass',
    description: 'Ethiopian Airlines Group, tour operators, travel agencies, wildlife conservation, and eco-lodges.',
    featuredEmployers: ['Ethiopian Airlines Group', 'Grand Holidays Ethiopia', 'Simien Mountain Lodges'],
    color: '#EA580C',
    bgLight: '#FFF7ED',
  },
  {
    id: 'government-and-public-sector',
    name: 'Government and Public Sector',
    amharicName: 'መንግስታዊ እና የህዝብ ዘርፍ',
    iconName: 'Scale',
    description: 'Federal Ministries, Ethiopian Revenue Authority, Ethio Telecom, Ethiopian Electric Power, regional bureaus.',
    featuredEmployers: ['Ethio Telecom', 'Ministry of Innovation & Technology', 'Ethiopian Customs Commission'],
    color: '#4F46E5',
    bgLight: '#EEF2FF',
  },
  {
    id: 'private-companies',
    name: 'Private Companies',
    amharicName: 'የግል ኩባንያዎች እና ኮርፖሬሽኖች',
    iconName: 'Briefcase',
    description: 'Midroc Investment Group, Dangote, BGI Ethiopia, East African Holding, manufacturing, and commerce.',
    featuredEmployers: ['MIDROC Investment Group', 'BGI Ethiopia', 'Heineken Breweries', 'East African Holding'],
    color: '#7C3AED',
    bgLight: '#F5F3FF',
  },
  {
    id: 'insurance-companies',
    name: 'Insurance Companies',
    amharicName: 'የኢንሹራንስ እና መድን ኩባንያዎች',
    iconName: 'ShieldCheck',
    description: 'Ethiopian Insurance Corporation, Awash Insurance, Nyala, Africa Insurance, United, and Nib Insurance.',
    featuredEmployers: ['Ethiopian Insurance Corporation', 'Awash Insurance', 'Nyala Insurance', 'United Insurance'],
    color: '#059669',
    bgLight: '#ECFDF5',
  },
  {
    id: 'education-and-universities',
    name: 'Education and Universities',
    amharicName: 'ትምህርት እና ዩኒቨርሲቲዎች',
    iconName: 'GraduationCap',
    description: 'Addis Ababa University, Sandford International School, International Community School, colleges and institutes.',
    featuredEmployers: ['Addis Ababa University (AAU)', 'International Community School (ICS)', 'Sandford School'],
    color: '#475569',
    bgLight: '#F8FAFC',
  },
  {
    id: 'healthcare-and-medical',
    name: 'Healthcare and Medical',
    amharicName: 'ጤና እና ሕክምና',
    iconName: 'HeartPulse',
    description: 'St. Paul Millennium College, Korean Hospital (MCM), Kadisco, pharmaceutical firms, and public clinics.',
    featuredEmployers: ['MCM General Hospital (Korean)', 'St. Paul Hospital', 'Kadisco General Hospital'],
    color: '#E11D48',
    bgLight: '#FFF1F2',
  },
  {
    id: 'it-and-technology',
    name: 'IT and Technology',
    amharicName: 'ኢንፎርሜሽን ቴክኖሎጂ እና ሶፍትዌር',
    iconName: 'CodeXml',
    description: 'Software houses, fintech startups, telecom services, systems engineering, cybersecurity, and data analysis.',
    featuredEmployers: ['Kifiya Financial Technology', 'Telebirr Systems', 'Chapa Financial Technologies'],
    color: '#0284C7',
    bgLight: '#F0F9FF',
  },
  {
    id: 'engineering-and-construction',
    name: 'Engineering and Construction',
    amharicName: 'ምህንድስና እና ግንባታ',
    iconName: 'HardHat',
    description: 'Civil engineering, architecture, project management, MEP, road construction, and real estate developers.',
    featuredEmployers: ['Flintstone Engineering', 'Sunshine Construction', 'Ayat Real Estate', 'Sur Construction'],
    color: '#CA8A04',
    bgLight: '#FEFCE8',
  },
  {
    id: 'accounting-and-finance',
    name: 'Accounting and Finance',
    amharicName: 'ሒሳብ እና ፋይናንስ',
    iconName: 'ReceiptText',
    description: 'Audit firms, senior accountants, financial analysts, tax consultants, and budget officers.',
    featuredEmployers: ['Ernst & Young Ethiopia', 'KPMG Associates', 'Audit Services Corporation'],
    color: '#0891B2',
    bgLight: '#ECFEFF',
  },
  {
    id: 'internships-and-graduate-trainee-programs',
    name: 'Internships and Graduate Trainee Programs',
    amharicName: 'የልምምድ እና ጀማሪ ፕሮግራሞች',
    iconName: 'Sparkles',
    description: 'Fresh graduate programs, bank trainee batches, management trainee tracks, and university internships.',
    featuredEmployers: ['CBE Graduate Trainee Batch', 'Awash Bank Trainees', 'NGO Youth Internships'],
    color: '#9333EA',
    bgLight: '#FAF5FF',
  },
  {
    id: 'remote-and-international-jobs',
    name: 'Remote and International Jobs',
    amharicName: 'የሩቅ እና ዓለም አቀፍ ስራዎች',
    iconName: 'Laptop',
    description: 'Global remote opportunities, work-from-home positions, freelance contracts, and overseas roles for Ethiopians.',
    featuredEmployers: ['Global Remote Employers', 'African Development Bank', 'Remote Tech Hubs'],
    color: '#4338CA',
    bgLight: '#EEF2FF',
  },
];

export const ETHIOPIAN_LOCATIONS = [
  'Addis Ababa',
  'Shashemene',
  'Hawassa',
  'Adama (Nazret)',
  'Dire Dawa',
  'Bahir Dar',
  'Mekelle',
  'Jimma',
  'Gondar',
  'Bishoftu (Debre Zeyit)',
  'Dessie',
  'Jigjiga',
  'Harar',
  'Arba Minch',
  'Dilla',
  'Debre Birhan',
  'Debre Markos',
  'Nekemte',
  'Hosanna',
  'Wolaita Sodo',
  'Assosa',
  'Gambella',
  'Semera',
  'Other Ethiopian Cities / Regions',
  'Remote / Anywhere in Ethiopia',
];
