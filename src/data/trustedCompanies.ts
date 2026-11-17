import { JobCategoryName } from '../types/job';

export interface EthiopianCompanyItem {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  sector: string;
  categoryName: JobCategoryName;
  location: string;
  summary: string;
  featured?: boolean;
}

export const ETHIOPIAN_TRUSTED_COMPANIES: EthiopianCompanyItem[] = [
  {
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    shortName: 'CBE',
    logoUrl: '/logos/cbe.jpg',
    sector: 'Banking & Finance',
    categoryName: 'Banking and Financial Institutions',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Ethiopia’s largest state-owned commercial bank hiring across branch operations, digital banking, credit analysis, and graduate trainee cohorts.',
    featured: true,
  },
  {
    id: 'ethio-telecom',
    name: 'Ethio telecom',
    shortName: 'Ethio telecom',
    logoUrl: '/logos/ethio-telecom.jpg',
    sector: 'Telecom & Digital',
    categoryName: 'IT and Technology',
    location: 'Addis Ababa & Regions',
    summary:
      'Leading telecommunications and Telebirr digital financial services operator offering roles in engineering, IT, and commercial operations.',
    featured: true,
  },
  {
    id: 'ethiopian-airlines',
    name: 'Ethiopian Airlines',
    shortName: 'Ethiopian Airlines',
    logoUrl: '/logos/ethiopian-airlines.svg',
    sector: 'Aviation & Hospitality',
    categoryName: 'Tourism and Travel',
    location: 'Bole International Airport, Addis Ababa',
    summary:
      'Africa’s flagship carrier recruiting across aviation maintenance, cabin crew, finance, IT systems, cargo logistics, and hospitality.',
    featured: true,
  },
  {
    id: 'dashen-bank',
    name: 'Dashen Bank',
    shortName: 'Dashen Bank',
    logoUrl: '/logos/dashen-bank.jpg',
    sector: 'Private Banking',
    categoryName: 'Banking and Financial Institutions',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Premier private financial institution hiring banking officers, digital product specialists, auditors, and relationship managers nationwide.',
    featured: true,
  },
  {
    id: 'awash-bank',
    name: 'Awash Bank',
    shortName: 'Awash Bank',
    logoUrl: '/logos/awash-bank.png',
    sector: 'Private Banking',
    categoryName: 'Banking and Financial Institutions',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Leading Ethiopian private bank providing nationwide opportunities in retail banking, corporate credit, risk management, and technology.',
    featured: true,
  },
  {
    id: 'bank-of-abyssinia',
    name: 'Bank of Abyssinia',
    shortName: 'Bank of Abyssinia',
    logoUrl: '/logos/bank-of-abyssinia.png',
    sector: 'Private Banking',
    categoryName: 'Banking and Financial Institutions',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Fast-growing commercial bank offering careers across virtual banking, branch service, treasury, and enterprise software engineering.',
    featured: true,
  },
  {
    id: 'eic',
    name: 'Ethiopian Insurance Corporation',
    shortName: 'EIC',
    logoUrl: '/logos/eic.png',
    sector: 'Insurance',
    categoryName: 'Insurance Companies',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Ethiopia’s foremost public insurance provider recruiting underwriting officers, claims specialists, actuaries, and finance professionals.',
    featured: true,
  },
  {
    id: 'coop-bank',
    name: 'Cooperative Bank of Oromia',
    shortName: 'Coopbank',
    logoUrl: '/logos/coop-bank.png',
    sector: 'Banking & Microfinance',
    categoryName: 'Banking and Financial Institutions',
    location: 'Addis Ababa & Regional Hubs',
    summary:
      'Major commercial bank supporting cooperative and digital finance roles across Addis Ababa, Adama, Jimma, and regional centers.',
    featured: true,
  },
  {
    id: 'zemen-bank',
    name: 'Zemen Bank',
    shortName: 'Zemen Bank',
    logoUrl: '/logos/zemen-bank.png',
    sector: 'Corporate Banking',
    categoryName: 'Banking and Financial Institutions',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'Specialized corporate and retail bank recruiting experienced financial analysts, IT officers, and client service leaders.',
    featured: false,
  },
  {
    id: 'unicef',
    name: 'UNICEF Ethiopia',
    shortName: 'UNICEF',
    logoUrl: '/logos/unicef.png',
    sector: 'UN & International NGO',
    categoryName: 'NGO and International Organizations',
    location: 'Addis Ababa & Field Offices',
    summary:
      'United Nations agency hiring WASH specialists, child protection officers, supply coordinators, and public health professionals.',
    featured: true,
  },
  {
    id: 'world-vision',
    name: 'World Vision Ethiopia',
    shortName: 'World Vision',
    logoUrl: '/logos/world-vision.svg',
    sector: 'Humanitarian & WASH',
    categoryName: 'NGO and International Organizations',
    location: 'Addis Ababa & Regions',
    summary:
      'International humanitarian organization offering field engineering, grant compliance, nutrition, and community development careers.',
    featured: false,
  },
  {
    id: 'undp',
    name: 'UNDP Ethiopia',
    shortName: 'UNDP',
    logoUrl: '/logos/undp.svg',
    sector: 'International Development',
    categoryName: 'NGO and International Organizations',
    location: 'Addis Ababa, Ethiopia',
    summary:
      'United Nations Development Programme hiring policy analysts, procurement officers, project managers, and governance advisors.',
    featured: false,
  },
];
