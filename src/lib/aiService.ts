import { Vacancy } from '../types/job';
import { JobSeekerProfile } from '../types/jobSeeker';
import { CustomerVisitCountSummary, CustomerVisitAiInsight } from '../types/analytics';
import { safeResponseJson, fetchCustomerVisitCountFromFirestore } from './firebase';
import { trackAnalyticsEvent } from './analyticsTracker';

export interface SmartSearchAiResponse {
  interpretedQuery: string;
  matchedVacancyIds: string[];
  explanation: string;
  searchTip: string;
  modelUsed?: string;
}

export interface VacancyAssistantAiResponse {
  summary: string;
  eligibilityChecklist: string[];
  fitAssessment: string;
  interviewQuestions: string[];
  answer: string;
  modelUsed?: string;
}

export interface CoverLetterAiResponse {
  coverLetterText: string;
  keyHighlights: string[];
  modelUsed?: string;
}

export interface CareerCoachAiResponse {
  polishedBio: string;
  suggestedDesiredTitles: string[];
  suggestedSkills: string[];
  profileStrengthTips: string[];
  adviceAnswer: string;
  modelUsed?: string;
}

export interface AdminVacancyDraftAiResponse {
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  applicationInstructions: string;
  telegramCaption: string;
  modelUsed?: string;
}

export async function fetchCustomerVisitCount(
  excludeAdmin: boolean = true
): Promise<CustomerVisitCountSummary | null> {
  const [fsResult, apiResult] = await Promise.allSettled([
    fetchCustomerVisitCountFromFirestore(excludeAdmin),
    fetch(`/api/analytics/visit-count?excludeAdmin=${excludeAdmin ? 'true' : 'false'}`).then(async (res) =>
      res.ok ? await safeResponseJson<CustomerVisitCountSummary>(res) : null
    ),
  ]);

  const fsStats = fsResult.status === 'fulfilled' ? fsResult.value : null;
  const apiStats = apiResult.status === 'fulfilled' ? apiResult.value : null;

  if (fsStats && (!apiStats || fsStats.totalUniqueVisits >= apiStats.totalUniqueVisits)) {
    return fsStats;
  }
  return apiStats || fsStats || null;
}

export async function generateVisitCountAiInsights(
  excludeAdmin: boolean = true
): Promise<CustomerVisitAiInsight> {
  const visitStats = await fetchCustomerVisitCount(excludeAdmin);
  const res = await fetch('/api/ai/visit-count-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ excludeAdmin, visitStats }),
  });
  const data = await safeResponseJson<CustomerVisitAiInsight & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'Unable to generate AI customer visit insight right now.');
  }
  trackAnalyticsEvent('ai_assist', { filterType: 'visit_count_insights' });
  return data;
}

export async function runAiSmartSearch(payload: {
  query: string;
  vacancies: Vacancy[];
  userProfile?: JobSeekerProfile | null;
}): Promise<SmartSearchAiResponse> {
  const res = await fetch('/api/ai/smart-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson<SmartSearchAiResponse & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'AI Smart Search is temporarily unavailable.');
  }
  trackAnalyticsEvent('ai_assist', {
    filterType: 'smart_search',
    searchTerm: payload.query,
    resultsCount: data.matchedVacancyIds?.length ?? 0,
  });
  return data;
}

export async function askAiVacancyAssistant(payload: {
  vacancy: Vacancy;
  userProfile?: JobSeekerProfile | null;
  task: 'analyze' | 'interview' | 'qa';
  question?: string;
}): Promise<VacancyAssistantAiResponse> {
  const res = await fetch('/api/ai/vacancy-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson<VacancyAssistantAiResponse & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'AI Vacancy Assistant is temporarily unavailable.');
  }
  trackAnalyticsEvent('ai_assist', {
    filterType: `vacancy_${payload.task}`,
    jobId: payload.vacancy.id,
    jobTitle: payload.vacancy.title,
    organization: payload.vacancy.organization,
    category: payload.vacancy.category,
  });
  return data;
}

export async function generateAiCoverLetter(payload: {
  vacancy: Vacancy;
  applicantName?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  userProfile?: JobSeekerProfile | null;
  tone?: 'formal' | 'ngo' | 'concise';
}): Promise<CoverLetterAiResponse> {
  const res = await fetch('/api/ai/cover-letter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson<CoverLetterAiResponse & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'AI Cover Letter generator is temporarily unavailable.');
  }
  trackAnalyticsEvent('ai_assist', {
    filterType: 'cover_letter',
    jobId: payload.vacancy.id,
    jobTitle: payload.vacancy.title,
    organization: payload.vacancy.organization,
    category: payload.vacancy.category,
  });
  return data;
}

export async function askAiCareerCoach(payload: {
  userProfile?: JobSeekerProfile | null;
  question?: string;
  mode: 'profile_optimize' | 'advisor';
}): Promise<CareerCoachAiResponse> {
  const res = await fetch('/api/ai/career-coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson<CareerCoachAiResponse & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'AI Career Coach is temporarily unavailable.');
  }
  trackAnalyticsEvent('ai_assist', {
    filterType: `career_coach_${payload.mode}`,
  });
  return data;
}

export async function generateAdminVacancyDraft(payload: {
  title: string;
  organization: string;
  category: string;
  location?: string;
  experienceYears?: string;
  educationQualification?: string;
  notes?: string;
}): Promise<AdminVacancyDraftAiResponse> {
  const res = await fetch('/api/ai/admin-vacancy-assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await safeResponseJson<AdminVacancyDraftAiResponse & { error?: string }>(res);
  if (!res.ok || !data) {
    throw new Error(data?.error || 'AI Vacancy Drafting Assistant is temporarily unavailable.');
  }
  return data;
}
