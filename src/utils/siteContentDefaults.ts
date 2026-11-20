import type { SiteContentConfig, SiteSettings } from '../types/job';

export const DEFAULT_SITE_CONTENT: Required<SiteContentConfig> = {
  // Brand & Header
  brandPrimary: 'Hopeland',
  brandAccent: 'Jobs',
  browserTitle: 'HOPELAND JOBS | Hopeland Jobs - Find Your Opportunity.',
  showAnnouncementBanner: false,
  announcementText: '',
  announcementLinkUrl: '',
  announcementLinkLabel: 'Learn More',
  showTopDownloadBar: true,
  topDownloadBarText: 'Download App · አፑን ያውርዱ',
  topDownloadBarSubtitle: 'Phone & Computer · Optional · ፈጣን የስራ ማሳወቂያ',
  downloadReminderIntervalSeconds: 60,
  showNavJobs: true,
  showNavCategories: true,
  showNavInternational: true,
  showNavImmigration: true,
  showNavScholarships: true,

  // Homepage Hero Section
  showHeroSection: true,
  heroTitle: 'Find Verified Jobs in Ethiopia & Abroad',
  heroSubtitleAmharic: 'በኢትዮጵያ እና በውጭ ሀገር የተረጋገጡ የስራ እድሎችን በቀላሉ ያግኙ',
  heroSearchPlaceholderJobs: 'Job title, keywords, or skills...',
  heroSearchPlaceholderCompanies: 'Search companies in Ethiopia (e.g. CBE, Airlines, UNICEF)...',
  heroSearchButtonText: 'Search',
  heroNoLoginNoticeEn: 'No login required to browse or apply',
  heroNoLoginNoticeAm: 'ያለ ምዝገባ በነፃ ይጠቀሙ',
  heroRegisterButtonText: 'Register Free · በነፃ ይመዝገቡ',
  heroDownloadButtonText: 'Download App · አፑን ያውርዱ',
  heroBenefitsButtonText: 'Why Register & Get the App? · ጥቅሞቹን ይመልከቱ',
  heroCustomBackgroundUrl: '',

  // Trusted Companies Strip
  showTrustedCompanies: true,
  trustedCompaniesTitle: 'Companies',

  // Job Categories Section
  showCategoriesSection: true,
  categoriesDefaultExpanded: false,
  categoriesTitle: 'All Job Categories',
  categoriesSubtitle: 'Banking, Healthcare, Engineering, NGOs, IT & more',
  categoriesShowButtonText: 'List All Job Categories',
  categoriesHideButtonText: 'Hide Job Categories',

  // Optional Login, Register & App Benefits Section
  showBenefitsSection: true,
  benefitsBadgeText: '100% Optional · ሙሉ በሙሉ አማራጭ · Free Forever',
  benefitsHeadingEn: 'Browse Freely — Or Get Even More with Free Registration & the Official App',
  benefitsSubheadingAm:
    'ማንኛውንም ስራ ያለ ምዝገባ በነፃ ይመልከቱና ያመልክቱ — መመዝገብ፣ መግባት ወይም አፑን ማውረድ ሙሉ በሙሉ በፍላጎትዎ ነው።',
  benefitsSubheadingEn:
    'Login, Register, and App Download are never required. Discover the big advantages below in English and Amharic:',
  registerCardTitleEn: 'Why Register or Login?',
  registerCardTitleAm: 'የመመዝገብ እና የመግባት ጥቅሞች',
  appCardTitleEn: 'Why Download the App?',
  appCardTitleAm: 'አፑን የማውረድ ጥቅሞች (ለስልክ እና ለኮምፒውተር)',

  // Featured Companies Carousel
  showFeaturedCompanies: true,
  featuredCompaniesTitle: 'Featured Companies',
  featuredCompaniesSubtitle:
    'Explore verified vacancies from leading banks, airlines, telecom, insurance, and UN organizations in Ethiopia.',

  // How It Works Section
  showHowItWorksSection: true,
  howItWorksTitle: 'How HopelandJobs Works',
  howItWorksSubtitle:
    'Find verified Ethiopian careers, organize your application documents, and receive real-time job alerts tailored to your profile.',
  howItWorksStep1Title: 'Search Verified Jobs',
  howItWorksStep1Desc:
    'Browse genuine job announcements across Ethiopia’s top banks, NGOs, UN agencies, airlines, and corporate employers with confirmed deadlines.',
  howItWorksStep2Title: 'Build Profile & CV Vault',
  howItWorksStep2Desc:
    'Save your education, work history, CV, and supporting credentials securely once so you are always ready to apply directly.',
  howItWorksStep3Title: 'Get Matched & Apply',
  howItWorksStep3Desc:
    'Receive instant alerts when vacancies matching your qualifications and preferred sectors open, with direct official employer application links.',

  // CV & Application Assistance + About Section
  showCvAssistanceSection: true,
  cvAssistanceTitle: 'CV & Application Assistance',
  cvAssistanceSubtitle:
    'Applying for banking positions at CBE or Awash, UN agencies like UNICEF, or corporate roles in Addis Ababa? Prepare your application documents to match official Ethiopian recruitment standards.',
  showAiCareerAdvisor: true,
  showAboutSection: true,
  aboutSectionTitle: 'About HOPELAND JOBS',

  // Footer & Social Links
  footerTelegramButtonText: 'Join Telegram Job Alerts',
  footerVerificationText: 'Verified Ethiopian Vacancies · Direct Official Application Links',
  footerCopyrightText: '',
  showFooterSectors: true,
  showFooterCities: true,
  showFooterGlobalLinks: true,
  socialFacebookUrl: '',
  socialLinkedinUrl: '',
  socialTwitterUrl: '',
  socialTiktokUrl: '',
  socialYoutubeUrl: '',
};

export function resolveSiteContent(
  settings?: Partial<SiteSettings> | null
): Required<SiteContentConfig> {
  const custom = settings?.siteContent || {};
  const merged = { ...DEFAULT_SITE_CONTENT };
  for (const key of Object.keys(DEFAULT_SITE_CONTENT) as Array<keyof SiteContentConfig>) {
    const val = custom[key];
    if (val !== undefined && val !== null) {
      (merged as any)[key] = val;
    }
  }
  return merged;
}
