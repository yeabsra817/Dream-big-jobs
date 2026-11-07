import { Vacancy } from '../types/job';

// Current reference date (dynamically checked against current time)
export function isExpired(deadlineStr?: string): boolean {
  if (!deadlineStr || deadlineStr === 'Not specified in the original vacancy') return false;
  
  const now = Date.now();
  // Try parsing common date formats (YYYY-MM-DD, DD/MM/YYYY, Month DD, YYYY)
  const parsed = Date.parse(deadlineStr);
  if (isNaN(parsed)) {
    // Check if regex matches YYYY-MM-DD
    const match = deadlineStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      // Set end of that day (23:59:59)
      const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), 23, 59, 59);
      return d.getTime() < now;
    }
    return false;
  }
  // If parsed has no hours/minutes, add 24 hours so it expires at end of day
  return parsed + 24 * 60 * 60 * 1000 < now;
}

export function getDaysLeft(deadlineStr?: string): {
  text: string;
  urgent: boolean;
  expired: boolean;
  daysLeft: number;
} {
  if (!deadlineStr || deadlineStr === 'Not specified in the original vacancy') {
    return { text: 'Open / Ongoing', urgent: false, expired: false, daysLeft: 999 };
  }

  const parsed = Date.parse(deadlineStr);
  let targetTime = parsed;
  if (isNaN(parsed)) {
    const match = deadlineStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      targetTime = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), 23, 59, 59).getTime();
    } else {
      return { text: deadlineStr, urgent: false, expired: false, daysLeft: 999 };
    }
  }

  const now = Date.now();
  const diffDays = Math.ceil((targetTime - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Expired', urgent: false, expired: true, daysLeft: diffDays };
  }
  if (diffDays === 0) {
    return { text: 'Closing Today!', urgent: true, expired: false, daysLeft: 0 };
  }
  if (diffDays === 1) {
    return { text: '1 day left', urgent: true, expired: false, daysLeft: 1 };
  }
  if (diffDays <= 3) {
    return { text: `${diffDays} days left`, urgent: true, expired: false, daysLeft: diffDays };
  }
  return { text: `${diffDays} days left`, urgent: false, expired: false, daysLeft: diffDays };
}

// Sample authentic Ethiopian vacancies for the administrator to test the 50-vacancy bulk import
export const SAMPLE_BULK_PASTE_DATA = `VACANCY ANNOUNCEMENT 1
Organization: Commercial Bank of Ethiopia (CBE)
Position: Senior Risk & Compliance Officer
Job Category: Banking
Location: Addis Ababa, Head Office
Employment Type: Permanent / Full-time
Salary: As per Bank Scale (Attractive with housing & medical allowance)
Grade: Job Grade 12
Educational Qualification: B.A. or Master's Degree in Accounting, Banking & Finance, Economics, or Risk Management.
Experience: 6 years of relevant experience in commercial banking, of which 2 years as Risk Officer.
Required Skills: Knowledge of NBE directives, anti-money laundering (AML) frameworks, Basel compliance, risk modeling.
Main Duties & Responsibilities:
- Conduct risk assessments across retail, corporate, and digital banking channels.
- Ensure strict adherence to National Bank of Ethiopia prudential guidelines.
- Prepare monthly risk exposure reports for executive committee.
Required Documents: Updated CV, Degree & Student Copy, Work Experience letter, Kebele ID.
Application Method: Online Portal
Application URL: https://vacancy.cbe.com.et
Application Deadline: 2026-11-20
Reference Number: CBE-HR-2026-1042

--------------------------------------------------

VACANCY ANNOUNCEMENT 2
Organization: United Nations International Children's Emergency Fund (UNICEF Ethiopia)
Position: Child Protection in Emergencies Specialist (NO-C)
Job Category: NGO & International Organizations
Location: Hawassa, Sidama Region (with travel to field offices)
Employment Type: Fixed-Term Appointment (1 Year with renewal)
Salary: UN Salary Scale for National Officers in Ethiopia + UN allowances
Educational Qualification: Advanced university degree (Master's) in International Law, Social Work, Human Rights, or Development Studies.
Experience: Minimum 5 years of professional work experience in child protection planning and management in humanitarian settings.
Required Documents: P11 Form / UN Resume, Cover Letter, Certified copies of degrees, Two professional references.
Application Method: Online UNICEF Careers
Application URL: https://jobs.unicef.org/en-us/job/571822
Application Deadline: 2026-11-25
Contact Information: UNICEF Country Office, UNECA Compound, Addis Ababa

--------------------------------------------------

VACANCY ANNOUNCEMENT 3
Organization: British Embassy Addis Ababa
Position: Senior Economic & Trade Policy Officer
Job Category: Embassy & Diplomatic
Location: Addis Ababa (Bole Road)
Employment Type: Full-time (36 hours per week)
Salary: ETB 115,000 gross per month plus 13th month bonus
Educational Qualification: Minimum Bachelor's Degree in Economics, International Trade, Political Economy, or related discipline.
Experience: 4 years working with international organizations, government ministries, or diplomatic missions.
Required Skills: Fluent spoken and written English, knowledge of AfCFTA, Ethiopian macroeconomic reforms, and UK-Ethiopia trade partnership.
Application Method: Foreign, Commonwealth & Development Office (FCDO) Portal
Application URL: https://fco.tal.net/vx/mobile-0/appcentre-ext/brand-2/candidate/so/pm/4/pl/1/opp/22901
Application Deadline: 2026-11-18
Required Documents: CV, Cover letter, Proof of legal residence in Ethiopia.

--------------------------------------------------

VACANCY ANNOUNCEMENT 4
Organization: Ethiopian Skylight Hotel
Position: Executive Sous Chef (Fine Dining)
Job Category: Hotel & Hospitality
Location: Addis Ababa (Bole International Airport Area)
Employment Type: Full-time
Salary: Negotiable and Attractive + Service Charge
Educational Qualification: Diploma or Degree in Food Preparation, Culinary Arts, or Hotel Management from recognized institution.
Experience: 7 years culinary experience with at least 3 years in a 5-star international hotel.
Required Documents: CV, Culinary certifications, health food handler certificate, recent photo.
Application Method: In-Person / Email
Application Email: recruitment@ethiopianskylighthotel.com
Application Instructions: Submit CV and credentials in person at HR Department or email to recruitment@ethiopianskylighthotel.com.
Application Deadline: 2026-11-15
Reference Number: ESH-HR-CHEF-08

--------------------------------------------------

VACANCY ANNOUNCEMENT 5
Organization: Awash Bank S.C.
Position: Branch Manager (Grade I & Grade II)
Job Category: Banking
Location: Adama and Shashemene Branches
Employment Type: Permanent
Salary: Competitive per Awash Bank attractive salary scale
Educational Qualification: BA Degree in Banking & Finance, Management, Accounting, Economics.
Experience: 8 years of banking experience, with 3 years as Assistant Branch Manager or Customer Service Manager.
Required Documents: Application letter, comprehensive CV, copies of educational documents and employment certificates.
Application Method: Online Portal
Application URL: https://jobs.awashbank.com
Application Deadline: 2026-11-22
Reference Number: AWASH/VAC/089/26

--------------------------------------------------

VACANCY ANNOUNCEMENT 6
Organization: Ethiopian Airlines Group
Position: Lead Flight Operations Dispatcher
Job Category: Tourism & Travel / Aviation
Location: Addis Ababa Bole International Airport
Employment Type: Full-time / Permanent
Salary: Attractive airline compensation package with flight privileges
Educational Qualification: BSc in Aeronautical Engineering, Physics, Mathematics, or valid ICAO Flight Dispatcher License.
Experience: Minimum 4 years active flight dispatching experience on commercial passenger jets.
Application Method: Ethiopian Airlines Recruitment Portal
Application URL: https://corporate.ethiopianairlines.com/AboutEthiopian/Careers
Application Deadline: 2026-11-28
Required Documents: License copy, CV, Degree certificate, Kebele ID.

--------------------------------------------------

VACANCY ANNOUNCEMENT 7
Organization: Oromia Credit and Saving Share Company (OCSSCO)
Position: Regional Internal Audit Inspector
Job Category: Microfinance Institutions
Location: Jimma & Nekemte
Employment Type: Full-time
Salary: ETB 38,500 + Field allowance
Educational Qualification: BA in Accounting and Finance, Auditing, or Business Administration.
Experience: 3+ years in microfinance or cooperative auditing.
Language Requirements: Afaan Oromo and English proficiency is mandatory.
Application Method: In-Person / Postal
Application Instructions: Submit physical credentials at OCSSCO Jimma District Office or send via P.O. Box 273.
Application Deadline: 2026-11-16
Contact Info: Telephone: +251 47 111 8920`;
