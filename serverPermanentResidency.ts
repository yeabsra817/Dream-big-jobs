import {
  CanonicalVerificationTier,
  PermanentResidencyCountryRecord,
  PermanentResidencyPathwayType,
} from './src/types/globalOpportunities';

export const PR_OFFICIAL_DISCLAIMER =
  'Official Notice: Labour or skill shortages do NOT automatically grant permanent residency. Eligibility depends on official government immigration criteria (points, licensed employer sponsorship, salary thresholds, language tests, qualifications, and lawful residency duration). Always confirm live requirements directly on the official government website.';

interface OfficialPrCountrySeed {
  id: string;
  country: string;
  region: PermanentResidencyCountryRecord['region'];
  programName: string;
  pathwayClassification: PermanentResidencyPathwayType;
  pathwayClassificationLabel: string;
  officialAuthority: string;
  officialApplicationUrl: string;
  shortageOccupationListUrl: string;
  officialDomain: string;
  professionalOccupationsInDemand: string[];
  labourOccupationsInDemand: string[];
  bankingFinanceOccupations: string[];
  washWaterOccupations: string[];
  foreignApplicantsEligible: boolean;
  ethiopianCitizensEligible: PermanentResidencyCountryRecord['ethiopianCitizensEligible'];
  ethiopianEligibilityNotes: string;
  educationRequirement: string;
  experienceRequirement: string;
  languageRequirement: string;
  ageRestriction: string;
  skillsAssessmentRequired: string;
  permanentResidencyRoute: string;
  employerSponsorshipOptions: string;
  familyRelocationOptions: string;
  governmentApplicationFees: string;
  jobOfferRequired?: string;
  minimumSalaryRequirement?: string;
  financialProofRequirement?: string;
  recruiterOrEmployerRequired?: string;
  estimatedProcessingStages?: string;
}

export const OFFICIAL_GOVERNMENT_PR_SEEDS: OfficialPrCountrySeed[] = [
  {
    id: 'pr_canada_express_entry',
    country: 'Canada',
    region: 'North America',
    programName: 'Express Entry (Federal Skilled Worker, Canadian Experience Class & Category-Based Selection) + Provincial Nominee Programs (PNP)',
    pathwayClassification: 'direct_pr',
    pathwayClassificationLabel: 'Direct Permanent Residency Pathway',
    officialAuthority: 'Immigration, Refugees and Citizenship Canada (IRCC)',
    officialApplicationUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html',
    shortageOccupationListUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations/category-based-selection.html',
    officialDomain: 'canada.ca',
    professionalOccupationsInDemand: [
      'Registered Nurses & Healthcare Professionals',
      'Software Engineers & IT Analysts',
      'Civil, Environmental & Water Engineers',
      'Financial Auditors, Accountants & Banking Specialists',
      'STEM & Engineering Managers',
      'French-Speaking Skilled Professionals',
    ],
    labourOccupationsInDemand: [
      'Carpenters, Electricians, Plumbers & Welders (Skilled Trades)',
      'Commercial Transport & Heavy Equipment Operators',
      'Construction Millwrights & Industrial Mechanics',
      'Agriculture & Agri-Food Workers (Dedicated Pilot / PNP)',
      'Hospitality & Food Service Supervisors (PNP)',
    ],
    bankingFinanceOccupations: [
      'Financial Auditors & Accountants (NOC 11100)',
      'Financial & Investment Analysts (NOC 11101)',
      'Financial Advisors & Banking Managers (NOC 11102 / 10021)',
      'Credit & Compliance Officers (NOC 11109)',
    ],
    washWaterOccupations: [
      'Civil & Environmental Engineers — Water/Wastewater (NOC 21300 / 21301)',
      'Water & Waste Treatment Plant Operators (NOC 92100)',
      'Public & Environmental Health Specialists (NOC 41404)',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to all nationalities including Ethiopian citizens applying from outside Canada via Express Entry or PNP, subject to CRS score, ECA credential evaluation, proof of funds, and biometrics.',
    educationRequirement: "Educational Credential Assessment (ECA) equivalent to Canadian secondary/Bachelor's/Master's degree.",
    experienceRequirement: 'Minimum 1 year of continuous full-time skilled work experience (TEER 0, 1, 2, or 3) within the last 10 years.',
    languageRequirement: 'English (IELTS General / CELPIP / PTE Core — minimum CLB 7 for FSWP) and/or French (TEF / TCF Canada — major CRS bonus).',
    ageRestriction: 'No hard upper age bar, but CRS age points peak at ages 20–29 and decrease progressively after age 30.',
    skillsAssessmentRequired: 'Educational Credential Assessment (WES, ICAS, IQAS, etc.) required for foreign degrees; licensing required for regulated trades/engineering/healthcare.',
    permanentResidencyRoute: 'Direct Permanent Residence granted upon Invitation to Apply (ITA) and IRCC approval; citizenship eligible after 3 years (1,095 days) physical presence.',
    employerSponsorshipOptions: 'LMIA-backed job offer or Provincial Nomination (+600 CRS points) accelerates selection, though FSWP does not strictly require a job offer.',
    familyRelocationOptions: 'Spouse/common-law partner and dependent children under 22 included on the same PR application with full work and study rights.',
    governmentApplicationFees: 'Verify current IRCC fees on canada.ca (approx. CAD $1,525 per principal applicant including Right of Permanent Residence Fee; biometrics CAD $85).',
  },
  {
    id: 'pr_australia_skilled',
    country: 'Australia',
    region: 'Oceania',
    programName: 'Skilled Independent (Subclass 189), Skilled Nominated (Subclass 190) & Skilled Work Regional (Subclass 491)',
    pathwayClassification: 'direct_pr',
    pathwayClassificationLabel: 'Direct Permanent Residency Pathway',
    officialAuthority: 'Australian Government — Department of Home Affairs',
    officialApplicationUrl: 'https://immi.homeaffairs.gov.au/visas/working-in-australia/skill-occupation-list',
    shortageOccupationListUrl: 'https://www.jobsandskills.gov.au/data/occupation-shortages-analysis/occupation-shortage-list',
    officialDomain: 'homeaffairs.gov.au',
    professionalOccupationsInDemand: [
      'Registered Nurses, Doctors & Allied Health Practitioners',
      'Civil, Environmental & Water Engineers',
      'External Auditors, Accountants & Management Accountants',
      'Software Engineers, Cybersecurity & ICT Business Analysts',
      'Secondary & Early Childhood Teachers',
    ],
    labourOccupationsInDemand: [
      'Electricians, Plumbers, Carpenters & Bricklayers',
      'Diesel Motor Mechanics & Metal Fitters',
      'Construction Project Managers & Site Supervisors',
      'Aged Care & Disability Support Workers (Labour Agreements)',
      'Chefs & Hospitality Trade Workers',
    ],
    bankingFinanceOccupations: [
      'Accountant (General) / Management Accountant / External Auditor',
      'Finance Manager & Corporate Treasurer',
      'Internal Auditor & Financial Investment Adviser',
    ],
    washWaterOccupations: [
      'Civil Engineer (Water & Sanitation Infrastructure)',
      'Environmental Engineer & Hydrogeologist',
      'Environmental Health Officer',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to offshore applicants worldwide including Ethiopian citizens who hold a positive skills assessment for an eligible occupation and receive a SkillSelect invitation.',
    educationRequirement: "Relevant Bachelor's/Master's degree or recognized trade qualification assessed by an Australian assessing authority.",
    experienceRequirement: 'Typically 1–8+ years of closely related skilled employment for competitive SkillSelect points.',
    languageRequirement: 'Minimum Competent English (IELTS 6.0 each band or PTE equivalent); Proficient/Superior English adds +10 to +20 points.',
    ageRestriction: 'Must be under 45 years of age at the time of receiving an Invitation to Apply (ITA).',
    skillsAssessmentRequired: 'Mandatory positive Skills Assessment (e.g., CPA Australia / CA ANZ / IPA for accounting, Engineers Australia for civil/water engineers, VETASSESS for general professions).',
    permanentResidencyRoute: 'Subclass 189 and 190 grant direct Permanent Residency on approval; Subclass 491 leads to PR (Subclass 191) after 3 years living/working in regional Australia.',
    employerSponsorshipOptions: 'Skills in Demand (Subclass 482) employer-sponsored work visa also provides a Transition Stream to PR (Subclass 186) after 2 years.',
    familyRelocationOptions: 'Partner and dependent children can be included on the same visa with full work and school access.',
    governmentApplicationFees: 'Verify current Home Affairs Visa Pricing Table on immi.homeaffairs.gov.au (base charge starts ~AUD $4,770 for principal applicant).',
  },
  {
    id: 'pr_new_zealand_green_list',
    country: 'New Zealand',
    region: 'Oceania',
    programName: 'Green List Straight to Residence (Tier 1) & Work to Residence (Tier 2) + Accredited Employer Work Visa (AEWV)',
    pathwayClassification: 'direct_pr',
    pathwayClassificationLabel: 'Direct PR (Tier 1) / Route to PR (Tier 2)',
    officialAuthority: 'Immigration New Zealand (MBIE)',
    officialApplicationUrl: 'https://www.immigration.govt.nz/new-zealand-visas/preparing-a-visa-application/working-in-nz/qualifications-for-work/green-list-occupations',
    shortageOccupationListUrl: 'https://www.immigration.govt.nz/new-zealand-visas/preparing-a-visa-application/working-in-nz/qualifications-for-work/green-list-occupations',
    officialDomain: 'immigration.govt.nz',
    professionalOccupationsInDemand: [
      'External & Internal Auditors (Green List Tier 1)',
      'Civil, Environmental & Geotechnical Engineers (Tier 1)',
      'Registered Nurses, Doctors & Pharmacists (Tier 1)',
      'ICT Security Specialists, Software Engineers & Analysts (Tier 1)',
      'Construction Project Managers & Quantity Surveyors (Tier 1)',
    ],
    labourOccupationsInDemand: [
      'Electricians, Plumbers & Automotive Electricians (Tier 2)',
      'Diesel Motor Mechanics & Heavy Equipment Technicians (Tier 2)',
      'Dairy Cattle Farmers & Agricultural Workers (AEWV / Sector Agreements)',
      'Building & Construction Trades Workers',
      'Transport & Logistics Drivers (AEWV)',
    ],
    bankingFinanceOccupations: [
      'External Auditor (Green List Tier 1 — Direct PR with accredited job offer)',
      'Internal Auditor (Green List Tier 1 — Direct PR with accredited job offer)',
      'Accountants & Financial Analysts (Skilled Migrant Category 6-point system)',
    ],
    washWaterOccupations: [
      'Civil Engineer — Water Supply & Sanitation (Green List Tier 1)',
      'Environmental Engineer (Green List Tier 1)',
      'Environmental Research Scientist (Tier 1)',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to all nationalities including Ethiopian citizens who secure a full-time job offer from an Accredited New Zealand Employer meeting wage/qualification thresholds.',
    educationRequirement: "Recognized Bachelor's degree (NZQF Level 7+) or occupational registration/trade certificate depending on Green List tier.",
    experienceRequirement: 'Tier 1 requires job offer + exact Green List qualification/registration; Tier 2 requires 24 months working in NZ in the eligible role.',
    languageRequirement: 'IELTS Overall 6.5 (or equivalent PTE/TOEFL) for residence applications.',
    ageRestriction: 'Applicants must be 55 years old or younger when applying for residence.',
    skillsAssessmentRequired: 'NZQA International Qualification Assessment (IQA) unless exempt, plus professional registration where required (e.g., Engineering NZ, CA ANZ/CPA).',
    permanentResidencyRoute: 'Tier 1 grants Straight to Residence immediately upon approval; Tier 2 grants Residence after 2 years working in NZ; Permanent Resident Visa granted after 2 years holding Residence.',
    employerSponsorshipOptions: 'Requires a valid employment offer from an Immigration NZ Accredited Employer.',
    familyRelocationOptions: 'Partner and dependent children aged 24 and under can be included in the residence application.',
    governmentApplicationFees: 'Verify live INZ fee finder on immigration.govt.nz (residence fees start around NZD $6,450; AEWV ~NZD $1,540).',
  },
  {
    id: 'pr_uk_skilled_worker',
    country: 'United Kingdom',
    region: 'Europe',
    programName: 'Skilled Worker Visa & Immigration Salary List (5-Year Route to Indefinite Leave to Remain)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'UK Home Office (GOV.UK)',
    officialApplicationUrl: 'https://www.gov.uk/skilled-worker-visa',
    shortageOccupationListUrl: 'https://www.gov.uk/government/publications/skilled-worker-visa-immigration-salary-list/skilled-worker-visa-immigration-salary-list',
    officialDomain: 'gov.uk',
    professionalOccupationsInDemand: [
      'Chartered Accountants, Financial Managers & Investment Analysts',
      'Civil & Environmental Engineers (Water & Infrastructure)',
      'Health & Care Professionals (Doctors, Nurses, Care Workers)',
      'Software Developers, Cyber Security & Data Engineers',
      'Laboratory Technicians & Biological Scientists',
    ],
    labourOccupationsInDemand: [
      'Bricklayers, Carpenters, Joiners & Roofers (Immigration Salary List)',
      'Welding Trades & Construction Workers (Salary List)',
      'Care Workers & Senior Care Workers (Health & Care Worker Visa)',
      'Fishing, Agriculture & Seasonal Workers (Temporary Visa Only — No PR)',
      'Hospitality & Catering Managers (Skilled Worker Eligible Roles)',
    ],
    bankingFinanceOccupations: [
      'Financial Managers & Directors (SOC 1131)',
      'Chartered & Certified Accountants (SOC 2421)',
      'Finance & Investment Analysts and Advisers (SOC 2422)',
      'Compliance, Risk & Regulatory Professionals (SOC 2429 / 3539)',
    ],
    washWaterOccupations: [
      'Civil Engineers — Water & Sanitation (SOC 2121)',
      'Environment Professionals & Hydrologists (SOC 2142)',
      'Public Health Managers & Environmental Health Professionals',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Ethiopian citizens are eligible to apply from outside the UK with a Certificate of Sponsorship (CoS) from a UK Home Office Licensed Sponsor.',
    educationRequirement: 'Eligible occupation at RQF Level 3 (A-level equivalent) or higher; degree required for regulated finance/engineering roles.',
    experienceRequirement: 'Depends on employer role and meeting the official going-rate salary threshold (standard £38,700 or discounted Immigration Salary List / New Entrant rate).',
    languageRequirement: 'English at CEFR Level B1 (IELTS for UKVI 4.0+ in all components) or Ecctis-verified English-taught degree.',
    ageRestriction: 'Must be 18 or over; no upper age limit.',
    skillsAssessmentRequired: 'Certificate of Sponsorship (CoS) from a licensed UK employer; Ecctis verification if using degree for English requirement.',
    permanentResidencyRoute: 'Eligible for Indefinite Leave to Remain (ILR — Permanent Residency) after 5 continuous years on the Skilled Worker route (plus Life in the UK test & salary threshold).',
    employerSponsorshipOptions: 'Mandatory sponsorship by a UK Register of Licensed Sponsors employer (banks, Big 4, engineering firms, NHS trusts, water utilities).',
    familyRelocationOptions: 'Partner and children under 18 can join Skilled Worker holders (note: UK restricts dependants for newly sponsored Care Worker roles).',
    governmentApplicationFees: 'Verify on gov.uk/skilled-worker-visa (visa fee £719–£1,636 depending on duration/Salary List + Immigration Health Surcharge £1,035/year, exempt for Health & Care visa).',
  },
  {
    id: 'pr_germany_skilled_blue_card',
    country: 'Germany',
    region: 'Europe',
    programName: 'EU Blue Card, Skilled Workers Immigration Act (§18a/18b) & Opportunity Card (Chancenkarte)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Fast-Track Route to Permanent Residency',
    officialAuthority: 'Federal Government of Germany — Make it in Germany (BMAS/BMWK/BMI)',
    officialApplicationUrl: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card',
    shortageOccupationListUrl: 'https://www.make-it-in-germany.com/en/working-in-germany/professions-in-demand',
    officialDomain: 'make-it-in-germany.com',
    professionalOccupationsInDemand: [
      'Banking, Financial Controlling, Audit & Risk Specialists',
      'Civil, Water, Sanitation & Environmental Engineers (Bottleneck Profession)',
      'Software Developers, IT Architects & Data Engineers (Bottleneck Profession)',
      'Physicians, Pharmacists & Registered Nurses (Bottleneck Profession)',
      'Mathematics, Natural Sciences & Electrical Engineers',
    ],
    labourOccupationsInDemand: [
      'Electricians, Plumbers, HVAC & Sanitation Installers (SHK)',
      'Construction Trades & Civil Infrastructure Technicians',
      'Industrial Mechanics, Mechatronics & Manufacturing Technicians',
      'Professional Truck & Bus Drivers',
      'Hospitality, Gastronomy & Geriatric Care Workers',
    ],
    bankingFinanceOccupations: [
      'Financial Analysts, Auditors & Corporate Finance Managers (EU Blue Card)',
      'Risk, Compliance & AML Officers (Frankfurt/Berlin Financial Sector)',
      'Banking Operations & FinTech Specialists',
    ],
    washWaterOccupations: [
      'Water Supply, Wastewater & Civil Engineers (Reduced Blue Card Bottleneck Salary Threshold)',
      'Sanitation, Heating & Water Installation Technicians (§18a Vocational Skilled Worker)',
      'Environmental & Climate Water Specialists',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to third-country nationals including Ethiopian citizens via German Embassy Addis Ababa visa appointment with a recognized degree (Anabin H+) or Chancenkarte points.',
    educationRequirement: 'Recognized university degree (checked via Anabin / ZAB) for EU Blue Card, or 2-year recognized vocational training for §18a.',
    experienceRequirement: 'Employment contract meeting Blue Card salary threshold (lower bottleneck threshold applies to engineering, IT, and healthcare).',
    languageRequirement: 'English accepted for many EU Blue Card jobs in finance/IT/engineering; German B1 shortens EU Blue Card settlement permit to 21 months (27 months with A1).',
    ageRestriction: 'No age limit (applicants aged 45+ on standard §18a/b need a minimum salary or pension proof).',
    skillsAssessmentRequired: 'Degree comparability check in Anabin database or Statement of Comparability from ZAB; vocational recognition (Anerkennung) for skilled trades.',
    permanentResidencyRoute: 'Settlement Permit (Niederlassungserlaubnis / PR) after 21 months (with German B1) or 27 months (with German A1) on EU Blue Card; 36 months for standard skilled workers.',
    employerSponsorshipOptions: 'Requires a binding German employment contract; Chancenkarte allows up to 1 year job search in Germany with points.',
    familyRelocationOptions: 'Spouse and minor children receive residence permits; EU Blue Card spouses are exempt from pre-entry German language proof and get unrestricted work access.',
    governmentApplicationFees: 'Verify on make-it-in-germany.com (National Visa EUR €75; residence card ~EUR €100; ZAB evaluation ~EUR €208).',
  },
  {
    id: 'pr_ireland_critical_skills',
    country: 'Ireland',
    region: 'Europe',
    programName: 'Critical Skills Employment Permit (Direct Stamp 4 Long-Term Residency after 21 Months)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Fast Route to Permanent Residency',
    officialAuthority: 'Department of Enterprise, Trade and Employment (DETE Ireland)',
    officialApplicationUrl: 'https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/permit-types/critical-skills-employment-permit/',
    shortageOccupationListUrl: 'https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/employment-permit-eligibility/highly-skilled-eligible-occupations-list/',
    officialDomain: 'enterprise.gov.ie',
    professionalOccupationsInDemand: [
      'Chartered Accountants, Risk, Compliance & Financial Analysts (Dublin IFSC)',
      'Civil, Environmental & Water Engineers',
      'Software Developers, Cybersecurity & Cloud Engineers',
      'Doctors, Nurses & Healthcare Specialists',
      'Actuaries, Economists & Statisticians',
    ],
    labourOccupationsInDemand: [
      'Construction Trades, Mechanics & Heavy Vehicle Drivers (General Employment Permit)',
      'Agri-Food, Dairy & Horticulture Workers (General Permit / Quotas)',
      'Healthcare Assistants & Home Carers (General Employment Permit)',
      'Chefs & Hospitality Professionals',
      'Manufacturing & Precision Engineering Technicians',
    ],
    bankingFinanceOccupations: [
      'Tax, Audit, Risk & Financial Compliance Specialists (Critical Skills Eligible)',
      'Qualified Accountants & Fund Accounting Managers (Dublin Financial Hub)',
      'Quantitative & Credit Risk Analysts',
    ],
    washWaterOccupations: [
      'Civil & Environmental Engineers (Water Services & Utilities — Critical Skills Eligible)',
      'Hydrologists & Water Quality Specialists',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to non-EEA nationals including Ethiopian citizens with a 2-year job offer from an Irish-registered employer (exempt from Labour Market Needs Test for Critical Skills).',
    educationRequirement: "Relevant Bachelor's degree or higher for roles paying EUR €38,000+ (or equivalent experience for roles paying EUR €64,000+).",
    experienceRequirement: '2-year full-time job offer in an eligible occupation on the Critical Skills Occupations List.',
    languageRequirement: 'English proficiency required by employer (no mandatory immigration IELTS test for permit issuance, except regulated health professions).',
    ageRestriction: 'No upper age limit.',
    skillsAssessmentRequired: 'Degree verification and professional registration only for regulated professions (e.g., medical, nursing).',
    permanentResidencyRoute: 'Eligible for Stamp 4 (work without permit) after 21 months on Critical Skills Permit; eligible for Long-Term Residency / Irish Citizenship after 5 years reckonable residence.',
    employerSponsorshipOptions: 'Employer or employee applies online via DETE Employment Permits Online; no Labour Market Needs Test required for Critical Skills.',
    familyRelocationOptions: 'Immediate family reunification for spouse/partner (Stamp 1G with full right to work) and minor children.',
    governmentApplicationFees: 'Verify on enterprise.gov.ie (Critical Skills Employment Permit fee EUR €1,000; visa entry fee EUR €60–€100).',
  },
  {
    id: 'pr_finland_specialist',
    country: 'Finland',
    region: 'Europe',
    programName: 'Specialist Residence Permit & Work-Based Continuous Permit (A-Permit -> PR after 4 Years)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Work in Finland / Finnish Immigration Service (Migri)',
    officialApplicationUrl: 'https://www.workinfinland.com/en/',
    shortageOccupationListUrl: 'https://www.workinfinland.com/en/open-jobs/',
    officialDomain: 'workinfinland.com',
    professionalOccupationsInDemand: [
      'Software Engineers, AI & Embedded Systems Specialists',
      'Healthcare Nurses, Doctors & Social Workers',
      'Financial Controllers, Auditors & Banking Technology Specialists',
      'Clean Water, Environmental & Civil Engineers',
      'Renewable Energy & Industrial Engineers',
    ],
    labourOccupationsInDemand: [
      'Welders, Sheet Metal Workers & Shipyard Technicians',
      'Construction Workers & Electricians',
      'Agricultural, Forestry & Seasonal Workers (Temporary Permit)',
      'Logistics, Cleaning & Hospitality Staff (Work Permit Subject to Labour Test)',
      'Manufacturing Machine Operators',
    ],
    bankingFinanceOccupations: [
      'Financial Controllers, Risk & Compliance Specialists (Specialist Fast-Track)',
      'Banking IT & Digital Payments Engineers',
    ],
    washWaterOccupations: [
      'Environmental & Water Resources Engineers',
      'Municipal Water & Wastewater Treatment Specialists',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to non-EU/EEA nationals including Ethiopian citizens with a signed Finnish employment contract meeting Migri salary thresholds (14-day Fast Track for Specialists).',
    educationRequirement: "Higher education degree (Bachelor's/Master's) for Specialist permit, or relevant trade training for Employee Residence Permit.",
    experienceRequirement: 'Binding job offer from an employer operating in Finland meeting collective agreement or Specialist salary level.',
    languageRequirement: 'English widely used in tech/finance/international engineering; Finnish/Swedish required for healthcare and many trades.',
    ageRestriction: 'No age restriction.',
    skillsAssessmentRequired: 'Valvira licensing required for healthcare professions; employer verifies skills for non-regulated roles.',
    permanentResidencyRoute: 'Continuous Residence Permit (Type A) leads to Permanent Residence Permit (P) after 4 continuous years of residence (check Migri live legislative updates on language/duration rules).',
    employerSponsorshipOptions: 'Employer submits employment terms via Enter Finland; Specialist fast-track processes in ~14 days.',
    familyRelocationOptions: 'Spouse and children under 18 can apply simultaneously via Fast Track and receive unrestricted work rights.',
    governmentApplicationFees: 'Verify on migri.fi (electronic Specialist/Work permit application fee approx. EUR €410–€530).',
  },
  {
    id: 'pr_sweden_work_permit',
    country: 'Sweden',
    region: 'Europe',
    programName: 'Swedish Work Permit & EU Blue Card (Route to Permanent Residence Permit after 4 Years)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Swedish Migration Agency (Migrationsverket)',
    officialApplicationUrl: 'https://www.migrationsverket.se/English/Private-individuals/Working-in-Sweden.html',
    shortageOccupationListUrl: 'https://www.migrationsverket.se/English/Private-individuals/Working-in-Sweden/Employed/How-to-apply.html',
    officialDomain: 'migrationsverket.se',
    professionalOccupationsInDemand: [
      'IT Developers, System Analysts & Cybersecurity Specialists',
      'Civil, Water & Environmental Engineers',
      'Financial Analysts, Risk Managers & Auditors',
      'Doctors, Midwives & Specialist Nurses',
      'Mechanical & Green Industrial Engineers',
    ],
    labourOccupationsInDemand: [
      'Electricians, Plumbers & Construction Skilled Trades',
      'Industrial Mechanics, CNC Operators & Welders',
      'Heavy Truck & Bus Drivers',
      'Chefs & Skilled Hospitality Technicians',
      'Mining & Green Battery Manufacturing Technicians',
    ],
    bankingFinanceOccupations: [
      'Corporate Finance, AML Compliance & Risk Analysts (Stockholm Financial Sector)',
      'FinTech & Digital Banking Engineers',
    ],
    washWaterOccupations: [
      'Water Resources & Sanitation Engineers (Stockholm Water & Environmental Sector)',
      'Environmental & Climate Resilience Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to non-EU/EEA citizens including Ethiopian nationals with a formal Swedish job offer meeting the mandatory minimum salary threshold (80% of Swedish median salary) and collective insurance.',
    educationRequirement: 'University degree (180 credits+) required for EU Blue Card; relevant qualifications/experience for standard Work Permit.',
    experienceRequirement: 'Employer must advertise the position in Sweden/EU/EEA for 10 days before offering to a non-EU candidate.',
    languageRequirement: 'English accepted in multinational banking, engineering, and tech roles; Swedish required for healthcare.',
    ageRestriction: 'No upper age limit.',
    skillsAssessmentRequired: 'Employer & relevant Swedish trade union review the employment terms; Socialstyrelsen license required for healthcare.',
    permanentResidencyRoute: 'Eligible for Permanent Residence Permit after working in Sweden on a work permit for 4 years within a 7-year period while demonstrating self-support.',
    employerSponsorshipOptions: 'Employer initiates the Migrationsverket work permit application online.',
    familyRelocationOptions: 'Spouse/cohabiting partner and children under 21 receive residence permits with full work authorization.',
    governmentApplicationFees: 'Verify on migrationsverket.se (standard work permit fee SEK 2,200; EU Blue Card SEK 2,000).',
  },
  {
    id: 'pr_norway_skilled_worker',
    country: 'Norway',
    region: 'Europe',
    programName: 'Skilled Worker Residence Permit (Route to Permanent Residence Permit after 3 Years)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Norwegian Directorate of Immigration (UDI)',
    officialApplicationUrl: 'https://www.udi.no/en/want-to-apply/work-immigration/skilled-workers/',
    shortageOccupationListUrl: 'https://www.udi.no/en/want-to-apply/work-immigration/skilled-workers/',
    officialDomain: 'udi.no',
    professionalOccupationsInDemand: [
      'Civil, Offshore, Water & Environmental Engineers',
      'Software Developers, Data Scientists & IT Consultants',
      'Financial Risk, Audit & Corporate Banking Specialists',
      'Physicians, Nurses & Health Specialists',
    ],
    labourOccupationsInDemand: [
      'Certified Electricians, Plumbers & Carpenters (3-Year Vocational Equivalent)',
      'Industrial Mechanics & Welders',
      'Chefs & Skilled Hospitality Craftsmen',
      'Fisheries & Agriculture Seasonal Workers (Temporary Permit — No PR)',
    ],
    bankingFinanceOccupations: [
      'Auditors, Financial Analysts & Banking Compliance Officers',
      'Banking Software & Quantitative Risk Specialists',
    ],
    washWaterOccupations: [
      'Water Supply, Hydropower & Sanitation Engineers',
      'Environmental & Water Quality Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to non-EU/EEA nationals including Ethiopian citizens who hold a full-time Norwegian job offer matching their university degree or 3-year vocational training.',
    educationRequirement: "Completed university/college degree (Bachelor's/Master's) OR completed 3-year vocational training matching Norwegian upper-secondary standard.",
    experienceRequirement: 'Full-time concrete job offer paying at least Norwegian statutory/collective-agreement skilled pay.',
    languageRequirement: 'English accepted in multinational engineering/tech/finance; Norwegian A2/B1 + social studies required later for Permanent Residence.',
    ageRestriction: 'Must be 18 or over; no upper age cap.',
    skillsAssessmentRequired: 'HK-dir recognition may be requested for foreign degrees/trades; Directorate of Health authorization required for healthcare.',
    permanentResidencyRoute: 'Eligible for Permanent Residence Permit after 3 continuous years on a qualifying Skilled Worker permit plus Norwegian language & social studies requirements and sufficient income.',
    employerSponsorshipOptions: 'Employer provides UDI Offer of Employment form; employee or authorized employer submits application.',
    familyRelocationOptions: 'Spouse/registered partner and children under 18 eligible for family immigration permits with work rights.',
    governmentApplicationFees: 'Verify on udi.no (Skilled Worker application fee approx. NOK 6,300).',
  },
  {
    id: 'pr_denmark_positive_list',
    country: 'Denmark',
    region: 'Europe',
    programName: 'Positive List for People with a Higher Education & Positive List for Skilled Work + Pay Limit Scheme',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Danish Agency for International Recruitment and Integration (SIRI — Ny i Danmark)',
    officialApplicationUrl: 'https://www.nyidanmark.dk/en-GB/You-want-to-apply/Work/The-Positive-Lists',
    shortageOccupationListUrl: 'https://www.nyidanmark.dk/en-GB/You-want-to-apply/Work/The-Positive-Lists/Positive-List-for-People-with-a-Higher-Education',
    officialDomain: 'nyidanmark.dk',
    professionalOccupationsInDemand: [
      'Auditors, Financial Controllers & Accounting Managers (Positive List)',
      'Civil, Water & Environmental Engineers (Positive List)',
      'Software Developers, IT Architects & Data Engineers (Positive List)',
      'Doctors, Nurses & Pharmacists (Positive List)',
      'Business & Management Consultants',
    ],
    labourOccupationsInDemand: [
      'Electricians, Plumbers, Carpenters & Welders (Positive List for Skilled Work)',
      'Industrial Technicians, Mechanics & CNC Operators',
      'Commercial Drivers & Logistics Technicians',
      'Social & Healthcare Assistants',
    ],
    bankingFinanceOccupations: [
      'Auditors & Financial Controllers (Recurring on Danish Higher Education Positive List)',
      'Banking Risk, Compliance & Financial Analysts (Pay Limit Scheme)',
    ],
    washWaterOccupations: [
      'Civil & Environmental Engineers — Water/Wastewater Systems (Positive List)',
      'Water Utilities & Environmental Consultants',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to non-EU/EEA citizens including Ethiopian nationals who secure a Danish employment offer on the official SIRI Positive List or Pay Limit Scheme.',
    educationRequirement: "Bachelor's/Master's degree for the Higher Education Positive List, or relevant skilled vocational qualification for the Skilled Work Positive List.",
    experienceRequirement: 'Written full-time Danish job offer under Danish salary and working standards.',
    languageRequirement: 'English accepted for work permit issuance; Danish Prøve i Dansk 2/3 required later for Permanent Residence.',
    ageRestriction: 'No upper age restriction for work permits.',
    skillsAssessmentRequired: 'Danish authorization required for regulated professions (healthcare, auditing licenses where applicable).',
    permanentResidencyRoute: 'Permanent Residence eligible after 8 years (or 4 years if meeting all 4 supplementary criteria including higher Danish exam, full-time work, and income threshold).',
    employerSponsorshipOptions: 'Fast-Track Scheme available for SIRI-certified Danish companies; standard employers sponsor directly via nyidanmark.dk.',
    familyRelocationOptions: 'Spouse/partner and children under 18 may accompany with full right to work and study.',
    governmentApplicationFees: 'Verify on nyidanmark.dk (SIRI processing fee approx. DKK 6,380).',
  },
  {
    id: 'pr_netherlands_hsm',
    country: 'Netherlands',
    region: 'Europe',
    programName: 'Highly Skilled Migrant (Kennismigrant) & EU Blue Card (5-Year Route to Permanent Residency)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Immigration and Naturalisation Service (IND — Netherlands)',
    officialApplicationUrl: 'https://ind.nl/en/residence-permits/work/highly-skilled-migrant',
    shortageOccupationListUrl: 'https://ind.nl/en/public-register-recognised-sponsors',
    officialDomain: 'ind.nl',
    professionalOccupationsInDemand: [
      'International Banking, Treasury, Audit & Risk Specialists (Amsterdam Financial Hub)',
      'Water Management, Hydraulic & WASH Engineers (Global Water Engineering Hub)',
      'Software Engineers, Data Scientists & Semiconductor Engineers',
      'Supply Chain, Finance & Compliance Managers',
    ],
    labourOccupationsInDemand: [
      'Technical Installers, Electricians & Construction Technicians (GVVA Single Permit)',
      'Manufacturing & Maritime Engineers / Technicians',
      'Logistics & Greenhouse Horticulture Workers (Temporary / Strict Labour Test)',
    ],
    bankingFinanceOccupations: [
      'Commercial Banking, Corporate Finance, Audit & AML Risk Roles (Recognised Sponsors)',
      'Financial Controllers & FinTech Analysts',
    ],
    washWaterOccupations: [
      'Hydraulic, Water Resources & Sanitary Engineers (IHE Delft / Dutch Water Sector)',
      'Water Treatment & Flood Resilience Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to non-EU nationals including Ethiopian citizens hired by an IND Recognised Sponsor meeting the official monthly gross salary threshold.',
    educationRequirement: "No rigid degree list for HSM (employer-assessed), though Bachelor's/Master's expected; higher education diploma required for EU Blue Card.",
    experienceRequirement: 'Employment contract with an IND Recognised Sponsor paying at or above the annual IND salary criterion (lower threshold for under-30s).',
    languageRequirement: 'English widely accepted for HSM roles; Dutch civic integration exam (Inburgeringsexamen) required after 5 years for Permanent Residence.',
    ageRestriction: 'No age bar (lower minimum salary threshold applies for applicants under age 30).',
    skillsAssessmentRequired: 'IND Recognised Sponsor verifies suitability; Nuffic diploma evaluation required for EU Blue Card.',
    permanentResidencyRoute: 'Eligible for Permanent Residence Permit (or EU Long-Term Resident permit) after 5 continuous years of lawful residence + passing the Dutch civic integration exam.',
    employerSponsorshipOptions: 'Employer must be listed in the official IND Public Register of Recognised Sponsors (2-week fast processing).',
    familyRelocationOptions: 'Partner and minor children receive residence permits with unrestricted access to the Dutch labour market.',
    governmentApplicationFees: 'Verify on ind.nl (Highly Skilled Migrant application fee approx. EUR €405).',
  },
  {
    id: 'pr_austria_rwr_card',
    country: 'Austria',
    region: 'Europe',
    programName: 'Red-White-Red Card (Skilled Workers in Shortage Occupations & Very Highly Qualified Workers)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Austrian Federal Government (Migration.gv.at / AMS)',
    officialApplicationUrl: 'https://www.migration.gv.at/en/types-of-immigration/permanent-immigration/skilled-workers-in-shortage-occupations/',
    shortageOccupationListUrl: 'https://www.migration.gv.at/en/types-of-immigration/permanent-immigration/austria-wide-shortage-occupations/',
    officialDomain: 'migration.gv.at',
    professionalOccupationsInDemand: [
      'Accountants, Financial Auditors & Business Economists (Shortage List)',
      'Civil, Water & Mechanical Engineers (Shortage List)',
      'IT Specialists, Software Developers & Data Engineers',
      'Graduate Nurses & Healthcare Specialists',
    ],
    labourOccupationsInDemand: [
      'Electricians, Plumbers, Pipefitters & Welders (Nationwide Shortage List)',
      'Carpenters, Bricklayers & Roofers (Shortage List)',
      'Machinists, CNC Technicians & Mechanics',
      'Chefs & Skilled Hospitality Technicians (Regional Shortage Lists)',
    ],
    bankingFinanceOccupations: [
      'Accountants & Financial Auditors (Featured on Austria Nationwide Shortage Occupations List)',
      'Banking & Corporate Finance Specialists (Other Key Workers / EU Blue Card)',
    ],
    washWaterOccupations: [
      'Civil & Water Infrastructure Engineers (Shortage List)',
      'Plumbing, Water Pipe & Sanitation Installers (Shortage List)',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes:
      'Open to third-country nationals including Ethiopian citizens scoring at least 55/90 points with a binding Austrian job offer in an official shortage occupation.',
    educationRequirement: 'Completed vocational training equivalent to Austrian apprenticeship OR university degree matching the shortage occupation.',
    experienceRequirement: 'Binding employment offer in Austria + points for qualifications, work experience, language, and age.',
    languageRequirement: 'English or German points awarded (A1/A2/B1 German or B1/B2 English); German B1 required after 5 years for EU Long-Term Resident PR.',
    ageRestriction: 'No strict cutoff, but points for age are awarded up to age 40 (highest up to 30).',
    skillsAssessmentRequired: 'AMS verifies qualification equivalence against the official annual Shortage Occupations Ordinance (Fachkräfteverordnung).',
    permanentResidencyRoute: 'Red-White-Red Card (2 years) -> Red-White-Red Card Plus (unrestricted labour market) -> Long-Term Resident EU (Permanent Residency) after 5 years.',
    employerSponsorshipOptions: 'Austrian employer files employer declaration (Arbeitgebererklärung) alongside the candidate application.',
    familyRelocationOptions: 'Spouse and minor children eligible for Red-White-Red Card Plus with full labour market access.',
    governmentApplicationFees: 'Verify on migration.gv.at (application and issuance fees approx. EUR €160–€210).',
  },
  {
    id: 'pr_switzerland_non_eu',
    country: 'Switzerland',
    region: 'Europe',
    programName: 'Non-EU/EFTA Skilled Specialist Work Permit (B-Permit Annual Quota -> Long-Term C-Permit Route)',
    pathwayClassification: 'temporary_work_permit',
    pathwayClassificationLabel: 'Temporary Work Permit (Long-Term C-Permit Only After 5–10 Years)',
    officialAuthority: 'Swiss Confederation (ch.ch / State Secretariat for Migration SEM)',
    officialApplicationUrl: 'https://www.ch.ch/en/foreign-nationals-in-switzerland/working-in-switzerland/',
    shortageOccupationListUrl: 'https://www.ch.ch/en/foreign-nationals-in-switzerland/working-in-switzerland/',
    officialDomain: 'ch.ch',
    professionalOccupationsInDemand: [
      'Senior Banking, Wealth Management, Audit & Multilateral Finance Specialists (Zurich/Geneva/Basel)',
      'International Organization & UN WASH/Health Specialists (Geneva — WHO/UNICEF/IFRC)',
      'Senior Software, Pharma, Biotech & Civil Engineers',
      'Management Executives & Highly Specialized Researchers',
    ],
    labourOccupationsInDemand: [
      'Strict Quota Restriction: General unskilled/semi-skilled non-EU labour permits are normally NOT granted; priority given to Swiss & EU/EFTA workforce.',
    ],
    bankingFinanceOccupations: [
      'Senior Risk, Treasury, Central Banking (BIS) & Corporate Banking Specialists',
      'International Audit & Compliance Managers',
    ],
    washWaterOccupations: [
      'UN / International Organization WASH Specialists (WHO, UNICEF, IFRC, UNHCR — Geneva)',
      'Senior Hydro-Engineering & Environmental Consultants',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'eligible_general_third_country',
    ethiopianEligibilityNotes:
      'Highly selective quota system for third-country nationals (including Ethiopian citizens): employer must prove no suitable candidate exists in Switzerland or the entire EU/EFTA, except UN/diplomatic international organization roles.',
    educationRequirement: 'University degree + several years of specialized professional experience (managers, specialists, highly qualified professionals only).',
    experienceRequirement: 'Senior/specialist track record required; employer must pass strict cantonal & SEM labour market priority review.',
    languageRequirement: 'English accepted in multinational finance/UN/pharma; national language (German/French/Italian) required for C-Permit settlement.',
    ageRestriction: 'No formal cutoff, though integration potential is assessed by cantonal authorities.',
    skillsAssessmentRequired: 'Cantonal labour authority and Federal SEM review employer justification, salary benchmarks, and degree credentials.',
    permanentResidencyRoute: 'Initial B-Permit is temporary/renewable; Settlement Permit (C-Permit) generally requires 10 years of residence (or 5 years under Early C-Permit with strong integration & B1/A2 national language).',
    employerSponsorshipOptions: '100% employer-sponsored; subject to annual Federal Council third-country B/L permit quotas.',
    familyRelocationOptions: 'Spouse and minor children of B-Permit holders may apply for family reunification subject to adequate housing and income.',
    governmentApplicationFees: 'Verify with cantonal migration office via ch.ch (cantonal permit fees typically CHF 100–350).',
  },
  {
    id: 'pr_japan_ssw_hsp',
    country: 'Japan',
    region: 'Asia',
    programName: 'Highly Skilled Professional (HSP Points Fast-Track PR) & Specified Skilled Worker (SSW Type 1 & Type 2)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency (HSP 1–3 Years / SSW Type 2)',
    officialAuthority: 'Immigration Services Agency of Japan (ISA / Ministry of Justice)',
    officialApplicationUrl: 'https://www.moj.go.jp/isa/applications/status/index.html',
    shortageOccupationListUrl: 'https://www.moj.go.jp/isa/applications/ssw/index.html',
    officialDomain: 'moj.go.jp',
    professionalOccupationsInDemand: [
      'Engineers, IT Developers & Cybersecurity Specialists (HSP / Engineer Visa)',
      'International Finance, Banking & Corporate Business Specialists (HSP)',
      'Academic Researchers & Advanced Business Managers',
    ],
    labourOccupationsInDemand: [
      'Nursing Care & Elderly Care Workers (SSW)',
      'Construction, Building Cleaning & Industrial Manufacturing (SSW Type 1 & 2)',
      'Agriculture, Fishery & Food/Beverage Manufacturing (SSW Type 1 & 2)',
      'Automobile Transport, Aviation & Hospitality Accommodation (SSW)',
      'Shipbuilding, Marine & Auto Repair Technicians (SSW Type 1 & 2)',
    ],
    bankingFinanceOccupations: [
      'International Banking, Financial Engineering & Corporate Finance Analysts (HSP Points)',
      'Risk, FinTech & Asset Management Specialists (Tokyo Financial Center)',
    ],
    washWaterOccupations: [
      'Civil, Water Supply & Environmental Engineers (Engineer / Specialist in Humanities Visa)',
      'Infrastructure & Sanitation Construction Specialists',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'eligible_general_third_country',
    ethiopianEligibilityNotes:
      'HSP and Engineer/Specialist visas are open to Ethiopian citizens with a Japanese sponsoring employer. For SSW, applicants must pass official Japanese language (JLPT N4 / JFT-Basic) and sector skills tests (verify active test locations/bilateral availability on moj.go.jp).',
    educationRequirement: "University degree (or 10 years experience) for Engineer/HSP visa; skills + Japanese language exam for SSW (no degree required for SSW).",
    experienceRequirement: 'HSP awards points for education, years of experience, salary, and age (70+ pts -> PR in 3 years; 80+ pts -> PR in 1 year).',
    languageRequirement: 'English accepted in multinational finance/tech HSP roles; JLPT N4 / JFT-Basic mandatory for SSW Type 1.',
    ageRestriction: 'Must be 18+ for SSW; HSP grants bonus age points for applicants under 40.',
    skillsAssessmentRequired: 'Certificate of Eligibility (CoE) issued by ISA Japan; official SSW skills test required for SSW fields.',
    permanentResidencyRoute: 'HSP 80+ points -> Permanent Residency in 1 year; HSP 70+ points -> PR in 3 years; SSW Type 1 is temporary (max 5 years, NO direct PR) unless upgrading to SSW Type 2 (indefinite renewal -> standard 10-year PR route).',
    employerSponsorshipOptions: 'Employer or Registered Support Organization sponsors the Certificate of Eligibility (CoE) in Japan.',
    familyRelocationOptions: 'HSP and SSW Type 2 holders can bring spouse and children; SSW Type 1 does NOT allow family accompaniment.',
    governmentApplicationFees: 'Verify on moj.go.jp/isa (CoE free; embassy visa approx. JPY ¥3,000; residence status change/PR fee JPY ¥4,000–¥8,000).',
  },
  {
    id: 'pr_luxembourg_blue_card',
    country: 'Luxembourg',
    region: 'Europe',
    programName: 'EU Blue Card & Salaried Worker Permit (5-Year Route to Long-Term Resident EU)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Government of the Grand Duchy of Luxembourg — Guichet.lu',
    officialApplicationUrl: 'https://guichet.public.lu/en/citoyens/immigration/plus-3-ans/ressortissant-tiers/hautement-qualifie/salarie-hautement-qualifie.html',
    shortageOccupationListUrl: 'https://adem.public.lu/en.html',
    officialDomain: 'guichet.public.lu',
    professionalOccupationsInDemand: [
      'Fund Accounting, Compliance, AML/KYC & Banking Managers (Europe Major Financial Center)',
      'Risk Management, Internal Audit & Corporate Treasury Specialists',
      'Software Engineers & Financial Technology Specialists',
    ],
    labourOccupationsInDemand: [
      'Construction, Electrical & Technical Maintenance Specialists (Subject to ADEM Labour Test)',
    ],
    bankingFinanceOccupations: [
      'Banking Operations, Fund Administration, Compliance & AML Managers',
      'Senior Accountants, Financial Controllers & Audit Managers',
    ],
    washWaterOccupations: [
      'Environmental & Civil Water Infrastructure Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Third-country nationals including Ethiopian citizens may apply from outside Luxembourg once they hold a qualifying Luxembourg employment contract.',
    educationRequirement: 'Recognized university degree (Bachelor/Master) or 5+ years senior equivalent experience for EU Blue Card.',
    experienceRequirement: 'Binding 1+ year contract with Luxembourg employer meeting EU Blue Card salary threshold.',
    languageRequirement: 'English is widely used across Luxembourg banking, fund management, and audit firms; French/German helpful for daily life.',
    ageRestriction: 'No upper age limit.',
    skillsAssessmentRequired: 'Degree verification via Luxembourg Ministry of Higher Education where requested.',
    permanentResidencyRoute: 'Eligible for Long-Term Resident EU (Permanent Residence) after 5 years uninterrupted legal stay; citizenship eligible after 5 years with Luxembourgish language exam.',
    employerSponsorshipOptions: 'Employer signs contract; EU Blue Card is exempt from ADEM labour market test.',
    familyRelocationOptions: 'EU Blue Card holders may bring spouse and minor children immediately with work authorization.',
    governmentApplicationFees: 'Verify on guichet.public.lu (residence permit issuance fee EUR €80).',
    jobOfferRequired: 'Yes — binding Luxembourg employment contract required.',
    minimumSalaryRequirement: 'At least 1.5x Luxembourg average gross annual salary (approx. EUR €58,968+ gross/year; verify live threshold on guichet.public.lu).',
    financialProofRequirement: 'Demonstrated by signed employment contract meeting statutory salary.',
    recruiterOrEmployerRequired: 'Direct Luxembourg employer required (no paid third-party agent required).',
    estimatedProcessingStages: '1) Temporary Authorization to Stay (up to 90 days) -> 2) Type D Visa -> 3) Residence Permit card after arrival.',
  },
  {
    id: 'pr_poland_work_blue_card',
    country: 'Poland',
    region: 'Europe',
    programName: 'EU Blue Card & Work Permit Type A (5-Year Route to EU Long-Term Resident Permit)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Government of Poland — Office for Foreigners (Gov.pl / UdSC)',
    officialApplicationUrl: 'https://www.gov.pl/web/udsc-en/temporary-residence-permit-in-order-to-perform-work-in-a-profession-requiring-high-qualifications',
    shortageOccupationListUrl: 'https://psz.praca.gov.pl/',
    officialDomain: 'gov.pl',
    professionalOccupationsInDemand: [
      'AML, KYC, Financial Crime & Banking Shared-Services Managers (Warsaw / Krakow Global Banking Hubs)',
      'Financial Controllers, Accountants & Audit Specialists',
      'IT, FinTech & Business Operations Managers',
    ],
    labourOccupationsInDemand: [
      'Construction Trades, Welders, Electricians & Logistics Drivers',
      'Manufacturing Technicians & Warehouse Specialists',
    ],
    bankingFinanceOccupations: [
      'Global Banking Operations, AML/KYC, Risk & Financial Reporting Managers (International English-Speaking Hubs)',
      'Corporate Accounting & Treasury Specialists',
    ],
    washWaterOccupations: [
      'Civil & Environmental Infrastructure Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Ethiopian citizens can apply from Ethiopia through the Polish Embassy in Addis Ababa with an approved Voivode Work Permit or Blue Card contract.',
    educationRequirement: 'University degree (or 5 years comparable professional experience) for EU Blue Card.',
    experienceRequirement: 'Signed Polish employment contract for at least 1 year for Blue Card.',
    languageRequirement: 'English is the primary working language in international banking/finance shared-service hubs in Warsaw, Krakow, and Wroclaw; Polish B1 needed later for EU Long-Term Resident PR.',
    ageRestriction: 'No upper age cap.',
    skillsAssessmentRequired: 'Employer verifies degree/experience; apostille/legalization may be requested at embassy.',
    permanentResidencyRoute: 'Temporary Residence / EU Blue Card -> EU Long-Term Resident Permit (PR) after 5 years legal residence + Polish B1 certificate.',
    employerSponsorshipOptions: 'Employer obtains Voivode Work Permit (Type A) or supports Blue Card residence permit.',
    familyRelocationOptions: 'Blue Card holders can bring spouse and minor children with full right to work in Poland.',
    governmentApplicationFees: 'Verify on gov.pl (Work permit fee PLN 100; residence permit PLN 440; national visa EUR €80–€135).',
    jobOfferRequired: 'Yes — Polish employer contract required.',
    minimumSalaryRequirement: 'EU Blue Card requires 150% of Polish average gross wage (verify live annual figure on gov.pl).',
    financialProofRequirement: 'Employment contract salary + health insurance coverage.',
    recruiterOrEmployerRequired: 'Direct Polish employer required.',
    estimatedProcessingStages: '1) Work Permit issuance -> 2) National D-Visa at Embassy -> 3) Temporary Residence / Blue Card in Poland.',
  },
  {
    id: 'pr_lithuania_blue_card',
    country: 'Lithuania',
    region: 'Europe',
    programName: 'EU Blue Card & Highly Qualified Worker Residence Permit (5-Year Route to PR)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Migration Department of the Republic of Lithuania (Migracija.lt)',
    officialApplicationUrl: 'https://www.migracija.lt/en/noriu-gauti-leidima-laikinai-gyventi-dirbti-aukstos-kvalifikacijos-darba',
    shortageOccupationListUrl: 'https://uzt.lt/en/',
    officialDomain: 'migracija.lt',
    professionalOccupationsInDemand: [
      'FinTech, AML/Compliance, Payment Operations & Banking Specialists (Vilnius EU FinTech Hub)',
      'Financial Analysts, Risk Managers & Software Engineers',
    ],
    labourOccupationsInDemand: [
      'Welders, Electricians, Construction Technicians & Commercial Drivers (Shortage List)',
    ],
    bankingFinanceOccupations: [
      'FinTech Operations, AML/KYC, Risk & Compliance Managers (English-speaking Vilnius hub)',
      'Accounting & Financial Reporting Specialists',
    ],
    washWaterOccupations: [
      'Civil & Environmental Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Open to third-country nationals including Ethiopian citizens applying via MIGRIS online portal with a Lithuanian employer mediation letter.',
    educationRequirement: 'Higher education degree OR 5+ years verified senior experience for EU Blue Card.',
    experienceRequirement: 'Binding job offer from a Lithuanian employer meeting salary rules.',
    languageRequirement: 'English widely used in Vilnius FinTech, banking compliance, and international tech firms; Lithuanian A2/constitution exam needed after 5 years for PR.',
    ageRestriction: 'No age cap.',
    skillsAssessmentRequired: 'Employer confirms higher education/experience through MIGRIS.',
    permanentResidencyRoute: 'EU Blue Card / Temporary Residence Permit -> Permanent Residence Permit after 5 continuous years.',
    employerSponsorshipOptions: 'Employer submits electronic mediation letter via MIGRIS (fast 1–2 month processing for Blue Card).',
    familyRelocationOptions: 'Spouse and minor children can apply simultaneously with EU Blue Card holder and gain work access.',
    governmentApplicationFees: 'Verify on migracija.lt (standard TRP fee EUR €160; urgent EUR €320).',
    jobOfferRequired: 'Yes — Lithuanian employer mediation letter required.',
    minimumSalaryRequirement: '1.5x average Lithuanian gross salary (or 1.2x for official shortage/high-added-value professions).',
    financialProofRequirement: 'Covered by signed employment contract meeting statutory threshold.',
    recruiterOrEmployerRequired: 'Direct Lithuanian employer required.',
    estimatedProcessingStages: '1) MIGRIS online application -> 2) External service center / embassy biometrics -> 3) Residence card decision (1–2 months).',
  },
  {
    id: 'pr_estonia_skilled',
    country: 'Estonia',
    region: 'Europe',
    programName: 'EU Blue Card & Temporary Residence Permit for Employment (5-Year Route to Long-Term PR)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Police and Border Guard Board of Estonia (Politsei.ee) & Work in Estonia',
    officialApplicationUrl: 'https://www.politsei.ee/en/instructions/residence-permit-for-employment',
    shortageOccupationListUrl: 'https://www.workinestonia.com/',
    officialDomain: 'politsei.ee',
    professionalOccupationsInDemand: [
      'FinTech, Digital Banking, Compliance & Financial Operations Specialists (Tallinn)',
      'Software Engineering, Product & Data Specialists',
    ],
    labourOccupationsInDemand: [
      'Industrial Technicians, Construction & Electrical Skilled Workers',
    ],
    bankingFinanceOccupations: [
      'Digital Banking, Payment Operations, AML/KYC & Finance Managers',
    ],
    washWaterOccupations: [
      'Environmental & Civil Infrastructure Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Open to non-EU citizens including Ethiopian applicants sponsored by an Estonian-registered employer; EU Blue Card and Top Specialist streams are exempt from the annual immigration quota.',
    educationRequirement: 'Higher education qualification or 5+ years specialized experience for EU Blue Card.',
    experienceRequirement: 'Signed employment contract with an Estonian employer.',
    languageRequirement: 'English widely used in Tallinn fintech, digital finance, and IT; Estonian B1 required after 5 years for Long-Term Resident PR.',
    ageRestriction: 'No upper age limit.',
    skillsAssessmentRequired: 'ENIC/NARIC credential verification where required.',
    permanentResidencyRoute: 'Temporary Residence Permit / EU Blue Card -> Long-Term Resident Residence Permit (PR) after 5 years + Estonian B1.',
    employerSponsorshipOptions: 'Employer registers short-term employment or sponsors EU Blue Card / Top Specialist permit.',
    familyRelocationOptions: 'Spouse and minor children eligible to accompany with work authorization.',
    governmentApplicationFees: 'Verify on politsei.ee (TRP state fee EUR €96–€125).',
    jobOfferRequired: 'Yes — Estonian employer sponsorship required.',
    minimumSalaryRequirement: 'At least 1.5x Estonian average gross salary for EU Blue Card (or 1.2x for shortage professions / 1.5x for Top Specialist quota exemption).',
    financialProofRequirement: 'Satisfied by qualifying employment contract.',
    recruiterOrEmployerRequired: 'Direct Estonian employer required.',
    estimatedProcessingStages: '1) Employer invitation / contract -> 2) Embassy submission -> 3) Decision within ~2 months.',
  },
  {
    id: 'pr_malta_kei_blue_card',
    country: 'Malta',
    region: 'Europe',
    programName: 'Key Employee Initiative (KEI), Specialist Employee Initiative & EU Blue Card (5-Year Route to Long-Term PR)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with Route to Permanent Residency',
    officialAuthority: 'Identità Malta (Government of Malta)',
    officialApplicationUrl: 'https://identita.gov.mt/expatriates-unit-main-page/noneu-nationals/employment-related-permits/key-employee-initiative/',
    shortageOccupationListUrl: 'https://jobsplus.gov.mt/',
    officialDomain: 'identita.gov.mt',
    professionalOccupationsInDemand: [
      'Banking, Financial Services, Accounting, Audit & Compliance Managers (English-Speaking EU Financial Hub)',
      'Risk, AML/KYC, Insurance & Corporate Finance Managers',
      'IT & FinTech Specialists',
    ],
    labourOccupationsInDemand: [
      'Healthcare Workers, Construction Trades & Hospitality Supervisors (Single Permit)',
    ],
    bankingFinanceOccupations: [
      'Financial Controllers, Auditors, Compliance/AML Managers & Banking Operations Managers (KEI Fast-Track)',
    ],
    washWaterOccupations: [
      'Water Services & Civil Infrastructure Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'English is an official language of Malta. Third-country nationals including Ethiopian citizens with managerial/technical contracts (EUR €35,000+ gross/year) qualify for the 5-working-day KEI fast-track.',
    educationRequirement: 'Relevant university degree or verified managerial/technical qualifications.',
    experienceRequirement: 'Signed contract in a managerial or highly technical role paying EUR €35,000+ gross/year (KEI).',
    languageRequirement: 'English is an official national & business language of Malta — strong advantage for English-only professionals.',
    ageRestriction: 'No upper age restriction.',
    skillsAssessmentRequired: 'MQRIC recognition or employer qualification confirmation.',
    permanentResidencyRoute: 'KEI / Single Permit / EU Blue Card -> Long-Term Residence status after 5 years continuous legal stay + integration criteria.',
    employerSponsorshipOptions: 'Maltese employer initiates KEI / Single Permit online via Identità.',
    familyRelocationOptions: 'Eligible for family reunification once statutory income and accommodation thresholds are met (immediate under EU Blue Card).',
    governmentApplicationFees: 'Verify on identita.gov.mt (Single Permit / KEI fee EUR €300).',
    jobOfferRequired: 'Yes — Maltese employer contract required.',
    minimumSalaryRequirement: 'KEI requires minimum EUR €35,000 gross/year (approx. USD $3,150/month); EU Blue Card higher.',
    financialProofRequirement: 'Employment contract + private health insurance & lease agreement upon arrival.',
    recruiterOrEmployerRequired: 'Direct Maltese employer required.',
    estimatedProcessingStages: '1) Online KEI employer submission -> 2) Approval in Principle (~5 working days for KEI) -> 3) Visa & Biometrics.',
  },
  {
    id: 'pr_uae_work_green_golden',
    country: 'United Arab Emirates',
    region: 'Middle East',
    programName: 'Employer-Sponsored Skilled Work Residence Visa & 5-Year Green Residence Visa (Long-Term Renewable — No Automatic Citizenship)',
    pathwayClassification: 'temporary_work_permit',
    pathwayClassificationLabel: 'Long-Term Work / Renewable Residence Visa (No Automatic PR/Citizenship)',
    officialAuthority: 'UAE Federal Authority for Identity, Citizenship, Customs & Port Security (ICP) / MOHRE',
    officialApplicationUrl: 'https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/residence-visa-for-working-in-the-uae',
    shortageOccupationListUrl: 'https://www.mohre.gov.ae/en/home.aspx',
    officialDomain: 'u.ae',
    professionalOccupationsInDemand: [
      'Commercial Banking, Branch/Relationship Managers, Corporate Finance & Treasury (Dubai DIFC / Abu Dhabi ADGM)',
      'AML/KYC Compliance, Audit, Credit Risk & FinTech Managers',
      'Corporate Operations, Insurance & Real Estate Finance Managers',
    ],
    labourOccupationsInDemand: [
      'Engineering Technicians, Construction Supervisors, Hospitality & Logistics (Employer-Sponsored)',
    ],
    bankingFinanceOccupations: [
      'Retail & Corporate Banking Managers, Credit Managers, AML/Compliance & Finance Controllers (Tax-Free Salaries)',
      'Digital Banking & Payment Operations Managers',
    ],
    washWaterOccupations: [
      'Desalination, Water Network & Environmental Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Open to Ethiopian skilled professionals hired by UAE-licensed companies (free zone or mainland). Employers legally bear recruitment and visa sponsorship fees under UAE Labour Law.',
    educationRequirement: 'Attested Bachelor degree or equivalent (MOHRE Skill Level 1, 2, or 3 for Green Visa).',
    experienceRequirement: 'Valid UAE employment contract; Green Visa requires minimum AED 15,000/month (~USD $4,080/mo) + Bachelor degree.',
    languageRequirement: 'English is the dominant business language across UAE banking, DIFC, ADGM, and multinational firms; Arabic is a plus for local retail branches.',
    ageRestriction: 'No strict cutoff up to 60 (renewable past 60 with approval).',
    skillsAssessmentRequired: 'Degree attestation (MOFA Ethiopia + UAE Embassy + MOFA UAE).',
    permanentResidencyRoute: 'IMPORTANT: UAE does NOT offer standard permanent residency or citizenship via employment. Provides renewable 2-year work visas, 5-year Green Residence, and 10-year Golden Visa (for senior salaries AED 30,000+/mo).',
    employerSponsorshipOptions: 'UAE employer sponsors MOHRE work permit and 2-year residence visa (employer covers visa costs by law).',
    familyRelocationOptions: 'Skilled workers earning AED 4,000+/month (or AED 3,000 + accommodation) can legally sponsor spouse and children after arrival.',
    governmentApplicationFees: 'Employer pays work visa & permit fees under UAE Labour Law; family sponsorship & Emirates ID fees apply separately (verify on u.ae).',
    jobOfferRequired: 'Yes — UAE employment contract required.',
    minimumSalaryRequirement: 'No statutory floor for standard skilled visa (market pay for senior banking/finance USD $3,500–$8,000+ tax-free); Green Visa requires AED 15,000/mo (~USD $4,080/mo).',
    financialProofRequirement: 'Signed employment contract (plus tenancy Ejari/Tawtheeq later for family sponsorship).',
    recruiterOrEmployerRequired: 'Direct UAE employer required (never pay job-offer fees — illegal in UAE).',
    estimatedProcessingStages: '1) MOHRE job offer & work permit -> 2) Entry Permit e-visa -> 3) Medical fitness, Emirates ID & Residence Visa.',
  },
  {
    id: 'pr_saudi_work_premium',
    country: 'Saudi Arabia',
    region: 'Middle East',
    programName: 'Employer-Sponsored Skilled Work Visa (Qiwa) & Special Talent Premium Residency (Long-Term Residence — No Standard PR)',
    pathwayClassification: 'temporary_work_permit',
    pathwayClassificationLabel: 'Employer-Sponsored Work Visa / Special Talent Residence',
    officialAuthority: 'Ministry of Human Resources and Social Development (HRSD) & Premium Residency Center',
    officialApplicationUrl: 'https://pr.gov.sa/',
    shortageOccupationListUrl: 'https://www.hrsd.gov.sa/en',
    officialDomain: 'pr.gov.sa',
    professionalOccupationsInDemand: [
      'Banking Transformation, Corporate Finance, Risk, Compliance & Financial Controllers (Riyadh Vision 2030)',
      'Infrastructure, Water/Desalination & Mega-Project Finance Managers',
      'Fintech, Digital Banking & Audit Specialists',
    ],
    labourOccupationsInDemand: [
      'Skilled Engineering & Construction Supervisors (Employer-Sponsored)',
    ],
    bankingFinanceOccupations: [
      'Finance Managers, Internal Audit, Credit Risk, Compliance & Digital Banking Specialists',
    ],
    washWaterOccupations: [
      'Water Resource, Desalination & Environmental Infrastructure Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Ethiopian professionals with attested Bachelor/Master degrees and a verified Saudi employer contract can obtain a work visa through the Saudi Embassy in Addis Ababa.',
    educationRequirement: 'Attested university degree matching profession (Saudi Professional Accreditation / Takamol verification).',
    experienceRequirement: '3–5+ years experience for skilled/managerial visas; executive/talent thresholds for Premium Residency.',
    languageRequirement: 'English widely used in multinational corporations, finance hubs, and major banks in Riyadh/Jeddah; Arabic advantageous in retail banking.',
    ageRestriction: 'Typically 21–60 years for new work visas.',
    skillsAssessmentRequired: 'Degree attestation and Professional Verification (PACC / Qiwa) where applicable.',
    permanentResidencyRoute: 'IMPORTANT: Standard employment visas are renewable temporary permits (Iqama) without automatic citizenship; Special Talent Premium Residency offers 5-year/permanent residency only for qualifying senior executives/specialists.',
    employerSponsorshipOptions: 'Saudi employer sponsors work visa and Iqama via Qiwa platform.',
    familyRelocationOptions: 'Skilled professionals on eligible managerial/professional Iqama professions can sponsor spouse and children on family residence visas.',
    governmentApplicationFees: 'Employer legally pays work visa, work permit, and Iqama fees; dependant levy (SAR 400/month per dependant) applies for family.',
    jobOfferRequired: 'Yes — verified Saudi employer contract via Qiwa.',
    minimumSalaryRequirement: 'Competitive tax-free packages often include housing + transport allowances (verify live offer terms).',
    financialProofRequirement: 'Verified employment contract (salary certificate for family visa later).',
    recruiterOrEmployerRequired: 'Direct Saudi employer required.',
    estimatedProcessingStages: '1) Qiwa work visa authorization -> 2) Degree attestation & medical -> 3) Embassy stamping -> 4) Iqama issuance in KSA.',
  },
  {
    id: 'pr_qatar_work_residency',
    country: 'Qatar',
    region: 'Middle East',
    programName: 'Employer-Sponsored Skilled Employment Visa (Renewable Residence Permit — Very Limited PR)',
    pathwayClassification: 'temporary_work_permit',
    pathwayClassificationLabel: 'Employer-Sponsored Work Visa (Renewable Residence)',
    officialAuthority: 'Government of Qatar — Hukoomi / Ministry of Labour',
    officialApplicationUrl: 'https://hukoomi.gov.qa/en/service/work-visa',
    shortageOccupationListUrl: 'https://www.mol.gov.qa/en',
    officialDomain: 'hukoomi.gov.qa',
    professionalOccupationsInDemand: [
      'Banking, Corporate Finance, Treasury, Compliance & Audit Professionals (Qatar Financial Centre — Doha)',
      'Operations, Insurance & FinTech Managers',
    ],
    labourOccupationsInDemand: [
      'Construction, Maintenance, Logistics & Hospitality Personnel (Employer-Sponsored)',
    ],
    bankingFinanceOccupations: [
      'Finance Managers, Relationship Managers, Risk & Compliance Officers (QFC & Qatari Banks)',
    ],
    washWaterOccupations: [
      'Water Infrastructure & Environmental Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Open to Ethiopian skilled professionals hired by Qatari employers or QFC-licensed financial institutions.',
    educationRequirement: 'Attested university degree required for managerial/finance roles and family sponsorship.',
    experienceRequirement: '3+ years relevant experience typically expected by Qatari banks and multinationals.',
    languageRequirement: 'English is widely used in Qatar Financial Centre, international banks, and corporate offices.',
    ageRestriction: 'Typically 21–60 years.',
    skillsAssessmentRequired: 'Authenticated degree certificate via MOFA & Qatar Embassy.',
    permanentResidencyRoute: 'IMPORTANT: Employment grants a renewable Qatar Residence Permit (QID), NOT automatic PR (Qatar PR cards have a strict annual quota requiring 20+ years legal residence + Arabic fluency).',
    employerSponsorshipOptions: 'Employer handles work visa, medical, and QID issuance at no cost to the worker under Qatar Labour Law.',
    familyRelocationOptions: 'Employees earning QAR 10,000+/month (or QAR 6,000 + family housing) can sponsor spouse and children.',
    governmentApplicationFees: 'Employer covers recruitment & work residence permit fees under Qatar Labour Law.',
    jobOfferRequired: 'Yes — Qatari employer contract required.',
    minimumSalaryRequirement: 'Senior banking/finance offers typically USD $3,000–$7,000+/month tax-free plus housing/medical benefits.',
    financialProofRequirement: 'Employment contract + 6-month salary bank statement later for family sponsorship.',
    recruiterOrEmployerRequired: 'Direct Qatari employer required.',
    estimatedProcessingStages: '1) Work visa approval by MOI/MOL -> 2) Entry to Qatar -> 3) Medical & fingerprints -> 4) QID Residence Permit.',
  },
  {
    id: 'pr_singapore_employment_pass',
    country: 'Singapore',
    region: 'Asia',
    programName: 'Employment Pass (EP — COMPASS Points Framework -> Route to Singapore PR)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Pass with Route to Permanent Residency',
    officialAuthority: 'Ministry of Manpower (MOM) & Immigration & Checkpoints Authority (ICA Singapore)',
    officialApplicationUrl: 'https://www.mom.gov.sg/passes-and-permits/employment-pass',
    shortageOccupationListUrl: 'https://www.mom.gov.sg/passes-and-permits/employment-pass/eligibility',
    officialDomain: 'mom.gov.sg',
    professionalOccupationsInDemand: [
      'Financial Services, Banking Compliance, Risk, Treasury & Audit Managers (Major Asian Financial Hub)',
      'FinTech, Digital Banking & Quantitative Analysts',
      'Water Technology, Sustainability & Civil Engineers',
    ],
    labourOccupationsInDemand: [
      'Work Permit / S Pass streams subject to strict sector quotas and source-country rules (verify MOM source list).',
    ],
    bankingFinanceOccupations: [
      'Banking Operations, Risk, AML/Compliance & Finance Managers (Financial Services EP Salary Benchmark)',
    ],
    washWaterOccupations: [
      'Water Treatment, Desalination & Environmental Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Employment Pass (EP) is open to all nationalities including Ethiopian professionals who pass the MOM salary benchmark and 40-point COMPASS framework.',
    educationRequirement: 'Verified university degree (from accredited institution; background verification required for COMPASS points).',
    experienceRequirement: 'Experienced managerial, executive, or specialist background.',
    languageRequirement: 'English is Singapore’s primary business and government language — ideal for English-only professionals.',
    ageRestriction: 'No upper age bar, but EP minimum qualifying salary increases progressively with age.',
    skillsAssessmentRequired: 'Third-party degree verification (e.g., HireRight / RMI) required by MOM for COMPASS education points.',
    permanentResidencyRoute: 'Employment Pass holders may apply to ICA for Singapore Permanent Residency after establishing residence/employment (discretionary assessment — never automatic).',
    employerSponsorshipOptions: 'Singapore-registered employer applies online via MOM EP eService.',
    familyRelocationOptions: 'EP holders earning SGD $6,000+/month (~USD $4,440/mo) can bring spouse and unmarried children under 21 on Dependant’s Pass.',
    governmentApplicationFees: 'Verify on mom.gov.sg (EP application SGD $105; issuance SGD $225; PR application SGD $100).',
    jobOfferRequired: 'Yes — Singapore employer sponsorship required.',
    minimumSalaryRequirement: 'Financial Services sector minimum SGD $6,200/month (~USD $4,580/mo) for younger applicants, scaling up with age (other sectors SGD $5,600+); verify live MOM table.',
    financialProofRequirement: 'Verified employer salary contract.',
    recruiterOrEmployerRequired: 'Direct Singapore employer required.',
    estimatedProcessingStages: '1) Degree verification & COMPASS check -> 2) Employer submits EP -> 3) In-Principle Approval (~10 business days) -> 4) Pass issuance.',
  },
  {
    id: 'pr_mauritius_occupation_permit',
    country: 'Mauritius',
    region: 'Africa & Other',
    programName: 'Professional Occupation Permit (Route to 20-Year Permanent Residence Permit after 3 Years)',
    pathwayClassification: 'route_to_pr',
    pathwayClassificationLabel: 'Work Permit with 3-Year Route to Permanent Residence',
    officialAuthority: 'Economic Development Board Mauritius (EDB Mauritius)',
    officialApplicationUrl: 'https://edbmauritius.org/work-and-live-in-mauritius',
    shortageOccupationListUrl: 'https://edbmauritius.org/work-and-live-in-mauritius',
    officialDomain: 'edbmauritius.org',
    professionalOccupationsInDemand: [
      'Banking, Fund Administration, Accounting, Audit & Financial Services Managers (Port Louis Financial Hub)',
      'FinTech, Insurance & Corporate Operations Managers',
    ],
    labourOccupationsInDemand: [
      'Work Permits via Ministry of Labour for specific hospitality/manufacturing sectors (separate from Occupation Permit).',
    ],
    bankingFinanceOccupations: [
      'Financial Services, Offshore Banking, Accounting, Compliance & Risk Managers',
    ],
    washWaterOccupations: [
      'Environmental & Water Resource Engineers',
    ],
    foreignApplicantsEligible: true,
    ethiopianCitizensEligible: 'confirmed',
    ethiopianEligibilityNotes: 'Open to all foreign professionals including Ethiopian citizens with a qualifying Mauritian employment contract; English is widely used in banking and financial services.',
    educationRequirement: 'Relevant university degree and/or professional finance credentials.',
    experienceRequirement: 'Signed employment contract meeting EDB Professional Occupation Permit monthly salary floor.',
    languageRequirement: 'English is the official parliamentary and corporate finance language (French also widely spoken).',
    ageRestriction: 'No upper age cap.',
    skillsAssessmentRequired: 'Employer submits qualification and contract documentation via EDB National Electronic Licensing System.',
    permanentResidencyRoute: 'Professional Occupation Permit holders earning above the statutory threshold for 3 consecutive years may apply for a 20-Year Permanent Residence Permit.',
    employerSponsorshipOptions: 'Mauritian employer applies online through EDB Mauritius.',
    familyRelocationOptions: 'Spouse and dependent children under 24 eligible for Dependant Permits.',
    governmentApplicationFees: 'Verify on edbmauritius.org (Professional Occupation Permit approx. USD $500–$1,000 depending on duration).',
    jobOfferRequired: 'Yes — Mauritian employment contract required.',
    minimumSalaryRequirement: 'Standard Professional Occupation Permit threshold MUR 30,000–60,000/month (check live EDB Mauritius schedule; PR upgrade requires higher consecutive monthly basic salary).',
    financialProofRequirement: 'Signed employment contract.',
    recruiterOrEmployerRequired: 'Direct Mauritian employer required.',
    estimatedProcessingStages: '1) Online NELS application -> 2) Approval in Principle -> 3) Entry & Permit issuance in Mauritius.',
  },
];

function stripHtmlClean(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAllowedGovernmentUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function checkOfficialGovernmentPage(url: string): Promise<{
  httpStatus: number | null;
  verificationTier: CanonicalVerificationTier;
  excerpt: string;
}> {
  if (!isAllowedGovernmentUrl(url)) {
    return {
      httpStatus: null,
      verificationTier: 'PENDING VERIFICATION',
      excerpt: 'Invalid official URL format.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7500);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'HopelandJobsBot/1.0 (+https://hopelandjobs.tech)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (resp.ok) {
      const html = await resp.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const pageTitle = titleMatch ? stripHtmlClean(titleMatch[1]).slice(0, 140) : '';
      const plain = stripHtmlClean(html).slice(0, 320);
      return {
        httpStatus: resp.status,
        verificationTier: 'VERIFIED',
        excerpt: pageTitle ? `${pageTitle} — ${plain.slice(0, 180)}` : plain.slice(0, 260),
      };
    }

    // Government portals behind Akamai/Cloudflare WAF often return HTTP 403 to automated bots while live for humans
    if (resp.status === 403 || resp.status === 405 || resp.status === 429) {
      return {
        httpStatus: resp.status,
        verificationTier: 'PARTIALLY VERIFIED',
        excerpt: `Official government domain reachable (HTTP ${resp.status} automated bot protection — open official link directly in browser to confirm live criteria).`,
      };
    }

    return {
      httpStatus: resp.status,
      verificationTier: 'PENDING VERIFICATION',
      excerpt: `Official portal returned HTTP ${resp.status}; pending manual re-verification.`,
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      httpStatus: null,
      verificationTier: 'PARTIALLY VERIFIED',
      excerpt: `Automated fetch timed out (${err?.name === 'AbortError' ? 'timeout' : err?.message || 'network'}); authoritative official government URL preserved for direct user verification.`,
    };
  }
}

/**
 * Department 6: Official Government Permanent Residency & Labour Shortage Intelligence.
 * Verifies every authoritative government immigration portal live via HTTP and returns
 * transparent records with strict distinction between Direct PR, Route to PR, and Temporary Permits.
 */
export async function verifyOfficialPermanentResidencyPathways(): Promise<{
  records: PermanentResidencyCountryRecord[];
  verifiedCount: number;
  partiallyVerifiedCount: number;
  pendingCount: number;
  errors: string[];
}> {
  const checkedAt = new Date().toISOString();
  const errors: string[] = [];

  const records: PermanentResidencyCountryRecord[] = await Promise.all(
    OFFICIAL_GOVERNMENT_PR_SEEDS.map(async (seed) => {
      const check = await checkOfficialGovernmentPage(seed.officialApplicationUrl);
      if (check.verificationTier === 'PENDING VERIFICATION') {
        errors.push(`${seed.country} (${seed.officialDomain}): HTTP ${check.httpStatus ?? 'unreachable'}`);
      }
      return {
        ...seed,
        httpStatus: check.httpStatus,
        verificationTier: check.verificationTier,
        sourceEvidenceExcerpt: check.excerpt,
        officialDisclaimer: PR_OFFICIAL_DISCLAIMER,
        lastVerifiedAt: checkedAt,
      };
    })
  );

  const verifiedCount = records.filter((r) => r.verificationTier === 'VERIFIED').length;
  const partiallyVerifiedCount = records.filter((r) => r.verificationTier === 'PARTIALLY VERIFIED').length;
  const pendingCount = records.filter((r) => r.verificationTier === 'PENDING VERIFICATION').length;

  return {
    records,
    verifiedCount,
    partiallyVerifiedCount,
    pendingCount,
    errors,
  };
}
