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
  strictlyQualified?: boolean;
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
  if (profile.noExperience && (!profile.experience || profile.experience.length === 0)) {
    return 0;
  }
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

export interface ExperienceMatchAssessment {
  isMatch: boolean;
  matchType: 'direct' | 'related' | 'none';
  score: number;
  badgeLabel: string;
  matchedUserDomains: string[];
  matchedJobDomains: string[];
  meetsYearsRequirement: boolean;
  yearsWarning?: string;
}

export interface ProfessionFamilyDef {
  id: string;
  label: string;
  patterns: RegExp[];
  excludePattern?: RegExp;
  relatedIds: string[];
}

export const PROFESSION_FAMILIES: ProfessionFamilyDef[] = [
  {
    id: 'banking',
    label: 'Banking',
    patterns: [
      /\bbank(?:ing|er|s)?\b/i,
      /\bteller\b/i,
      /\bcredit analyst\b/i,
      /\bloan officer\b/i,
      /\bbranch manager\b/i,
      /\btrade finance\b/i,
      /\bmicrofinance\b/i,
      /\bmfi\b/i,
      /\bsacco\b/i,
      /\btreasury\b/i,
      /\bcore banking\b/i,
      /\bkyc\b/i,
      /\baml\b/i,
      /\brelationship manager\b/i,
    ],
    excludePattern: /\b(blood bank|food bank|river bank|data bank|question bank)\b/i,
    relatedIds: ['finance', 'insurance', 'economics', 'sales_marketing', 'legal_compliance', 'customer_service'],
  },
  {
    id: 'finance',
    label: 'Finance & Accounting',
    patterns: [
      /\bfinance\b/i,
      /\bfinancial\b/i,
      /\baccount(?:ant|ing|ancy|s)\b/i,
      /\baudit(?:or|ing)?\b/i,
      /\btax(?:ation)?\b/i,
      /\bcpa\b/i,
      /\bacca\b/i,
      /\bifrs\b/i,
      /\bbookkeep(?:er|ing)\b/i,
      /\bpayroll\b/i,
      /\bbudget(?:ing)?\b/i,
      /\bfinancial controller\b/i,
      /\btreasurer\b/i,
      /\bcost(?:ing)? analyst\b/i,
    ],
    relatedIds: ['banking', 'insurance', 'economics', 'logistics_supply', 'legal_compliance'],
  },
  {
    id: 'insurance',
    label: 'Insurance & Risk',
    patterns: [
      /\binsurance\b/i,
      /\bunderwrit(?:er|ing)\b/i,
      /\bclaims? (?:officer|adjuster|analyst|manager)\b/i,
      /\bactuar(?:y|ial)\b/i,
      /\breinsurance\b/i,
      /\brisk management\b/i,
      /\brisk analyst\b/i,
    ],
    relatedIds: ['banking', 'finance', 'economics', 'legal_compliance'],
  },
  {
    id: 'economics',
    label: 'Economics & Investment',
    patterns: [
      /\beconom(?:ics|ist)\b/i,
      /\binvestment\b/i,
      /\bcapital market\b/i,
      /\bportfolio\b/i,
      /\bwealth management\b/i,
      /\bfinancial modeling\b/i,
      /\bvaluation\b/i,
    ],
    relatedIds: ['finance', 'banking', 'insurance', 'data_analytics'],
  },
  {
    id: 'it_software',
    label: 'IT & Software',
    patterns: [
      /\bsoftware\b/i,
      /\bdeveloper\b/i,
      /\bprogrammer\b/i,
      /\bfull[- ]?stack\b/i,
      /\bfront[- ]?end\b/i,
      /\bback[- ]?end\b/i,
      /\bdevops\b/i,
      /\bcloud engineer\b/i,
      /\bcyber ?security\b/i,
      /\bsysadmin\b/i,
      /\bsystems? admin(?:istrator)?\b/i,
      /\bict\b/i,
      /\bit support\b/i,
      /\bit officer\b/i,
      /\binformation technology\b/i,
      /\bcomputer science\b/i,
      /\bdatabase admin\b/i,
      /\bui\/?ux\b/i,
      /\bqa engineer\b/i,
      /\bweb designer\b/i,
    ],
    relatedIds: ['data_analytics', 'telecom', 'engineering_electromech', 'project_management'],
  },
  {
    id: 'data_analytics',
    label: 'Data & Analytics',
    patterns: [
      /\bdata scien(?:ce|tist)\b/i,
      /\bdata analyst\b/i,
      /\bbusiness intelligence\b/i,
      /\bmachine learning\b/i,
      /\bstatistic(?:s|ian)\b/i,
      /\banalytics\b/i,
      /\bpower ?bi\b/i,
      /\btableau\b/i,
      /\bmonitoring (?:&|and) evaluation\b/i,
      /\bm&e\b/i,
    ],
    relatedIds: ['it_software', 'economics', 'finance', 'ngo_humanitarian', 'education_training'],
  },
  {
    id: 'telecom',
    label: 'Telecom & Networks',
    patterns: [
      /\btelecom(?:munication|s)?\b/i,
      /\bsafaricom\b/i,
      /\bethio telecom\b/i,
      /\brf engineer\b/i,
      /\bfiber optic\b/i,
      /\bnetwork engineer(?:ing)?\b/i,
      /\bnetwork admin\b/i,
    ],
    relatedIds: ['it_software', 'engineering_electromech', 'sales_marketing'],
  },
  {
    id: 'ngo_humanitarian',
    label: 'NGO & Humanitarian',
    patterns: [
      /\bngo\b/i,
      /\bingo\b/i,
      /\bhumanitarian\b/i,
      /\bunicef\b/i,
      /\bundp\b/i,
      /\bwfp\b/i,
      /\bunhcr\b/i,
      /\bunited nations\b/i,
      /\brelief\b/i,
      /\blivelihood(?:s)?\b/i,
      /\bcommunity development\b/i,
      /\bsocial work(?:er)?\b/i,
      /\bgrant(?:s)? coordinator\b/i,
      /\bprogram(?:me)? officer\b/i,
      /\bprotection officer\b/i,
      /\bchild protection\b/i,
      /\bcivil society\b/i,
    ],
    relatedIds: ['wash', 'healthcare_public', 'project_management', 'logistics_supply', 'agriculture_env', 'education_training', 'data_analytics'],
  },
  {
    id: 'wash',
    label: 'WASH & Water Engineering',
    patterns: [
      /\bwash\b/i,
      /\bwater supply\b/i,
      /\bsanitation\b/i,
      /\bhygiene\b/i,
      /\bhydrogeolog(?:y|ist)\b/i,
      /\bwater engineer(?:ing)?\b/i,
      /\bhydraulic\b/i,
    ],
    relatedIds: ['ngo_humanitarian', 'engineering_civil', 'healthcare_public'],
  },
  {
    id: 'healthcare_clinical',
    label: 'Healthcare & Medical',
    patterns: [
      /\bnurs(?:e|ing)\b/i,
      /\bdoctor\b/i,
      /\bphysician\b/i,
      /\bmedical\b/i,
      /\bclinical\b/i,
      /\bpharmac(?:y|ist)\b/i,
      /\blab(?:oratory)? technologist\b/i,
      /\bmidwif(?:e|ery)\b/i,
      /\bhospital\b/i,
      /\bdent(?:al|ist)\b/i,
      /\bcaregiver\b/i,
      /\belderly care\b/i,
      /\bhealthcare\b/i,
      /\bhealth care\b/i,
      /\bsurgeon\b/i,
      /\bphysiotherap(?:y|ist)\b/i,
    ],
    relatedIds: ['healthcare_public', 'ngo_humanitarian'],
  },
  {
    id: 'healthcare_public',
    label: 'Public Health & Nutrition',
    patterns: [
      /\bpublic health\b/i,
      /\bmph\b/i,
      /\bnutrition(?:ist)?\b/i,
      /\bepidemiolog(?:y|ist)\b/i,
      /\benvironmental health\b/i,
      /\bhealth coordinator\b/i,
      /\bhealth officer\b/i,
    ],
    relatedIds: ['healthcare_clinical', 'ngo_humanitarian', 'wash'],
  },
  {
    id: 'engineering_civil',
    label: 'Civil & Construction',
    patterns: [
      /\bcivil engineer(?:ing)?\b/i,
      /\bconstruction\b/i,
      /\barchitect(?:ure|ural)?\b/i,
      /\bstructural engineer\b/i,
      /\bquantity survey(?:or|ing)\b/i,
      /\bsite engineer\b/i,
      /\broad engineer\b/i,
      /\burban plan(?:ner|ning)\b/i,
      /\bautocad\b/i,
    ],
    relatedIds: ['wash', 'engineering_electromech', 'project_management', 'skilled_trades'],
  },
  {
    id: 'engineering_electromech',
    label: 'Electrical & Mechanical Engineering',
    patterns: [
      /\belectrical engineer(?:ing)?\b/i,
      /\bmechanical engineer(?:ing)?\b/i,
      /\belectromechanical\b/i,
      /\bindustrial engineer(?:ing)?\b/i,
      /\bmaintenance engineer\b/i,
      /\bplant engineer\b/i,
      /\bhvac\b/i,
      /\bmechatronics\b/i,
      /\bpower engineer\b/i,
    ],
    relatedIds: ['engineering_civil', 'manufacturing_ops', 'skilled_trades', 'telecom', 'it_software'],
  },
  {
    id: 'manufacturing_ops',
    label: 'Manufacturing & Production',
    patterns: [
      /\bmanufactur(?:ing|er)\b/i,
      /\bfactory\b/i,
      /\bproduction (?:manager|supervisor|engineer|operator)\b/i,
      /\bquality control\b/i,
      /\bquality assurance\b/i,
      /\bplant manager\b/i,
      /\btextile\b/i,
      /\bbrewery\b/i,
      /\bfood processing\b/i,
    ],
    relatedIds: ['engineering_electromech', 'logistics_supply', 'agriculture_env'],
  },
  {
    id: 'hospitality_tourism',
    label: 'Hospitality & Culinary',
    patterns: [
      /\bhotel\b/i,
      /\bhospitality\b/i,
      /\btourism\b/i,
      /\bchef\b/i,
      /\bcook\b/i,
      /\bculinary\b/i,
      /\brestaurant\b/i,
      /\bhousekeeping\b/i,
      /\bfood (?:&|and) beverage\b/i,
      /\bfront desk\b/i,
      /\breceptionist\b/i,
      /\bresort\b/i,
      /\bcatering\b/i,
      /\bwaiter\b/i,
      /\bwaitress\b/i,
    ],
    relatedIds: ['aviation_travel', 'customer_service'],
  },
  {
    id: 'aviation_travel',
    label: 'Airlines & Aviation',
    patterns: [
      /\bairline\b/i,
      /\baviation\b/i,
      /\bcabin crew\b/i,
      /\bflight attendant\b/i,
      /\bairport\b/i,
      /\bpilot\b/i,
      /\baircraft\b/i,
      /\bticketing\b/i,
      /\btravel agent\b/i,
      /\bground staff\b/i,
    ],
    relatedIds: ['hospitality_tourism', 'customer_service', 'logistics_supply'],
  },
  {
    id: 'hr_admin',
    label: 'HR & Administration',
    patterns: [
      /\bhuman resource(?:s)?\b/i,
      /\bhr\b/i,
      /\brecruit(?:er|ment)\b/i,
      /\btalent acquisition\b/i,
      /\boffice manager\b/i,
      /\bexecutive assistant\b/i,
      /\badmin(?:istration|istrative)? (?:officer|assistant|manager)\b/i,
      /\bsecretary\b/i,
      /\bpeople operations\b/i,
    ],
    relatedIds: ['legal_compliance', 'education_training', 'customer_service', 'project_management'],
  },
  {
    id: 'logistics_supply',
    label: 'Logistics & Procurement',
    patterns: [
      /\blogistics\b/i,
      /\bsupply chain\b/i,
      /\bprocurement\b/i,
      /\bpurchasing\b/i,
      /\bwarehouse\b/i,
      /\binventory\b/i,
      /\bstorekeeper\b/i,
      /\bfreight\b/i,
      /\bimport\/?export\b/i,
      /\bcustoms\b/i,
      /\bfleet\b/i,
      /\bdispatch(?:er)?\b/i,
    ],
    relatedIds: ['finance', 'ngo_humanitarian', 'manufacturing_ops', 'skilled_trades', 'aviation_travel'],
  },
  {
    id: 'sales_marketing',
    label: 'Sales & Marketing',
    patterns: [
      /\bsales\b/i,
      /\bmarketing\b/i,
      /\bbusiness development\b/i,
      /\baccount manager\b/i,
      /\baccount executive\b/i,
      /\bretail\b/i,
      /\bbrand manager\b/i,
      /\bpublic relations\b/i,
      /\bdigital marketing\b/i,
      /\bmerchandising\b/i,
    ],
    relatedIds: ['banking', 'customer_service', 'telecom'],
  },
  {
    id: 'customer_service',
    label: 'Customer Service',
    patterns: [
      /\bcustomer service\b/i,
      /\bcustomer support\b/i,
      /\bcall center\b/i,
      /\bclient relations\b/i,
      /\bhelpdesk\b/i,
      /\bfront office\b/i,
    ],
    relatedIds: ['banking', 'hospitality_tourism', 'aviation_travel', 'sales_marketing', 'hr_admin'],
  },
  {
    id: 'education_training',
    label: 'Education & Training',
    patterns: [
      /\bteacher\b/i,
      /\bteaching\b/i,
      /\blecturer\b/i,
      /\bprofessor\b/i,
      /\binstructor\b/i,
      /\btutor\b/i,
      /\bcurriculum\b/i,
      /\bacademic\b/i,
      /\btrainer\b/i,
      /\beducation officer\b/i,
    ],
    relatedIds: ['hr_admin', 'ngo_humanitarian', 'data_analytics'],
  },
  {
    id: 'legal_compliance',
    label: 'Legal & Compliance',
    patterns: [
      /\blegal\b/i,
      /\blawyer\b/i,
      /\battorney\b/i,
      /\bcompliance\b/i,
      /\bcontract(?:s)? (?:specialist|manager|officer)\b/i,
      /\bparalegal\b/i,
      /\bregulatory\b/i,
      /\bpolicy advisor\b/i,
      /\bgovernance\b/i,
    ],
    relatedIds: ['banking', 'finance', 'insurance', 'hr_admin'],
  },
  {
    id: 'project_management',
    label: 'Project Management',
    patterns: [
      /\bproject manager\b/i,
      /\bproject management\b/i,
      /\bprogram manager\b/i,
      /\bpmp\b/i,
      /\bscrum master\b/i,
      /\bproject coordinator\b/i,
      /\boperations manager\b/i,
    ],
    relatedIds: ['ngo_humanitarian', 'engineering_civil', 'it_software', 'hr_admin'],
  },
  {
    id: 'agriculture_env',
    label: 'Agriculture & Environment',
    patterns: [
      /\bagricultur(?:e|al)\b/i,
      /\bagronom(?:y|ist)\b/i,
      /\bveterinar(?:y|ian)\b/i,
      /\bforestry\b/i,
      /\bfood security\b/i,
      /\benvironmental\b/i,
      /\bclimate\b/i,
      /\bhorticulture\b/i,
      /\blivestock\b/i,
      /\bagribusiness\b/i,
    ],
    relatedIds: ['ngo_humanitarian', 'manufacturing_ops'],
  },
  {
    id: 'skilled_trades',
    label: 'Skilled Trades & Driving',
    patterns: [
      /\bdriver\b/i,
      /\bdriving\b/i,
      /\bmechanic\b/i,
      /\belectrician\b/i,
      /\bplumber\b/i,
      /\bwelder\b/i,
      /\bcarpenter\b/i,
      /\bmason\b/i,
      /\bheavy equipment\b/i,
      /\bforklift\b/i,
      /\bsecurity guard\b/i,
      /\btechnician\b/i,
      /\bcleaner\b/i,
      /\bjanitor\b/i,
    ],
    relatedIds: ['engineering_electromech', 'engineering_civil', 'logistics_supply'],
  },
];

const PROFESSION_FAMILY_MAP = new Map(PROFESSION_FAMILIES.map((f) => [f.id, f]));

export function extractProfessionFamilies(text: string): ProfessionFamilyDef[] {
  if (!text || !text.trim()) return [];
  const matched: ProfessionFamilyDef[] = [];
  for (const fam of PROFESSION_FAMILIES) {
    const cleaned = fam.excludePattern ? text.replace(fam.excludePattern, ' ') : text;
    if (fam.patterns.some((rx) => rx.test(cleaned))) {
      matched.push(fam);
    }
  }
  return matched;
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

export function hasProfileExperienceSignals(profile: JobSeekerProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    (Array.isArray(profile.experience) && profile.experience.length > 0) ||
      (profile.currentPosition && profile.currentPosition.trim().length >= 2) ||
      (Array.isArray(profile.previousPositions) && profile.previousPositions.some((p) => p.trim().length >= 2)) ||
      (Array.isArray(profile.areasOfExpertise) && profile.areasOfExpertise.length > 0) ||
      (Array.isArray(profile.skills) && profile.skills.length > 0) ||
      (profile.desiredJobTitle && profile.desiredJobTitle.trim().length >= 2) ||
      (profile.preferredIndustry && profile.preferredIndustry.trim().length >= 2) ||
      (Array.isArray(profile.preferredSectors) && profile.preferredSectors.length > 0) ||
      (Array.isArray(profile.education) && profile.education.some((e) => (e.fieldOfStudy || '').trim().length >= 2))
  );
}

function getProfileExperienceText(profile: JobSeekerProfile): {
  primaryExperienceText: string;
  secondaryProfileText: string;
  allText: string;
} {
  const expEntriesText = (profile.experience || [])
    .map((e) => `${e.jobTitle || ''} ${e.companyName || ''} ${e.responsibilities || ''}`)
    .join(' ');
  const prevPosText = (profile.previousPositions || []).join(' ');
  const primaryExperienceText = [
    expEntriesText,
    profile.currentPosition || '',
    prevPosText,
    ...(profile.areasOfExpertise || []),
    ...(profile.skills || []),
  ]
    .filter(Boolean)
    .join(' ');

  const secondaryProfileText = [
    profile.desiredJobTitle || '',
    profile.preferredIndustry || '',
    ...(profile.preferredSectors || []),
    ...(profile.professionalInterests || []),
    ...(profile.education || []).map((e) => `${e.fieldOfStudy || ''} ${e.qualification || ''}`),
    ...(profile.certifications || []).map((c) => `${c.name || ''}`),
  ]
    .filter(Boolean)
    .join(' ');

  return {
    primaryExperienceText,
    secondaryProfileText,
    allText: `${primaryExperienceText} ${secondaryProfileText}`.trim(),
  };
}

function assessExperienceAgainstJobText(
  profile: JobSeekerProfile | null | undefined,
  jobCoreText: string,
  jobBroadText: string,
  requiredExperienceText: string | undefined
): ExperienceMatchAssessment {
  const empty: ExperienceMatchAssessment = {
    isMatch: false,
    matchType: 'none',
    score: 0,
    badgeLabel: '',
    matchedUserDomains: [],
    matchedJobDomains: [],
    meetsYearsRequirement: true,
  };
  if (!profile || !hasProfileExperienceSignals(profile)) return empty;

  const userExpYears = getProfileExplicitExperienceYears(profile);
  const reqYears = parseMinRequiredYears(requiredExperienceText);
  const meetsYearsRequirement = reqYears === null || userExpYears >= reqYears;
  const yearsGap = reqYears !== null ? reqYears - userExpYears : 0;
  const yearsWarning = !meetsYearsRequirement
    ? `Requires ${reqYears}+ yrs (profile has ${userExpYears} yrs)`
    : undefined;

  const { primaryExperienceText, allText } = getProfileExperienceText(profile);
  const primaryFamilies = extractProfessionFamilies(primaryExperienceText);
  const userFamilies =
    primaryFamilies.length > 0 ? primaryFamilies : extractProfessionFamilies(allText);

  const jobCoreFamilies = extractProfessionFamilies(jobCoreText);
  const jobFamilies =
    jobCoreFamilies.length > 0 ? jobCoreFamilies : extractProfessionFamilies(jobBroadText);

  const tokens = tokenizeProfileKeywords(profile);
  const jobLower = `${jobCoreText} ${jobBroadText}`.toLowerCase();

  const matchedTitleTokens = tokens.titleTokens.filter((t) => jobLower.includes(t));
  const matchedSkillTokens = Array.from(
    new Set([
      ...tokens.skillTokens.filter((s) => s.length >= 2 && jobLower.includes(s)),
      ...tokens.expertiseTokens.filter((s) => s.length >= 2 && jobLower.includes(s)),
      ...tokens.expertiseWordTokens.filter((w) => jobLower.includes(w)),
    ])
  );

  // 1. Direct Profession Family Match
  const directFamilies = userFamilies.filter((uf) => jobFamilies.some((jf) => jf.id === uf.id));

  // 2. Related Profession Family Match (e.g. Banking experience -> Finance job)
  let bestRelatedPair: { user: ProfessionFamilyDef; job: ProfessionFamilyDef } | null = null;
  if (directFamilies.length === 0) {
    for (const uf of userFamilies) {
      for (const jf of jobFamilies) {
        if (uf.relatedIds.includes(jf.id) || jf.relatedIds.includes(uf.id)) {
          bestRelatedPair = { user: uf, job: jf };
          break;
        }
      }
      if (bestRelatedPair) break;
    }
  }

  let matchType: 'direct' | 'related' | 'none' = 'none';
  let score = 0;
  let badgeLabel = '';

  if (directFamilies.length > 0 || matchedTitleTokens.length > 0 || matchedSkillTokens.length >= 2) {
    matchType = 'direct';
    const primaryLabel =
      directFamilies[0]?.label ||
      profile.currentPosition ||
      profile.areasOfExpertise?.[0] ||
      'Your Experience';
    score =
      72 +
      Math.min(18, directFamilies.length * 10) +
      Math.min(15, matchedTitleTokens.length * 6) +
      Math.min(12, matchedSkillTokens.length * 4);
    badgeLabel = `Matches ${primaryLabel} Experience`;
  } else if (bestRelatedPair) {
    matchType = 'related';
    score =
      58 +
      Math.min(10, matchedSkillTokens.length * 4) +
      Math.min(8, matchedTitleTokens.length * 4);
    badgeLabel = `Related Field: ${bestRelatedPair.user.label} → ${bestRelatedPair.job.label}`;
  } else if (matchedSkillTokens.length === 1) {
    matchType = 'related';
    score = 46;
    badgeLabel = `Related Skill: ${matchedSkillTokens[0]}`;
  }

  if (matchType === 'none') return empty;

  // Years adjustment: keep fully qualified jobs ranked highest
  if (meetsYearsRequirement) {
    score += 12;
  } else if (yearsGap <= 2) {
    score -= 6;
  } else if (yearsGap <= 5) {
    score -= 18;
  } else {
    // Large seniority gap: still demote cleanly; avoid false match when >6yr over profile
    score -= 32;
  }

  return {
    isMatch: true,
    matchType,
    score: Math.max(10, Math.min(100, score)),
    badgeLabel,
    matchedUserDomains: userFamilies.map((f) => f.label),
    matchedJobDomains: jobFamilies.map((f) => f.label),
    meetsYearsRequirement,
    yearsWarning,
  };
}

export function assessVacancyExperienceMatch(
  profile: JobSeekerProfile | null | undefined,
  v: Vacancy
): ExperienceMatchAssessment {
  const skillsArr = Array.isArray(v.requiredSkills)
    ? v.requiredSkills
    : v.requiredSkills
      ? [String(v.requiredSkills)]
      : [];
  const respArr = Array.isArray(v.responsibilities)
    ? v.responsibilities
    : v.responsibilities
      ? [String(v.responsibilities)]
      : [];
  const coreText = `${v.title || ''} ${v.category || ''} ${v.requiredFieldOfStudy || ''} ${skillsArr.join(' ')}`;
  const broadText = `${coreText} ${v.organization || ''} ${v.description || ''} ${respArr.join(' ')}`;
  return assessExperienceAgainstJobText(profile, coreText, broadText, v.experienceYears);
}

export function assessInternationalJobExperienceMatch(
  profile: JobSeekerProfile | null | undefined,
  ij: InternationalJob
): ExperienceMatchAssessment {
  const coreText = `${ij.jobTitle || ''} ${ij.category || ''} ${ij.requiredEducation || ''}`;
  const broadText = `${coreText} ${ij.employerOrProgramme || ''} ${ij.visaSponsorshipInfo || ''} ${ij.officialApplicationInstructions || ''}`;
  return assessExperienceAgainstJobText(profile, coreText, broadText, ij.requiredExperience);
}

function tokenizeProfileKeywords(profile: JobSeekerProfile) {
  const stopWords = new Set([
    'and',
    'the',
    'for',
    'with',
    'of',
    'in',
    'to',
    'at',
    'or',
    'on',
    'officer',
    'staff',
    'job',
    'senior',
    'junior',
    'assistant',
    'associate',
    'general',
    'service',
    'services',
    'company',
    'sector',
    'private',
    'public',
  ]);
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
    expertiseWordTokens: splitClean([...(profile.areasOfExpertise || []), ...(profile.skills || [])]),
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
      profile.noExperience === true ||
      (profile.yearsOfExperience && profile.yearsOfExperience.trim().length > 0) ||
      (profile.professionalInterests && profile.professionalInterests.length > 0) ||
      (profile.preferredSectors && profile.preferredSectors.length > 0) ||
      (profile.preferredIndustry && profile.preferredIndustry.trim().length >= 2)
  );
}

export function hasCompletedMandatoryPreferences(profile: JobSeekerProfile | null | undefined): boolean {
  if (!profile) return false;
  const hasExperienceStatus = Boolean(
    profile.noExperience === true ||
      (Array.isArray(profile.experience) && profile.experience.length > 0) ||
      (profile.currentPosition && profile.currentPosition.trim().length >= 2)
  );
  const hasYearsOfExperience = Boolean(
    profile.noExperience === true ||
      (profile.yearsOfExperience && /\d/.test(profile.yearsOfExperience))
  );
  const hasJobExpertise = Boolean(
    (Array.isArray(profile.areasOfExpertise) && profile.areasOfExpertise.length > 0) ||
      (Array.isArray(profile.skills) && profile.skills.length > 0)
  );
  return hasExperienceStatus && hasYearsOfExperience && hasJobExpertise;
}

export function isStrictJobFitForUser(rec: RecommendedOpportunity | null | undefined): boolean {
  if (!rec) return false;
  if (!rec.isFullyQualified) return false;
  if (rec.strictlyQualified === false) return false;
  return rec.matchScore >= 36;
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

    const roleAndReqText = `${v.title} ${v.requiredFieldOfStudy} ${(v.requiredSkills || []).join(' ')} ${v.description} ${(v.responsibilities || []).join(' ')} ${v.specialRequirements || ''}`.toLowerCase();
    const combinedText = `${roleAndReqText} ${v.organization} ${v.category}`.toLowerCase();
    const vacSectorTags = extractSectorTags(`${v.category} ${v.title} ${v.organization} ${v.description} ${v.isWashNgo ? 'wash' : ''}`);

    const missingMandatory: string[] = [];

    const reqYears = parseMinRequiredYears(v.experienceYears);
    if (reqYears !== null && reqYears > userExpYears) {
      missingMandatory.push(`Minimum ${reqYears} yrs experience required (profile has ${userExpYears} yrs)`);
    }

    const reqEduRank = detectEducationRank(v.educationQualification);
    if (reqEduRank > 0 && userEduRank < reqEduRank) {
      missingMandatory.push(`${RANK_LABELS[reqEduRank] || v.educationQualification} required`);
    }

    const licenseGaps = detectMissingMandatoryLicenses(
      `${v.specialRequirements || ''} ${v.educationQualification || ''} ${v.title || ''}`,
      profile
    );
    missingMandatory.push(...licenseGaps);

    let score = 0;
    const reasons: string[] = [];

    // Role & Position Match (checked strictly against job title & job requirements, not org/category name)
    const matchedTitleWords = tokens.titleTokens.filter((t) => roleAndReqText.includes(t));
    if (matchedTitleWords.length > 0) {
      score += Math.min(35, matchedTitleWords.length * 14);
      reasons.push(`Role alignment: ${matchedTitleWords.slice(0, 3).join(', ')}`);
    }

    // Sector / Category Match (supports multi-sector & WASH/NGO/Banking/Embassies/Airlines/etc.)
    const matchedSectorTag = tokens.preferredSectorTags.find((tag) => tag !== 'other' && vacSectorTags.includes(tag));
    const directSectorMatch = tokens.preferredSectorsRaw.some((sec) =>
      sec.split(/[\s,/&]+/).some((w) => w.length > 2 && !/^(other|all|any|general|sector)$/i.test(w) && `${v.category} ${v.title}`.toLowerCase().includes(w))
    );
    if (matchedSectorTag || directSectorMatch) {
      score += 24;
      reasons.push(
        v.isWashNgo
          ? 'Preferred Sector: WASH / Humanitarian NGO'
          : `Preferred Sector: ${v.category}`
      );
    }

    // Skills & Areas of Expertise Match (exact phrase + tokenized keywords checked against role & requirements)
    const matchedSkillPhrases = [...tokens.skillTokens, ...tokens.expertiseTokens].filter(
      (s) => s.length >= 2 && roleAndReqText.includes(s.toLowerCase())
    );
    const matchedExpertiseWords = tokens.expertiseWordTokens.filter((w) => roleAndReqText.includes(w));
    const matchedSkills = Array.from(
      new Set([
        ...matchedSkillPhrases,
        ...matchedExpertiseWords,
      ])
    );
    if (matchedSkills.length > 0) {
      score += Math.min(34, matchedSkillPhrases.length * 12 + matchedExpertiseWords.length * 8);
      reasons.push(`Matching expertise/skills: ${matchedSkills.slice(0, 3).join(', ')}`);
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

    // Experience & Related-Profession Match (e.g. Banking -> Banking & Finance/Accounting)
    const expAssessment = assessVacancyExperienceMatch(profile, v);
    if (expAssessment.isMatch && expAssessment.matchType === 'direct') {
      score += 24;
      reasons.push(expAssessment.badgeLabel);
    } else if (expAssessment.isMatch && expAssessment.matchType === 'related') {
      score += 22;
      reasons.push(expAssessment.badgeLabel);
    }

    // Direct role, expertise, skill, study, certification, or experience-family fit
    const hasDirectDomainFit =
      matchedTitleWords.length > 0 ||
      matchedSkills.length > 0 ||
      matchedStudy.length > 0 ||
      matchedCerts.length > 0 ||
      expAssessment.isMatch;

    // Exclude unrelated jobs from recommendations when score is weak or there is no genuine domain/sector connection
    const hasRelevantMatch =
      hasDirectDomainFit || Boolean(matchedSectorTag || directSectorMatch);

    if (!hasRelevantMatch || score < 24 || reasons.length === 0) continue;

    // Exclude severely under-qualified jobs (e.g. PhD/Master's when rank < Bachelor's, or >5yr gap)
    if (reqYears !== null && reqYears - userExpYears > 5) continue;
    if (reqEduRank >= EDUCATION_RANK.phd && userEduRank < EDUCATION_RANK.master) continue;

    const isFullyQualified = missingMandatory.length === 0;
    const adjustedScore = isFullyQualified
      ? Math.min(99, score)
      : Math.max(30, Math.min(82, score - missingMandatory.length * 10));
    const strictlyQualified = isFullyQualified && hasDirectDomainFit && adjustedScore >= 36;

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
      strictlyQualified,
      matchReasons: Array.from(new Set(reasons)).slice(0, 5),
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
    const matchedSkillPhrases = [...tokens.skillTokens, ...tokens.expertiseTokens].filter((s) =>
      combinedText.includes(s)
    );
    const matchedExpertiseWords = tokens.expertiseWordTokens.filter((w) => combinedText.includes(w));
    const matchedSkills = Array.from(new Set([...matchedSkillPhrases, ...matchedExpertiseWords]));
    if (matchedSkills.length > 0) {
      score += Math.min(30, matchedSkillPhrases.length * 12 + matchedExpertiseWords.length * 8);
      reasons.push(`Skill/expertise alignment: ${matchedSkills.slice(0, 3).join(', ')}`);
    }
    const expAssessment = assessInternationalJobExperienceMatch(profile, ij);
    if (expAssessment.isMatch && expAssessment.matchType === 'direct') {
      score += 30;
      reasons.push(expAssessment.badgeLabel);
    } else if (expAssessment.isMatch && expAssessment.matchType === 'related') {
      score += 26;
      reasons.push(expAssessment.badgeLabel);
    }
    if (reqYears !== null && userExpYears >= reqYears) {
      score += 10;
      if (reqYears > 0) reasons.push(`Meets ${reqYears}+ yrs experience requirement`);
    }
    if (reqEduRank > 0 && userEduRank >= reqEduRank && userEduLabel) {
      score += 10;
      reasons.push(`Education eligible (${userEduLabel})`);
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

    const hasDirectDomainFit =
      matchedTitle.length > 0 || matchedSkills.length > 0 || expAssessment.isMatch;

    if (score >= 28 && reasons.length >= 1 && hasDirectDomainFit) {
      if (reqYears !== null && reqYears - userExpYears > 5) continue;
      const isFullyQualified = missingMandatory.length === 0;
      const adjustedScore = isFullyQualified ? Math.min(99, score) : Math.max(30, score - 12);
      results.push({
        id: ij.id,
        sourceType: 'international_job',
        title: ij.jobTitle,
        organization: ij.employerOrProgramme,
        location: `${ij.location}, ${ij.country}`,
        category: ij.category || 'International Recruitment',
        salary: ij.salary && !/not stated/i.test(ij.salary) ? ij.salary : undefined,
        deadline: ij.applicationDeadline,
        matchScore: adjustedScore,
        eligibilityStatus: isFullyQualified ? 'Eligible' : 'Partially Qualified',
        isFullyQualified,
        strictlyQualified: isFullyQualified && adjustedScore >= 36 && hasDirectDomainFit,
        matchReasons: Array.from(new Set(reasons)),
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
      const adjustedScore = isFullyQualified ? Math.min(99, score) : Math.max(30, score - 12);
      results.push({
        id: sc.id,
        sourceType: 'scholarship',
        title: sc.scholarshipName,
        organization: sc.universityOrInstitution,
        location: sc.country,
        category: `Scholarship (${sc.studyLevel})`,
        deadline: sc.applicationDeadline,
        matchScore: adjustedScore,
        eligibilityStatus: isFullyQualified ? 'Eligible' : 'Partially Qualified',
        isFullyQualified,
        strictlyQualified: isFullyQualified && adjustedScore >= 36 && (matchedStudy.length > 0 || matchedDomain.length > 0),
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
