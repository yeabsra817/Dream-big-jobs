import React, { useState } from 'react';
import {
  UserPlus,
  LogIn,
  Download,
  Bell,
  Briefcase,
  Smartphone,
  ShieldCheck,
  Zap,
  CheckCircle2,
  User,
  Monitor,
  BookmarkCheck,
} from 'lucide-react';
import { AppBrandLogo } from './AppBrandLogo';

interface Props {
  appLogoUrl?: string | null;
  isLoggedIn: boolean;
  userDisplayName?: string | null;
  isStandaloneApp: boolean;
  isDesktop?: boolean;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
  onOpenDashboard: () => void;
  onDownloadApp: () => Promise<void> | void;
}

const ACCOUNT_BENEFITS = [
  {
    icon: Briefcase,
    iconBg: 'bg-emerald-100 text-[#15803D] border-emerald-200',
    titleEn: 'Experience-Matched Jobs First',
    titleAm: 'በልምድዎ የተመረጡ ስራዎች ቅድሚያ',
    descEn:
      'See local Ethiopian and visa-sponsored vacancies suited to your profession and related fields first (for example, Banking & Finance).',
    descAm:
      'ከሙያዎ እና ከልምድዎ ጋር የሚስማሙ የሀገር ውስጥ እና የውጭ ቪዛ ስራዎችን በቅድሚያ ያግኙ።',
  },
  {
    icon: Bell,
    iconBg: 'bg-amber-100 text-amber-800 border-amber-200',
    titleEn: 'Instant Phone-Bar Alerts & 3-Day Reminders',
    titleAm: 'ፈጣን የስልክ ባር ማሳወቂያ እና የ3 ቀን ማስታወሻ',
    descEn:
      'Receive matching job notifications directly on your device plus helpful reminders of your top 3 recommended openings.',
    descAm:
      'አዳዲስ ተስማሚ ስራዎች ሲወጡ በስልክዎ ላይ ቀጥታ ማሳወቂያ እና የምርጥ 3 ስራዎች ማስታወሻ ይደርስዎታል።',
  },
  {
    icon: BookmarkCheck,
    iconBg: 'bg-blue-100 text-[#1D4ED8] border-blue-200',
    titleEn: 'Saved CV, 1-Click Apply & Tracking',
    titleAm: 'የተቀመጠ ሲቪ፣ ፈጣን ማመልከቻ እና ክትትል',
    descEn:
      'Store your CV and credentials once, bookmark favorite jobs across devices, and track every application in one place.',
    descAm:
      'ሲቪዎን አንድ ጊዜ አስቀምጠው በፍጥነት ያመልክቱ፤ የሚወዷቸውን ስራዎችም በቀላሉ ይከታተሉ።',
  },
];

const APP_BENEFITS = [
  {
    icon: Monitor,
    iconBg: 'bg-amber-400/20 text-amber-300 border-amber-400/35',
    titleEn: 'Works on Both Phone & Computer',
    titleAm: 'በስልክም ሆነ በኮምፒውተር ይሰራል',
    descEn:
      'Install HopelandJobs directly on Android, iPhone, Windows, or Mac in seconds — lightweight and no app store required.',
    descAm:
      'በአንድሮይድ፣ አይፎን፣ ዊንዶውስ ወይም ማክ ላይ ያለ Play Store በሰከንዶች ይጫናል።',
  },
  {
    icon: Smartphone,
    iconBg: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/35',
    titleEn: 'Direct Phone-Bar & Desktop Notifications',
    titleAm: 'ቀጥታ የስልክ ባር እና የኮምፒውተር ማሳወቂያ',
    descEn:
      'Get urgent bank, NGO, UN, and embassy job alerts right in your mobile notification bar so you never miss a deadline.',
    descAm:
      'የባንክ፣ የNGO እና የኤምባሲ ስራዎችን ማሳወቂያ በስልክዎ ባር ላይ ቀጥታ በማግኘት የማመልከቻ ቀን አያምልጥዎ።',
  },
  {
    icon: Zap,
    iconBg: 'bg-sky-400/20 text-sky-300 border-sky-400/35',
    titleEn: 'Faster Access & Low Data Usage',
    titleAm: 'ፈጣን አገልግሎት እና አነስተኛ ኢንተርኔት',
    descEn:
      'Launch HopelandJobs straight from your Home Screen or desktop taskbar with instant loading, even on slower mobile connections.',
    descAm:
      'ከስልክዎ ወይም ከኮምፒውተርዎ ዋና ገጽ በ1 ንክኪ በፍጥነት ይክፈቱ፤ የኢንተርኔት ዳታ ይቆጥባል።',
  },
];

export const OptionalBenefitsShowcase: React.FC<Props> = ({
  appLogoUrl,
  isLoggedIn,
  userDisplayName,
  isStandaloneApp,
  isDesktop = false,
  onOpenAuth,
  onOpenDashboard,
  onDownloadApp,
}) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await onDownloadApp();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section
      id="optional-benefits-section"
      aria-labelledby="optional-benefits-heading"
      className="bg-gradient-to-b from-emerald-50/75 via-white to-amber-50/45 py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-emerald-200/70 font-['Plus_Jakarta_Sans','Noto_Sans_Ethiopic',sans-serif]"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header — Bold Bilingual Optional Assurance */}
        <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12 space-y-3">
          <p className="text-xs sm:text-sm font-extrabold text-[#15803D] tracking-wide">
            100% Optional · ሙሉ በሙሉ አማራጭ · Free Forever
          </p>
          <h2
            id="optional-benefits-heading"
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0B132B] text-balance"
          >
            Browse Freely — Or Get Even More with{' '}
            <span className="text-[#16A34A]">Free Registration</span> &amp;{' '}
            <span className="text-[#1D4ED8]">the Official App</span>
          </h2>
          <p className="text-sm sm:text-base font-bold text-[#0B132B] leading-relaxed">
            ማንኛውንም ስራ ያለ ምዝገባ በነፃ ይመልከቱና ያመልክቱ — መመዝገብ፣ መግባት ወይም አፑን ማውረድ ሙሉ በሙሉ በፍላጎትዎ ነው።
          </p>
          <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
            Login, Register, and App Download are never required. Discover the big advantages below in English and Amharic:
          </p>
        </div>

        {/* Bold, Colorful 2-Column Benefits Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7 items-stretch">
          {/* Card 1: Optional Register / Login Benefits (Vibrant Emerald Accent Header + Crisp Surface) */}
          <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-lg shadow-emerald-950/[0.06] overflow-hidden flex flex-col justify-between">
            <div>
              {/* Bold Emerald Header Band */}
              <div className="bg-gradient-to-r from-[#15803D] via-[#16A34A] to-[#059669] text-white px-6 py-6 sm:px-8 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-200">
                    Optional Free Account · ነፃ አካውንት (አማራጭ)
                  </p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Why Register or Login?
                  </h3>
                  <p className="text-sm sm:text-base font-bold text-emerald-50">
                    የመመዝገብ እና የመግባት ጥቅሞች
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="p-6 sm:p-8">
                <ul className="space-y-5">
                  {ACCOUNT_BENEFITS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.titleEn} className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${item.iconBg}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-sm sm:text-[15px] font-extrabold text-[#0B132B] leading-snug">
                            {item.titleEn}
                          </h4>
                          <p className="text-xs sm:text-[13px] font-bold text-[#15803D] leading-snug">
                            {item.titleAm}
                          </p>
                          <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed pt-0.5">
                            {item.descEn}
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {item.descAm}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-4 border-t border-emerald-100 bg-emerald-50/40">
              {isLoggedIn ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#15803D]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Signed in as {userDisplayName || 'Member'} · ገብተዋል
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenDashboard}
                    className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span>My Profile · ፕሮፋይሌ</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signup')}
                    className="flex-1 min-w-[180px] min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#059669] hover:from-[#15803D] hover:to-[#047857] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-emerald-600/25 active:scale-[0.99]"
                  >
                    <UserPlus className="w-4 h-4 shrink-0" />
                    <span>Register Free · ይመዝገቡ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signin')}
                    className="flex-1 min-w-[140px] min-h-[48px] px-5 py-3 rounded-xl bg-white hover:bg-slate-50 text-[#0B132B] border-2 border-[#0B132B] font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-4 h-4 text-[#16A34A] shrink-0" />
                    <span>Login · ይግቡ</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Optional Download App Benefits (Rich Navy-to-Royal-Blue Card + Bold Amber CTA) */}
          <div className="bg-gradient-to-br from-[#0B132B] via-[#132959] to-[#0B253A] text-white rounded-2xl border-2 border-[#1E3A8A]/70 shadow-lg shadow-slate-950/20 overflow-hidden flex flex-col justify-between">
            <div>
              {/* Bold Royal Accent Header Band */}
              <div className="bg-white/[0.06] border-b border-white/15 px-6 py-6 sm:px-8 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-300">
                    Optional Official App · ኦፊሴላዊ መተግበሪያ (አማራጭ)
                  </p>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Why Download the App?
                  </h3>
                  <p className="text-sm sm:text-base font-bold text-[#4ADE80]">
                    አፑን የማውረድ ጥቅሞች (ለስልክ እና ለኮምፒውተር)
                  </p>
                </div>
                <AppBrandLogo logoUrl={appLogoUrl} size="lg" variant="green" />
              </div>

              <div className="p-6 sm:p-8">
                <ul className="space-y-5">
                  {APP_BENEFITS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.titleEn} className="flex items-start gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${item.iconBg}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-sm sm:text-[15px] font-extrabold text-white leading-snug tracking-[0.01em]">
                            {item.titleEn}
                          </h4>
                          <p className="text-xs sm:text-[13px] font-bold text-amber-300 leading-snug">
                            {item.titleAm}
                          </p>
                          <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed pt-0.5">
                            {item.descEn}
                          </p>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {item.descAm}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-4 border-t border-white/15 bg-black/15">
              {isStandaloneApp ? (
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#4ADE80] min-h-[48px]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    HopelandJobs App is Installed on This Device · መተግበሪያው ተጭኗል
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full sm:w-auto flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-[#0B132B] font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-amber-500/25 active:scale-[0.99] disabled:opacity-60"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>
                      {downloading
                        ? 'Downloading...'
                        : isDesktop
                        ? 'Download for Computer · አፑን ያውርዱ'
                        : 'Download App · አፑን ያውርዱ'}
                    </span>
                  </button>
                  <span className="text-xs font-semibold text-emerald-200 text-center sm:text-right">
                    Android · iPhone · Windows · Mac
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
