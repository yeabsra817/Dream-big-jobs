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
    totalActiveUsers: number;
    totalInactiveUsers: number;
    totalSuspendedUsers: number;
    newRegistrationsToday: number;
    newRegistrationsThisWeek: number;
    newRegistrationsThisMonth: number;
    completedProfilesCount: number;
    incompleteProfilesCount: number;
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
    profileCompletionPercentage: number;
    isProfileComplete: boolean;
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

export function calculateProfileCompletion(profile: Partial<JobSeekerProfile>): number {
  let score = 0;
  const weights = {
    fullName: 10,
    email: 10,
    phone: 8,
    locationCity: 7,
    desiredJobTitleOrPosition: 10,
    skillsAndExpertise: 10,
    education: 15,
    experience: 15,
    certificationsOrInterests: 5,
    documents: 10,
  };

  if (profile.fullName && profile.fullName.trim().length > 2) score += weights.fullName;
  if (profile.email && profile.email.includes('@')) score += weights.email;
  if (profile.phone && profile.phone.trim().length > 5) score += weights.phone;
  if (profile.locationCity && profile.locationCity.trim().length > 1) score += weights.locationCity;
  if (
    (profile.desiredJobTitle && profile.desiredJobTitle.trim().length > 2) ||
    (profile.currentPosition && profile.currentPosition.trim().length > 2)
  ) {
    score += weights.desiredJobTitleOrPosition;
  }
  if (
    (profile.skills && profile.skills.length > 0) ||
    (profile.areasOfExpertise && profile.areasOfExpertise.length > 0)
  ) {
    score += weights.skillsAndExpertise;
  }
  if (profile.education && profile.education.length > 0) score += weights.education;
  if (
    (profile.experience && profile.experience.length > 0) ||
    (profile.previousPositions && profile.previousPositions.length > 0)
  ) {
    score += weights.experience;
  }
  if (
    (profile.certifications && profile.certifications.length > 0) ||
    (profile.professionalInterests && profile.professionalInterests.length > 0)
  ) {
    score += weights.certificationsOrInterests;
  }
  if (profile.documents && profile.documents.length > 0) score += weights.documents;

  return Math.min(100, Math.max(10, score));
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
  preferredIndustry: 'Banking and Financial Institutions',
  preferredSectors: ['Banking and Financial Institutions'],
  yearsOfExperience: '0-1 Years (Entry Level)',
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
  profileCompletionPercentage: 20,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
