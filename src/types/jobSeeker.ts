export interface EducationItem {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  graduationYear: string;
  additionalInfo?: string;
}

export interface ExperienceItem {
  id: string;
  companyName: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string;
  achievements?: string;
}

export type StaffAccountRole = 'staff' | 'job_seeker';

export interface CertificationItem {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
}

export interface SeekerDocument {
  id: string;
  name: string;
  type: 'cv' | 'degree_certificate' | 'experience_letter' | 'certification' | 'other';
  url: string;
  storagePath?: string;
  sizeBytes?: number;
  uploadedAt: string;
}

export interface JobSeekerProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  photoUrl?: string;
  locationCity: string;
  locationRegion: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  storageUsedBytes?: number;
  storageCapacityBytes?: number;
  authProvider?: string;
  emailVerified?: boolean;

  // Staff & Account Classification
  accountRole?: StaffAccountRole;
  accountStatus?: 'active' | 'inactive' | 'suspended';
  suspendedAt?: string;
  suspendedReason?: string;
  lastActiveAt?: string;
  lastLoginAt?: string;
  staffDepartmentOrSector?: string;
  currentPosition?: string;
  previousPositions?: string[];

  // Professional Information
  employmentStatus: 'employed' | 'unemployed' | 'student' | 'freelance' | 'other';
  desiredJobTitle: string;
  preferredIndustry: string;
  preferredSectors?: string[];
  yearsOfExperience: string;
  expectedSalaryEtb: string;
  preferredEmploymentType: 'Full-time' | 'Part-time' | 'Contract' | 'Internship' | 'Remote' | 'Any';
  preferredWorkLocation: string;
  skills: string[];
  areasOfExpertise?: string[];
  professionalInterests?: string[];
  certifications?: CertificationItem[];

  // Education & Experience
  education: EducationItem[];
  experience: ExperienceItem[];

  // Documents
  documents: SeekerDocument[];

  // Job Preferences
  jobPreferences: {
    fullTime: boolean;
    partTime: boolean;
    contract: boolean;
    internship: boolean;
    remote: boolean;
    freshGraduate: boolean;
  };

  savedJobIds?: string[];
  noExperience?: boolean;
  profileStatus?: 'complete' | 'incomplete';
  profileCompletionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';
export type NotificationSubscriptionStatus = 'active' | 'none' | 'expired' | 'revoked';

export interface NotificationDeviceSubscription {
  deviceId: string;
  deviceLabel: string;
  platform: string;
  endpoint?: string;
  subscription?: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  active: boolean;
  createdAt: string;
  lastVerifiedAt: string;
  lastDeliveredAt?: string;
  lastFailureReason?: string;
}

export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

export interface NotificationPreferencesRecord {
  userId: string;
  permissionStatus: NotificationPermissionState;
  subscriptionStatus: NotificationSubscriptionStatus;
  frequency?: NotificationFrequency;
  enabledAt?: string;
  permissionVerifiedAt?: string;
  lastSuccessfulDeliveryAt?: string;
  lastDigestSentAt?: string;
  promptDismissCount?: number;
  channels: {
    websiteBell: boolean;
    browserPush: boolean;
    mobilePush: boolean;
    emailAlerts: boolean;
  };
  alertTypes: {
    newMatches: boolean;
    deadlineReminders: boolean;
    jobChanges: boolean;
    sectorUpdates: boolean;
  };
  preferredSectors?: string[];
  deviceSubscriptions: NotificationDeviceSubscription[];
  updatedAt: string;
}

export interface SchedulerRunRecord {
  id: string;
  trigger: 'vercel_cron' | 'background_interval' | 'manual_admin';
  status: 'success' | 'partial' | 'failed';
  dryRun?: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  usersEvaluated: number;
  usersEligibleForAlerts: number;
  recommendationsUpdated: number;
  notificationsCreated: number;
  pushAttempted: number;
  pushSucceeded: number;
  pushFailed: number;
  emailAttempted: number;
  emailSucceeded: number;
  emailFailed: number;
  retriesProcessed: number;
  errorSummary?: string;
  errors: string[];
}

export interface AdminSchedulerStatusResponse {
  success: boolean;
  checkedAt: string;
  environment: {
    runtime: 'vercel_serverless' | 'node_server';
    smtpConfigured: boolean;
    smtpHost: string;
    smtpPort: string;
    smtpUserConfigured: boolean;
    smtpPassConfigured: boolean;
    smtpFrom: string;
    vapidConfigured: boolean;
    vapidSource: 'environment' | 'persisted_file' | 'unset';
    vapidSubject: string;
    geminiConfigured: boolean;
    cronSecretConfigured: boolean;
    missingEnvVars: string[];
  };
  scheduler: {
    status: 'idle' | 'running' | 'error';
    cronPath: string;
    cronSchedule: string;
    lastRunStartedAt: string | null;
    lastSuccessfulRunAt: string | null;
    lastRunStatus: 'success' | 'partial' | 'failed' | null;
    nextScheduledRunAt: string;
  };
  totals: {
    totalNotificationsSent: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingNotifications: number;
    pushDeliveriesCount: number;
    emailDeliveriesCount: number;
    usersReceivingRecommendationsCount: number;
    activePushSubscriptionsCount: number;
  };
  recentErrors: Array<{
    timestamp: string;
    source: string;
    message: string;
  }>;
  recentRuns: SchedulerRunRecord[];
}

export type UserAlertKind =
  | 'new_match'
  | 'deadline_reminder'
  | 'job_updated'
  | 'sector_opportunity'
  | 'system_test';

export interface UserNotificationItem {
  id: string;
  userId: string;
  vacancyId: string;
  sourceType: 'domestic_job' | 'international_job' | 'scholarship' | 'system';
  alertKind: UserAlertKind;
  dedupeKey: string;
  title: string;
  employer: string;
  location: string;
  category: string;
  salary?: string;
  deadline?: string;
  matchScore: number;
  matchReasonSummary: string;
  matchReasons: string[];
  missingMandatoryQualifications: string[];
  applicationUrl?: string;
  jobUrl: string;
  read: boolean;
  readAt?: string;
  channels: {
    website: 'delivered';
    push: 'sent' | 'failed' | 'skipped' | 'queued';
    email: 'sent' | 'failed' | 'skipped_no_smtp' | 'skipped' | 'queued';
  };
  createdAt: string;
  expiresAt?: string;
  updatedAt: string;
}

export interface RegisteredUserAnalyticsSummary {
  generatedAt: string;
  metrics: {
    totalRegisteredUsers: number;
    onlineUsersCount: number;
    totalActiveUsers: number;
    totalInactiveUsers: number;
    totalSuspendedUsers: number;
    newRegistrationsToday: number;
    newRegistrationsThisWeek: number;
    newRegistrationsThisMonth: number;
    newRegistrationsThisYear: number;
    completedProfilesCount: number;
    incompleteProfilesCount: number;
    averageCompletionRate: number;
    notificationsEnabledCount: number;
    usersReceivingRecommendationsCount: number;
  };
  deliveryHealth: {
    queuePending: number;
    queueFailed: number;
    totalNotificationsSent: number;
    pushDeliveriesCount: number;
    emailDeliveriesCount: number;
    smtpConfigured: boolean;
    recentFailures: Array<{
      id: string;
      userId: string;
      channel: string;
      reason: string;
      attempts: number;
      updatedAt: string;
    }>;
  };
  registrationTimeline: Array<{
    date: string;
    count: number;
  }>;
  sectorBreakdown: Array<{
    sector: string;
    count: number;
  }>;
  educationBreakdown: Array<{
    level: string;
    count: number;
  }>;
  experienceBreakdown: Array<{
    band: string;
    count: number;
  }>;
  jobPreferenceBreakdown: Array<{
    position: string;
    count: number;
  }>;
  suspiciousDuplicates: Array<{
    reason: string;
    uids: string[];
    emails: string[];
  }>;
  users: Array<{
    uid: string;
    fullName: string;
    email: string;
    accountRole: StaffAccountRole;
    accountStatus: 'active' | 'inactive' | 'suspended';
    suspendedReason?: string;
    locationCity: string;
    desiredJobTitle: string;
    preferredIndustry: string;
    educationLevel: string;
    experienceBand: string;
    yearsOfExperience: string;
    noExperience?: boolean;
    profileCompletionPercentage: number;
    completedSections: string[];
    missingSections: string[];
    isProfileComplete: boolean;
    isOnline?: boolean;
    notificationsEnabled: boolean;
    permissionStatus: NotificationPermissionState;
    subscriptionStatus: NotificationSubscriptionStatus;
    frequency?: NotificationFrequency;
    emailAlertsEnabled: boolean;
    recommendationsCount: number;
    unreadNotificationsCount: number;
    applicationsCount: number;
    registeredAt: string;
    lastActiveAt?: string;
  }>;
}

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'interview'
  | 'rejected'
  | 'accepted';

export interface UserJobApplication {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone: string;
  vacancyId: string;
  vacancyTitle: string;
  organization: string;
  location: string;
  category: string;
  resumeUrl?: string;
  resumeName?: string;
  coverLetter?: string;
  status: ApplicationStatus;
  statusNotes?: string;
  statusTimeline: Array<{
    status: ApplicationStatus;
    timestamp: string;
    note?: string;
  }>;
  appliedAt: string;
  updatedAt: string;
}

export interface ProfileCompletionEvaluation {
  percentage: number;
  completedSections: string[];
  missingSections: string[];
  isProfileComplete: boolean;
}

export function evaluateMandatoryProfileCompletion(
  profile: Partial<JobSeekerProfile>
): ProfileCompletionEvaluation {
  const completedSections: string[] = [];
  const missingSections: string[] = [];
  let score = 0;

  // 1. Personal information (20 pts): fullName, email, phone, locationCity
  const hasPersonal = Boolean(
    profile.fullName &&
      profile.fullName.trim().length >= 2 &&
      profile.email &&
      profile.email.includes('@') &&
      profile.phone &&
      profile.phone.trim().length >= 6 &&
      profile.locationCity &&
      profile.locationCity.trim().length >= 2
  );
  if (hasPersonal) {
    score += 20;
    completedSections.push('Personal Information');
  } else {
    missingSections.push('Personal Information (Name, Phone & City)');
  }

  // 2. Education (20 pts)
  const hasEducation = Boolean(Array.isArray(profile.education) && profile.education.length > 0);
  if (hasEducation) {
    score += 20;
    completedSections.push('Education');
  } else {
    missingSections.push('Education History');
  }

  // 3. Employment history or explicit no-experience selection (20 pts)
  const hasEmploymentOrNone = Boolean(
    (Array.isArray(profile.experience) && profile.experience.length > 0) ||
      profile.noExperience === true
  );
  if (hasEmploymentOrNone) {
    score += 20;
    completedSections.push(profile.noExperience ? 'Employment Status (No Prior Experience)' : 'Employment History');
  } else {
    missingSections.push('Employment History (or No-Experience selection)');
  }

  // 4. Current or previous job (15 pts)
  const hasCurrentOrPreviousJob = Boolean(
    (profile.currentPosition && profile.currentPosition.trim().length >= 2) ||
      (Array.isArray(profile.previousPositions) && profile.previousPositions.length > 0) ||
      (Array.isArray(profile.experience) && profile.experience.length > 0) ||
      profile.noExperience === true
  );
  if (hasCurrentOrPreviousJob) {
    score += 15;
    completedSections.push('Current or Previous Role');
  } else {
    missingSections.push('Current or Previous Job Title');
  }

  // 5. Industry (15 pts)
  const hasIndustry = Boolean(
    (profile.preferredIndustry && profile.preferredIndustry.trim().length >= 2) ||
      (Array.isArray(profile.preferredSectors) && profile.preferredSectors.length > 0)
  );
  if (hasIndustry) {
    score += 15;
    completedSections.push('Professional Industry');
  } else {
    missingSections.push('Professional Industry');
  }

  // 6. Preferred job position (10 pts)
  const hasPreferredPosition = Boolean(profile.desiredJobTitle && profile.desiredJobTitle.trim().length >= 2);
  if (hasPreferredPosition) {
    score += 10;
    completedSections.push('Preferred Job Position');
  } else {
    missingSections.push('Preferred Job Position');
  }

  const bounded = Math.min(100, Math.max(0, score));
  return {
    percentage: bounded,
    completedSections,
    missingSections,
    isProfileComplete: missingSections.length === 0,
  };
}

export function calculateProfileCompletion(profile: Partial<JobSeekerProfile>): number {
  return evaluateMandatoryProfileCompletion(profile).percentage;
}

export const DEFAULT_JOB_SEEKER_PROFILE: JobSeekerProfile = {
  uid: '',
  email: '',
  fullName: '',
  phone: '',
  locationCity: 'Addis Ababa',
  locationRegion: 'Addis Ababa',
  accountRole: 'staff',
  accountStatus: 'active',
  staffDepartmentOrSector: '',
  currentPosition: '',
  previousPositions: [],
  employmentStatus: 'unemployed',
  desiredJobTitle: '',
  preferredIndustry: '',
  preferredSectors: [],
  yearsOfExperience: '',
  expectedSalaryEtb: '',
  preferredEmploymentType: 'Full-time',
  preferredWorkLocation: 'Addis Ababa',
  skills: [],
  areasOfExpertise: [],
  professionalInterests: [],
  certifications: [],
  education: [],
  experience: [],
  documents: [],
  jobPreferences: {
    fullTime: true,
    partTime: false,
    contract: false,
    internship: false,
    remote: false,
    freshGraduate: true,
  },
  noExperience: false,
  profileStatus: 'incomplete',
  profileCompletionPercentage: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
