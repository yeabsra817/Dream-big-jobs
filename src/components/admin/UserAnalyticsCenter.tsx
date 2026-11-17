import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  Users,
  Download,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserX,
  Ban,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Activity,
  X,
  Clock,
  Play,
  Server,
  Send,
  GraduationCap,
  Briefcase,
  Building2,
  Sparkles,
  Radio,
  Smartphone,
  Monitor,
  History,
  Sliders,
  Megaphone,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import {
  AdminSchedulerStatusResponse,
  JobSeekerProfile,
  NotificationFrequency,
  NotificationPreferencesRecord,
  RegisteredUserAnalyticsSummary,
  evaluateMandatoryProfileCompletion,
} from '../../types/jobSeeker';
import {
  fetchAdminNotificationPolicy,
  fetchAdminSchedulerStatus,
  fetchRegisteredUserAnalyticsAdmin,
  sendAdminBroadcastNotification,
  sendAdminTestNotificationToUsers,
  sendAuthorizedDeviceTestPush,
  syncAllUsersFromFirestoreToServer,
  triggerAdminSchedulerRun,
  updateAdminNotificationPolicy,
  updateAdminUserAccountStatus,
  updateAdminUserNotificationPreferences,
} from '../../lib/notificationService';
import {
  auth,
  db,
  establishDeveloperGoogleSession,
  getOwnerAuthHeaders,
  googleProvider,
  handleFirestoreError,
  isUserAdmin,
  OperationType,
  signInWithPopup,
} from '../../lib/firebase';

interface Props {
  adminEmail?: string | null;
}

type UserFilterKey =
  | 'all'
  | 'online'
  | 'completed'
  | 'incomplete'
  | 'notifications_enabled'
  | 'active'
  | 'inactive'
  | 'suspended';

function getAddisDateKey(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function classifyEducation(u: Partial<JobSeekerProfile>): string {
  const eduList = Array.isArray(u.education) ? u.education : [];
  if (eduList.length === 0) return 'Not Specified';
  const eduQuals = eduList
    .map((e) => `${e.qualification || ''} ${e.fieldOfStudy || ''}`)
    .join(' ')
    .toLowerCase();
  if (/phd|doctor/i.test(eduQuals)) return 'PhD / Doctorate';
  if (/master|msc|mba|ma\b|mph/i.test(eduQuals)) return "Master's Degree";
  if (/bachelor|bsc|ba\b|degree|undergraduate/i.test(eduQuals)) return "Bachelor's Degree";
  if (/diploma|associate|level/i.test(eduQuals)) return 'Diploma / TVET';
  return eduList[0]?.qualification || 'Certificate / Other';
}

function classifyExperience(u: Partial<JobSeekerProfile>): string {
  const rawYearsStr = String(u.yearsOfExperience || '');
  const yrsNumMatch = rawYearsStr.match(/\d+/);
  const expEntries = Array.isArray(u.experience) ? u.experience.length : 0;
  if (u.noExperience === true && expEntries === 0) return 'No Experience / Fresh Graduate';
  if (yrsNumMatch) {
    const y = parseInt(yrsNumMatch[0], 10);
    if (y === 0) return 'No Experience / Fresh Graduate';
    if (y <= 2) return '1-2 Years';
    if (y <= 5) return '3-5 Years';
    return '5+ Years';
  }
  if (expEntries > 0) return expEntries === 1 ? '1-2 Years' : '3-5 Years';
  return 'Not Specified';
}

export const UserAnalyticsCenter: React.FC<Props> = ({ adminEmail }) => {
  const [summary, setSummary] = useState<RegisteredUserAnalyticsSummary | null>(null);
  const [serverBaseline, setServerBaseline] = useState<RegisteredUserAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<UserFilterKey>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [educationFilter, setEducationFilter] = useState<string>('all');
  const [experienceFilter, setExperienceFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  // Firebase Auth Live Stream State
  const [firebaseUser, setFirebaseUser] = useState(() => auth.currentUser);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Live Firestore collection snapshots
  const fsProfilesRef = useRef<Map<string, JobSeekerProfile>>(new Map());
  const fsPrefsRef = useRef<Map<string, NotificationPreferencesRecord>>(new Map());
  const fsSubsRef = useRef<Map<string, any>>(new Map());
  const fsNotifsRef = useRef<Map<string, any[]>>(new Map());
  const fsAppsRef = useRef<Map<string, number>>(new Map());
  const serverSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Account Status Action Modal State
  const [targetUser, setTargetUser] = useState<RegisteredUserAnalyticsSummary['users'][0] | null>(null);
  const [pendingStatus, setPendingStatus] = useState<'active' | 'inactive' | 'suspended'>('suspended');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Instant Web Push & Diagnostics Console State
  const [schedulerStatus, setSchedulerStatus] = useState<AdminSchedulerStatusResponse | null>(null);
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [isTestingThisDevice, setIsTestingThisDevice] = useState(false);
  const [testingUid, setTestingUid] = useState<string | null>(null);
  const [testAlertResult, setTestAlertResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Admin Broadcast & Notification Frequency Policy State
  const [policyDefaultFreq, setPolicyDefaultFreq] = useState<NotificationFrequency>('instant');
  const [policyDailyCap, setPolicyDailyCap] = useState<number>(3);
  const [applyPolicyToExisting, setApplyPolicyToExisting] = useState<boolean>(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [updatingFreqUid, setUpdatingFreqUid] = useState<string | null>(null);

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState<
    'all_subscribed' | 'completed_profiles' | 'by_sector' | 'all_registered'
  >('all_subscribed');
  const [broadcastSector, setBroadcastSector] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsub();
  }, []);

  const recomputeLiveSummary = useCallback(
    (baseline: RegisteredUserAnalyticsSummary | null) => {
      const fsProfiles = fsProfilesRef.current;
      const fsPrefs = fsPrefsRef.current;
      const fsSubs = fsSubsRef.current;
      const fsNotifs = fsNotifsRef.current;
      const fsApps = fsAppsRef.current;

      // If Firestore hasn't delivered any snapshot docs yet, fall back to server summary
      if (fsProfiles.size === 0) {
        if (baseline) setSummary(baseline);
        return;
      }

      // Build lookup from server baseline for recs/deliveryHealth enrichment
      const baselineUsersByUid = new Map<string, RegisteredUserAnalyticsSummary['users'][0]>();
      for (const bu of baseline?.users || []) {
        baselineUsersByUid.set(bu.uid, bu);
      }

      // Merge any server-only profiles not yet in Firestore snapshot (preserve existing users)
      const mergedProfileEntries: Array<{ uid: string; raw: Partial<JobSeekerProfile> }> = [];
      const seenUids = new Set<string>();
      for (const [uid, p] of fsProfiles.entries()) {
        seenUids.add(uid);
        mergedProfileEntries.push({ uid, raw: p });
      }
      for (const bu of baseline?.users || []) {
        if (!seenUids.has(bu.uid)) {
          mergedProfileEntries.push({
            uid: bu.uid,
            raw: {
              uid: bu.uid,
              fullName: bu.fullName,
              email: bu.email,
              accountRole: bu.accountRole,
              accountStatus: bu.accountStatus,
              suspendedReason: bu.suspendedReason,
              locationCity: bu.locationCity,
              desiredJobTitle: bu.desiredJobTitle,
              preferredIndustry: bu.preferredIndustry,
              yearsOfExperience: bu.yearsOfExperience,
              noExperience: bu.noExperience,
              profileCompletionPercentage: bu.profileCompletionPercentage,
              createdAt: bu.registeredAt,
              lastActiveAt: bu.lastActiveAt,
            },
          });
        }
      }

      const now = Date.now();
      const todayKey = getAddisDateKey(new Date());
      const monthPrefix = todayKey.slice(0, 7);
      const yearPrefix = todayKey.slice(0, 4);
      const weekAgoMs = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;
      const onlineWindowMs = now - 5 * 60 * 1000;

      let onlineUsersCount = 0;
      let totalActiveUsers = 0;
      let totalInactiveUsers = 0;
      let totalSuspendedUsers = 0;
      let newRegistrationsToday = 0;
      let newRegistrationsThisWeek = 0;
      let newRegistrationsThisMonth = 0;
      let newRegistrationsThisYear = 0;
      let completedProfilesCount = 0;
      let incompleteProfilesCount = 0;
      let completionSum = 0;
      let notificationsEnabledCount = 0;
      let usersReceivingRecommendationsCount = 0;

      const sectorCounts = new Map<string, number>();
      const educationCounts = new Map<string, number>();
      const experienceCounts = new Map<string, number>();
      const jobPrefCounts = new Map<string, number>();
      const timelineCounts = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const k = getAddisDateKey(new Date(now - i * 24 * 60 * 60 * 1000));
        if (k) timelineCounts.set(k, 0);
      }

      const emailGroups = new Map<string, Array<{ uid: string; email: string }>>();

      const usersList = mergedProfileEntries.map(({ uid, raw: u }) => {
        const baseUser = baselineUsersByUid.get(uid);
        const regIso = u.createdAt || baseUser?.registeredAt || u.updatedAt || new Date().toISOString();
        const lastActIso = u.lastActiveAt || u.lastLoginAt || baseUser?.lastActiveAt || u.updatedAt || regIso;
        const regDateKey = getAddisDateKey(regIso);
        const regMs = new Date(regIso).getTime() || 0;
        const lastActMs = new Date(lastActIso).getTime() || regMs;
        const isOnline = lastActMs >= onlineWindowMs;

        if (isOnline) onlineUsersCount += 1;
        if (regDateKey === todayKey) newRegistrationsToday += 1;
        if (regMs >= weekAgoMs) newRegistrationsThisWeek += 1;
        if (regDateKey.startsWith(monthPrefix)) newRegistrationsThisMonth += 1;
        if (regDateKey.startsWith(yearPrefix)) newRegistrationsThisYear += 1;
        if (regDateKey && timelineCounts.has(regDateKey)) {
          timelineCounts.set(regDateKey, (timelineCounts.get(regDateKey) || 0) + 1);
        }

        const explicitStatus = u.accountStatus || baseUser?.accountStatus;
        let accountStatus: 'active' | 'inactive' | 'suspended' = 'active';
        if (explicitStatus === 'suspended') {
          accountStatus = 'suspended';
          totalSuspendedUsers += 1;
          totalInactiveUsers += 1;
        } else if (explicitStatus === 'inactive' || now - lastActMs > thirtyDaysAgoMs) {
          accountStatus = 'inactive';
          totalInactiveUsers += 1;
        } else {
          accountStatus = 'active';
          totalActiveUsers += 1;
        }

        const evalResult =
          fsProfiles.has(uid)
            ? evaluateMandatoryProfileCompletion(u)
            : {
                percentage: baseUser?.profileCompletionPercentage ?? 0,
                completedSections: baseUser?.completedSections || [],
                missingSections: baseUser?.missingSections || [],
                isProfileComplete: Boolean(baseUser?.isProfileComplete),
              };
        const completionPct = evalResult.percentage;
        const isProfileComplete = evalResult.isProfileComplete;
        completionSum += completionPct;
        if (isProfileComplete) completedProfilesCount += 1;
        else incompleteProfilesCount += 1;

        const educationLevel = fsProfiles.has(uid)
          ? classifyEducation(u)
          : baseUser?.educationLevel || 'Not Specified';
        educationCounts.set(educationLevel, (educationCounts.get(educationLevel) || 0) + 1);

        const experienceBand = fsProfiles.has(uid)
          ? classifyExperience(u)
          : baseUser?.experienceBand || 'Not Specified';
        experienceCounts.set(experienceBand, (experienceCounts.get(experienceBand) || 0) + 1);

        const prefPos = String(u.desiredJobTitle || u.currentPosition || 'Not Specified').trim() || 'Not Specified';
        jobPrefCounts.set(prefPos, (jobPrefCounts.get(prefPos) || 0) + 1);

        const sectorLabel =
          String(u.preferredIndustry || u.preferredSectors?.[0] || u.staffDepartmentOrSector || 'Unspecified').trim() ||
          'Unspecified';
        sectorCounts.set(sectorLabel, (sectorCounts.get(sectorLabel) || 0) + 1);

        const pref = fsPrefs.get(uid);
        const userSubDocs = Array.from(fsSubs.values()).filter((s) => s.userId === uid);
        const hasActiveFsSub = userSubDocs.some((s) => s.active !== false && s.endpoint);
        const hasActivePrefDev = Boolean(pref?.deviceSubscriptions?.some((d) => d.active));
        const permissionStatus = pref?.permissionStatus || baseUser?.permissionStatus || 'default';
        const subscriptionStatus =
          hasActiveFsSub || hasActivePrefDev
            ? 'active'
            : pref?.subscriptionStatus || baseUser?.subscriptionStatus || 'none';
        const notificationsEnabled = Boolean(
          permissionStatus === 'granted' || hasActiveFsSub || hasActivePrefDev || baseUser?.notificationsEnabled
        );
        if (notificationsEnabled) notificationsEnabledCount += 1;

        const recsCount = baseUser?.recommendationsCount ?? 0;
        if (recsCount > 0 && accountStatus !== 'suspended') {
          usersReceivingRecommendationsCount += 1;
        }

        const fsNotifList = fsNotifs.get(uid) || [];
        const unreadCount =
          fsNotifList.length > 0
            ? fsNotifList.filter((n) => !n.read).length
            : baseUser?.unreadNotificationsCount ?? 0;

        const appsCount = fsApps.get(uid) ?? baseUser?.applicationsCount ?? 0;

        const normEmail = String(u.email || '').toLowerCase().trim();
        if (normEmail) {
          const arr = emailGroups.get(normEmail) || [];
          arr.push({ uid, email: normEmail });
          emailGroups.set(normEmail, arr);
        }

        const expList = Array.isArray(u.experience) ? u.experience : [];
        const currentOrPreviousEmployer =
          String(
            expList[0]?.companyName ||
              u.staffDepartmentOrSector ||
              baseUser?.currentOrPreviousEmployer ||
              (u.noExperience ? 'Fresh Graduate / No Prior Employer' : 'Not Specified')
          ).trim() || 'Not Specified';

        const eduList = Array.isArray(u.education) ? u.education : [];
        const firstEdu = eduList[0];
        const educationSummary = firstEdu
          ? `${firstEdu.qualification || educationLevel}${firstEdu.fieldOfStudy ? ` in ${firstEdu.fieldOfStudy}` : ''}`
          : baseUser?.educationSummary || educationLevel;

        return {
          uid,
          fullName: u.fullName || 'Registered User',
          email: u.email || '',
          accountRole: (u.accountRole || 'staff') as 'staff' | 'job_seeker',
          accountStatus,
          suspendedReason: u.suspendedReason,
          locationCity: u.locationCity || 'Addis Ababa',
          desiredJobTitle: u.desiredJobTitle || u.currentPosition || '',
          preferredIndustry: sectorLabel,
          currentOrPreviousEmployer,
          educationSummary,
          educationLevel,
          experienceBand,
          yearsOfExperience: String(u.yearsOfExperience || ''),
          noExperience: Boolean(u.noExperience),
          profileCompletionPercentage: completionPct,
          completedSections: evalResult.completedSections,
          missingSections: evalResult.missingSections,
          isProfileComplete,
          isOnline,
          notificationsEnabled,
          permissionStatus,
          subscriptionStatus,
          frequency: pref?.frequency || baseUser?.frequency || 'instant',
          emailAlertsEnabled: Boolean(pref?.channels?.emailAlerts),
          recommendationsCount: recsCount,
          unreadNotificationsCount: unreadCount,
          applicationsCount: appsCount,
          registeredAt: regIso,
          lastActiveAt: lastActIso,
        };
      });

      const suspiciousDuplicates: RegisteredUserAnalyticsSummary['suspiciousDuplicates'] = [];
      for (const [email, items] of emailGroups.entries()) {
        if (items.length > 1) {
          suspiciousDuplicates.push({
            reason: `Duplicate email across ${items.length} accounts (${email})`,
            uids: items.map((i) => i.uid),
            emails: items.map((i) => i.email),
          });
        }
      }

      let fsTotalNotifs = 0;
      let fsPushSent = 0;
      for (const list of fsNotifs.values()) {
        for (const n of list) {
          fsTotalNotifs += 1;
          if (n.channels?.push === 'sent') fsPushSent += 1;
        }
      }

      const nextSummary: RegisteredUserAnalyticsSummary = {
        generatedAt: new Date().toISOString(),
        metrics: {
          totalRegisteredUsers: usersList.length,
          onlineUsersCount,
          totalActiveUsers,
          totalInactiveUsers,
          totalSuspendedUsers,
          newRegistrationsToday,
          newRegistrationsThisWeek,
          newRegistrationsThisMonth,
          newRegistrationsThisYear,
          completedProfilesCount,
          incompleteProfilesCount,
          averageCompletionRate: usersList.length > 0 ? Math.round(completionSum / usersList.length) : 0,
          notificationsEnabledCount,
          usersReceivingRecommendationsCount,
        },
        deliveryHealth: {
          queuePending: baseline?.deliveryHealth?.queuePending ?? 0,
          queueFailed: baseline?.deliveryHealth?.queueFailed ?? 0,
          totalNotificationsSent: Math.max(baseline?.deliveryHealth?.totalNotificationsSent ?? 0, fsTotalNotifs),
          pushDeliveriesCount: Math.max(baseline?.deliveryHealth?.pushDeliveriesCount ?? 0, fsPushSent),
          emailDeliveriesCount: baseline?.deliveryHealth?.emailDeliveriesCount ?? 0,
          smtpConfigured: baseline?.deliveryHealth?.smtpConfigured ?? false,
          recentFailures: baseline?.deliveryHealth?.recentFailures || [],
        },
        registrationTimeline: Array.from(timelineCounts.entries()).map(([date, count]) => ({ date, count })),
        sectorBreakdown: Array.from(sectorCounts.entries())
          .map(([sector, count]) => ({ sector, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
        educationBreakdown: Array.from(educationCounts.entries())
          .map(([level, count]) => ({ level, count }))
          .sort((a, b) => b.count - a.count),
        experienceBreakdown: Array.from(experienceCounts.entries())
          .map(([band, count]) => ({ band, count }))
          .sort((a, b) => b.count - a.count),
        jobPreferenceBreakdown: Array.from(jobPrefCounts.entries())
          .map(([position, count]) => ({ position, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        suspiciousDuplicates:
          suspiciousDuplicates.length > 0 ? suspiciousDuplicates : baseline?.suspiciousDuplicates || [],
        users: usersList.sort(
          (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
        ),
      };

      setSummary(nextSummary);
    },
    []
  );

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
      const [data, sched, policy] = await Promise.all([
        fetchRegisteredUserAnalyticsAdmin(adminEmail || undefined),
        fetchAdminSchedulerStatus(adminEmail || undefined),
        fetchAdminNotificationPolicy(adminEmail || undefined),
      ]);
      if (data) {
        setServerBaseline(data);
        if (fsProfilesRef.current.size > 0) {
          recomputeLiveSummary(data);
        } else {
          setSummary(data);
        }
      } else if (fsProfilesRef.current.size === 0) {
        setError('Unable to load user analytics. Ensure an owner session is active.');
      }
      if (sched) {
        setSchedulerStatus(sched);
      }
      if (policy) {
        setPolicyDefaultFreq(policy.defaultFrequency || 'instant');
        setPolicyDailyCap(policy.dailyCapPerUser || 3);
      }
    } catch (err: any) {
      if (fsProfilesRef.current.size === 0) {
        setError(err?.message || 'Failed loading registered user analytics.');
      }
    } finally {
      setLoading(false);
    }
  }, [adminEmail, recomputeLiveSummary]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Attach real-time Firestore onSnapshot listeners whenever an authenticated owner Google user is active
  useEffect(() => {
    const canStreamFirestore = Boolean(firebaseUser && isUserAdmin(firebaseUser));
    if (!canStreamFirestore) {
      setIsRealtimeConnected(false);
      return;
    }

    setIsRealtimeConnected(true);

    const scheduleServerSync = () => {
      if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
      serverSyncTimerRef.current = setTimeout(() => {
        syncAllUsersFromFirestoreToServer(adminEmail || undefined).catch(() => {});
      }, 1500);
    };

    const unsubProfiles = onSnapshot(
      collection(db, 'job_seeker_profiles'),
      (snap) => {
        const nextMap = new Map<string, JobSeekerProfile>();
        snap.forEach((docSnap) => {
          const data = docSnap.data() as JobSeekerProfile;
          if (data?.uid) nextMap.set(data.uid, data);
        });
        fsProfilesRef.current = nextMap;
        setLoading(false);
        setError(null);
        recomputeLiveSummary(serverBaseline);
        scheduleServerSync();
      },
      (err) => {
        console.warn('Firestore profiles snapshot notice:', err?.message || err);
        setIsRealtimeConnected(false);
        try {
          handleFirestoreError(err, OperationType.LIST, 'job_seeker_profiles');
        } catch {}
      }
    );

    const unsubPrefs = onSnapshot(
      collection(db, 'user_notification_preferences'),
      (snap) => {
        const nextMap = new Map<string, NotificationPreferencesRecord>();
        snap.forEach((docSnap) => {
          const data = docSnap.data() as NotificationPreferencesRecord;
          if (data?.userId) nextMap.set(data.userId, data);
        });
        fsPrefsRef.current = nextMap;
        recomputeLiveSummary(serverBaseline);
        scheduleServerSync();
      },
      (err) => {
        console.warn('Firestore preferences snapshot notice:', err?.message || err);
      }
    );

    const unsubSubs = onSnapshot(
      collection(db, 'push_subscriptions'),
      (snap) => {
        const nextMap = new Map<string, any>();
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.userId && data?.endpoint) nextMap.set(docSnap.id, data);
        });
        fsSubsRef.current = nextMap;
        recomputeLiveSummary(serverBaseline);
        scheduleServerSync();
      },
      (err) => {
        console.warn('Firestore push_subscriptions snapshot notice:', err?.message || err);
      }
    );

    const unsubNotifs = onSnapshot(
      collection(db, 'user_notifications'),
      (snap) => {
        const nextMap = new Map<string, any[]>();
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.userId) {
            const list = nextMap.get(data.userId) || [];
            list.push(data);
            nextMap.set(data.userId, list);
          }
        });
        fsNotifsRef.current = nextMap;
        recomputeLiveSummary(serverBaseline);
      },
      (err) => {
        console.warn('Firestore notifications snapshot notice:', err?.message || err);
      }
    );

    const unsubApps = onSnapshot(
      collection(db, 'job_applications'),
      (snap) => {
        const counts = new Map<string, number>();
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.userId) counts.set(data.userId, (counts.get(data.userId) || 0) + 1);
        });
        fsAppsRef.current = counts;
        recomputeLiveSummary(serverBaseline);
      },
      (err) => {
        console.warn('Firestore applications snapshot notice:', err?.message || err);
      }
    );

    return () => {
      unsubProfiles();
      unsubPrefs();
      unsubSubs();
      unsubNotifs();
      unsubApps();
      if (serverSyncTimerRef.current) clearTimeout(serverSyncTimerRef.current);
    };
  }, [firebaseUser, adminEmail, serverBaseline, recomputeLiveSummary]);

  const handleConnectGoogleStream = async () => {
    setIsConnectingGoogle(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res?.user && isUserAdmin(res.user)) {
        await establishDeveloperGoogleSession(res.user.email || adminEmail || '');
        setActionToast('Connected Owner Google Account — real-time Firestore live analytics active!');
        setTimeout(() => setActionToast(null), 4000);
        await loadAnalytics();
      } else {
        setError('Signed-in Google account is not an authorized owner email.');
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in popup could not complete.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleRunScheduler = async (dryRun: boolean) => {
    setIsRunningScheduler(true);
    setError(null);
    try {
      await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
      const res = await triggerAdminSchedulerRun({ dryRun }, adminEmail || undefined);
      if (res.schedulerStatus) {
        setSchedulerStatus(res.schedulerStatus);
      }
      if (res.skipped) {
        setActionToast(res.reason || 'Push evaluation sweep already in progress.');
      } else if (res.run) {
        setActionToast(
          `${dryRun ? 'Dry-run check' : 'Instant Push Sweep'} ${res.run.status}: ${res.run.usersEvaluated} users evaluated, ${res.run.notificationsCreated} alerts (${res.run.pushSucceeded} push delivered).`
        );
      }
      await loadAnalytics();
      setTimeout(() => setActionToast(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Failed running push notification check.');
    } finally {
      setIsRunningScheduler(false);
    }
  };

  const handleSendTestToSavedUsers = async (targetUid?: string) => {
    if (targetUid) setTestingUid(targetUid);
    else setIsSendingTestAlert(true);
    setTestAlertResult(null);
    setError(null);
    try {
      await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
      const res = await sendAdminTestNotificationToUsers(
        targetUid ? { targetUid } : { sendToAll: true },
        adminEmail || undefined
      );
      if (res.success) {
        const msg = `Test push alert delivered to ${res.usersNotified}/${res.usersTargeted} user(s): Website Bell (${res.usersNotified}), Web Push delivered (${res.pushSent}).`;
        setTestAlertResult({ ok: true, message: msg });
        setActionToast(msg);
        await loadAnalytics();
      } else {
        const errMsg = res.error || res.errors?.[0] || 'No saved active users available for test notification.';
        setTestAlertResult({ ok: false, message: errMsg });
      }
      setTimeout(() => setActionToast(null), 6000);
    } catch (err: any) {
      setTestAlertResult({ ok: false, message: err?.message || 'Failed sending test notification.' });
    } finally {
      setIsSendingTestAlert(false);
      setTestingUid(null);
    }
  };

  const handleTestAuthorizedDevicePush = async () => {
    setIsTestingThisDevice(true);
    setTestAlertResult(null);
    setError(null);
    try {
      const res = await sendAuthorizedDeviceTestPush(adminEmail || undefined);
      if (res.success) {
        const msg = res.message || `Real Web Push accepted for ${res.deviceLabel || 'this device'}.`;
        setTestAlertResult({ ok: true, message: msg });
        setActionToast(msg);
        await loadAnalytics();
      } else {
        setTestAlertResult({
          ok: false,
          message: res.error || 'Could not send test push to this device.',
        });
      }
      setTimeout(() => setActionToast(null), 6000);
    } catch (err: any) {
      setTestAlertResult({
        ok: false,
        message: err?.message || 'Authorized device push test failed.',
      });
    } finally {
      setIsTestingThisDevice(false);
    }
  };

  const handleSaveNotificationPolicy = async () => {
    setIsSavingPolicy(true);
    setError(null);
    setTestAlertResult(null);
    try {
      const res = await updateAdminNotificationPolicy(
        {
          defaultFrequency: policyDefaultFreq,
          dailyCapPerUser: policyDailyCap,
          applyFrequencyToExistingUsers: applyPolicyToExisting,
        },
        adminEmail || undefined
      );
      if (res.success && res.policy) {
        setPolicyDefaultFreq(res.policy.defaultFrequency);
        setPolicyDailyCap(res.policy.dailyCapPerUser);
        setApplyPolicyToExisting(false);
        const msg = `Notification policy saved: default frequency=${res.policy.defaultFrequency}, max ${res.policy.dailyCapPerUser}/day${
          res.usersUpdated ? ` (${res.usersUpdated} user records updated)` : ''
        }.`;
        setActionToast(msg);
        setTestAlertResult({ ok: true, message: msg });
        await loadAnalytics();
      } else {
        setTestAlertResult({ ok: false, message: res.error || 'Failed to save notification policy.' });
      }
      setTimeout(() => setActionToast(null), 5000);
    } catch (err: any) {
      setTestAlertResult({ ok: false, message: err?.message || 'Policy update failed.' });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const handleUpdateUserFrequency = async (uid: string, nextFreq: NotificationFrequency) => {
    setUpdatingFreqUid(uid);
    setError(null);
    try {
      const res = await updateAdminUserNotificationPreferences(
        uid,
        { frequency: nextFreq },
        adminEmail || undefined
      );
      if (res.success) {
        if (res.summary) {
          setServerBaseline(res.summary);
          recomputeLiveSummary(res.summary);
        } else {
          await loadAnalytics();
        }
        setActionToast(`Updated user notification frequency to ${nextFreq.toUpperCase()}.`);
        setTimeout(() => setActionToast(null), 3500);
      } else {
        setError(res.error || 'Failed updating user notification frequency.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed updating user notification frequency.');
    } finally {
      setUpdatingFreqUid(null);
    }
  };

  const handleSendAdminBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setTestAlertResult({ ok: false, message: 'Please enter both an announcement title and message.' });
      return;
    }
    setIsSendingBroadcast(true);
    setTestAlertResult(null);
    setError(null);
    try {
      await syncAllUsersFromFirestoreToServer(adminEmail || undefined);
      const res = await sendAdminBroadcastNotification(
        {
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          audience: broadcastAudience,
          ...(broadcastAudience === 'by_sector' && broadcastSector.trim()
            ? { sector: broadcastSector.trim() }
            : {}),
        },
        adminEmail || undefined
      );
      if (res.success) {
        const msg = `Announcement delivered to ${res.targetedUsersCount || 0} user(s): Website Bell (${
          res.websiteDeliveredCount || 0
        }), Web Push (${res.pushDeliveredCount || 0}).`;
        setTestAlertResult({ ok: true, message: msg });
        setActionToast(msg);
        setBroadcastTitle('');
        setBroadcastMessage('');
        await loadAnalytics();
      } else {
        setTestAlertResult({
          ok: false,
          message: res.error || 'No users matched the selected broadcast audience.',
        });
      }
      setTimeout(() => setActionToast(null), 6000);
    } catch (err: any) {
      setTestAlertResult({ ok: false, message: err?.message || 'Broadcast failed.' });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const uniqueIndustries = useMemo(() => {
    const set = new Set<string>();
    (summary?.users || []).forEach((u) => {
      if (u.preferredIndustry && u.preferredIndustry !== 'Unspecified') set.add(u.preferredIndustry);
    });
    return Array.from(set).sort();
  }, [summary]);

  const uniqueEducations = useMemo(() => {
    const set = new Set<string>();
    (summary?.users || []).forEach((u) => {
      if (u.educationLevel) set.add(u.educationLevel);
    });
    return Array.from(set).sort();
  }, [summary]);

  const uniqueExperiences = useMemo(() => {
    const set = new Set<string>();
    (summary?.users || []).forEach((u) => {
      if (u.experienceBand) set.add(u.experienceBand);
    });
    return Array.from(set).sort();
  }, [summary]);

  const filteredUsers = useMemo(() => {
    const list = summary?.users || [];
    const q = searchQuery.toLowerCase().trim();
    return list.filter((u) => {
      if (activeFilter === 'online' && !u.isOnline) return false;
      if (activeFilter === 'active' && u.accountStatus !== 'active') return false;
      if (activeFilter === 'inactive' && u.accountStatus !== 'inactive') return false;
      if (activeFilter === 'suspended' && u.accountStatus !== 'suspended') return false;
      if (activeFilter === 'completed' && !u.isProfileComplete) return false;
      if (activeFilter === 'incomplete' && u.isProfileComplete) return false;
      if (activeFilter === 'notifications_enabled' && !u.notificationsEnabled) return false;

      if (industryFilter !== 'all' && u.preferredIndustry !== industryFilter) return false;
      if (educationFilter !== 'all' && u.educationLevel !== educationFilter) return false;
      if (experienceFilter !== 'all' && u.experienceBand !== experienceFilter) return false;

      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.desiredJobTitle.toLowerCase().includes(q) ||
        u.preferredIndustry.toLowerCase().includes(q) ||
        (u.currentOrPreviousEmployer || '').toLowerCase().includes(q) ||
        (u.educationSummary || '').toLowerCase().includes(q) ||
        u.educationLevel.toLowerCase().includes(q) ||
        u.experienceBand.toLowerCase().includes(q) ||
        u.locationCity.toLowerCase().includes(q)
      );
    });
  }, [summary, searchQuery, activeFilter, industryFilter, educationFilter, experienceFilter]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/admin/users/export.csv', {
        headers: getOwnerAuthHeaders(adminEmail || undefined),
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to export user report. Ensure owner session is active.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `hopelandjobs-registered-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setActionToast('CSV export downloaded successfully.');
      setTimeout(() => setActionToast(null), 3000);
    } catch (err: any) {
      setError(err?.message || 'CSV export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!targetUser) return;
    setIsUpdatingStatus(true);
    try {
      const updatedSummary = await updateAdminUserAccountStatus(
        targetUser.uid,
        pendingStatus,
        statusReason.trim() || undefined,
        adminEmail || undefined
      );
      if (updatedSummary) {
        setServerBaseline(updatedSummary);
        recomputeLiveSummary(updatedSummary);
      }
      setActionToast(`${targetUser.fullName} updated to ${pendingStatus.toUpperCase()}.`);
      setTimeout(() => setActionToast(null), 3500);
      setTargetUser(null);
      setStatusReason('');
    } catch (err: any) {
      setError(err?.message || 'Failed updating account status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const metrics = summary?.metrics;
  const timeline = summary?.registrationTimeline || [];
  const maxTimelineCount = Math.max(1, ...timeline.map((t) => t.count));
  const sectorList = summary?.sectorBreakdown || [];
  const maxSectorCount = Math.max(1, ...sectorList.map((s) => s.count));
  const educationList = summary?.educationBreakdown || [];
  const maxEducationCount = Math.max(1, ...educationList.map((e) => e.count));
  const experienceList = summary?.experienceBreakdown || [];
  const maxExperienceCount = Math.max(1, ...experienceList.map((e) => e.count));
  const jobPrefList = summary?.jobPreferenceBreakdown || [];
  const maxJobPrefCount = Math.max(1, ...jobPrefList.map((j) => j.count));

  return (
    <div className="space-y-6 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-extrabold text-slate-900">
              Real-Time Registered User Analytics &amp; Control
            </h2>
            {isRealtimeConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-extrabold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Firestore Stream
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                <Radio className="w-3 h-3 text-amber-600" />
                Server Snapshot Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Live stats synced directly from persisted user records: registrations, online activity, mandatory completion %, education, experience, industry, and job preferences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isRealtimeConnected && (
            <button
              type="button"
              onClick={handleConnectGoogleStream}
              disabled={isConnectingGoogle}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isConnectingGoogle ? 'Connecting...' : 'Connect Owner Google Account for Live Stream'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={loadAnalytics}
            disabled={loading}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExporting || !summary}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExporting ? 'Exporting...' : 'Download CSV Report'}</span>
          </button>
        </div>
      </div>

      {actionToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadAnalytics}
            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* 12 Live Registered User KPI Cards */}
      {loading && !summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Total Registered Users</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.totalRegisteredUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Unique saved accounts</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Online Now</span>
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
              {metrics.onlineUsersCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active within 5 mins</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-amber-700">New Today (Daily)</div>
            <div className="text-2xl font-black text-amber-700 font-mono tabular-nums mt-1">
              {metrics.newRegistrationsToday}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Addis Ababa day</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">This Week (7 Days)</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.newRegistrationsThisWeek}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Weekly signups</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">This Month / Year</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.newRegistrationsThisMonth}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              This Year: {metrics.newRegistrationsThisYear}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-emerald-700">Completed Profiles</div>
            <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
              {metrics.completedProfilesCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">All 6 mandatory sections</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-amber-700">Incomplete Profiles</div>
            <div className="text-2xl font-black text-amber-700 font-mono tabular-nums mt-1">
              {metrics.incompleteProfilesCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Missing mandatory fields</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-[#0B132B]">Avg Profile Completion</div>
            <div className="text-2xl font-black text-[#0B132B] font-mono tabular-nums mt-1">
              {metrics.averageCompletionRate}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Platform-wide score</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-emerald-700">Active Accounts</div>
            <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
              {metrics.totalActiveUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active within 30 days</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">Inactive &amp; Suspended</div>
            <div className="text-2xl font-black text-slate-700 font-mono tabular-nums mt-1">
              {metrics.totalInactiveUsers}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              Suspended: {metrics.totalSuspendedUsers}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-sky-700">Push Notifications Ready</div>
            <div className="text-2xl font-black text-sky-700 font-mono tabular-nums mt-1">
              {metrics.notificationsEnabledCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Granted or subscribed</div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200">
            <div className="text-[11px] font-bold text-slate-600">Receiving Job Matches</div>
            <div className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.usersReceivingRecommendationsCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Matched with active jobs</div>
          </div>
        </div>
      ) : null}

      {/* Registration Timeline + Instant Push Delivery Health */}
      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">14-Day Registration Timeline</h3>
                <p className="text-xs text-slate-500">Daily unique candidate &amp; staff signups</p>
              </div>
              <Activity className="w-4 h-4 text-slate-400" />
            </div>

            <div className="h-44 flex items-end gap-1.5 pt-4 border-b border-slate-200 pb-2">
              {timeline.map((day) => {
                const heightPct = Math.max(6, Math.round((day.count / maxTimelineCount) * 100));
                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center justify-end gap-1 h-full group"
                    title={`${day.date}: ${day.count} registrations`}
                  >
                    <span className="text-[10px] font-mono tabular-nums text-slate-600 font-bold">
                      {day.count > 0 ? day.count : ''}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${
                        day.count > 0 ? 'bg-[#0B132B] group-hover:bg-amber-500' : 'bg-slate-100'
                      }`}
                      style={{ height: `${day.count > 0 ? heightPct : 4}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{timeline[0]?.date}</span>
              <span>{timeline[Math.floor(timeline.length / 2)]?.date}</span>
              <span>{timeline[timeline.length - 1]?.date}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Instant Web Push Delivery Health</h3>
              <Bell className="w-4 h-4 text-amber-500" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Total Job Alerts Logged</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {summary.deliveryHealth.totalNotificationsSent}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Web Push Deliveries (Android &amp; Desktop)</span>
                <span className="font-mono font-bold tabular-nums text-emerald-700">
                  {summary.deliveryHealth.pushDeliveriesCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Delivery Mode</span>
                <span className="font-bold text-[#0B132B]">Instant Web Push Only</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">Daily Limit &amp; Dedupe</span>
                <span className="font-bold text-slate-800">Max 3/day · 1 per job</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">Push Retry Queue (Pending / Failed)</span>
                <span className="font-mono font-bold tabular-nums text-slate-900">
                  {summary.deliveryHealth.queuePending} / {summary.deliveryHealth.queueFailed}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Triggered automatically on job publish — matches Education, Experience, Industry, and Preferred Job Position. Email alerts are disabled.
            </p>
          </div>
        </div>
      )}

      {/* Breakdown Statistics: Industry, Education, Experience, Job Preferences */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Industry Statistics */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                <span>Industry Statistics</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">{sectorList.length} sectors</span>
            </div>
            {sectorList.length === 0 ? (
              <p className="text-xs text-slate-500">No industry preferences recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {sectorList.slice(0, 7).map((sec) => (
                  <div key={sec.sector} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{sec.sector}</span>
                      <span className="font-mono tabular-nums font-bold text-slate-600">{sec.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${Math.round((sec.count / maxSectorCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Education Statistics */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-sky-600" />
                <span>Education Statistics</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">{educationList.length} levels</span>
            </div>
            {educationList.length === 0 ? (
              <p className="text-xs text-slate-500">No educational records recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {educationList.map((ed) => (
                  <div key={ed.level} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{ed.level}</span>
                      <span className="font-mono tabular-nums font-bold text-slate-600">{ed.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${Math.round((ed.count / maxEducationCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Work Experience Statistics */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <span>Work Experience Statistics</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">{experienceList.length} bands</span>
            </div>
            {experienceList.length === 0 ? (
              <p className="text-xs text-slate-500">No work experience records yet.</p>
            ) : (
              <div className="space-y-2.5">
                {experienceList.map((ex) => (
                  <div key={ex.band} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{ex.band}</span>
                      <span className="font-mono tabular-nums font-bold text-slate-600">{ex.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.round((ex.count / maxExperienceCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job Preference Statistics */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0B132B]" />
                <span>Job Preference Statistics</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">{jobPrefList.length} target roles</span>
            </div>
            {jobPrefList.length === 0 ? (
              <p className="text-xs text-slate-500">No preferred job titles recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {jobPrefList.slice(0, 7).map((jp) => (
                  <div key={jp.position} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{jp.position}</span>
                      <span className="font-mono tabular-nums font-bold text-slate-600">{jp.count}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0B132B] rounded-full"
                        style={{ width: `${Math.round((jp.count / maxJobPrefCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Push Notification Management & Device Telemetry */}
      {schedulerStatus && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Push Notification Management &amp; Cross-Platform Delivery</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Trigger: <span className="font-mono text-slate-700">{schedulerStatus.scheduler.cronPath}</span> · Mode:{' '}
                <span className="font-mono text-slate-700">{schedulerStatus.scheduler.cronSchedule}</span> · Runtime:{' '}
                <span className="font-mono text-slate-700">{schedulerStatus.environment.runtime}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTestAuthorizedDevicePush}
                disabled={isTestingThisDevice}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{isTestingThisDevice ? 'Testing Device...' : 'Send Test Push to This Device'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendTestToSavedUsers()}
                disabled={isSendingTestAlert}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-extrabold inline-flex items-center gap-1.5 border border-amber-300 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5 text-amber-800" />
                <span>{isSendingTestAlert ? 'Sending Test Push...' : 'Send Test Push to Saved Users'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunScheduler(true)}
                disabled={isRunningScheduler}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Server className="w-3.5 h-3.5 text-slate-600" />
                <span>Dry-Run Match Check</span>
              </button>

              <button
                type="button"
                onClick={() => handleRunScheduler(false)}
                disabled={isRunningScheduler}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRunningScheduler ? 'Dispatching...' : 'Dispatch Matching Push Now'}</span>
              </button>
            </div>
          </div>

          {testAlertResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                testAlertResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testAlertResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testAlertResult.message}</span>
            </div>
          )}

          {/* Cross-Platform Subscription & Delivery Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-500">Subscribed Users</div>
              <div className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {schedulerStatus.pushStats?.totalSubscribedUsers ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                +{schedulerStatus.pushStats?.anonymousActiveDevices ?? 0} guest devices
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>Android</span>
              </div>
              <div className="text-xl font-black font-mono tabular-nums text-emerald-900 mt-1">
                {schedulerStatus.pushStats?.androidSubscriptions ?? 0}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">Active devices</div>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
              <div className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                <span>iPhone / iPad</span>
              </div>
              <div className="text-xl font-black font-mono tabular-nums text-sky-900 mt-1">
                {schedulerStatus.pushStats?.iphoneSubscriptions ?? 0}
              </div>
              <div className="text-[10px] text-sky-700 mt-0.5">iOS 16.4+ PWA</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Monitor className="w-3 h-3" />
                <span>Desktop</span>
              </div>
              <div className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {schedulerStatus.pushStats?.desktopSubscriptions ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Windows &amp; Mac</div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200">
              <div className="text-[11px] font-bold text-emerald-700">Active Subs</div>
              <div className="text-xl font-black font-mono tabular-nums text-emerald-800 mt-1">
                {schedulerStatus.pushStats?.activeSubscriptions ?? schedulerStatus.totals.activePushSubscriptionsCount}
              </div>
              <div className="text-[10px] text-emerald-700 mt-0.5">Verified endpoints</div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <div className="text-[11px] font-bold text-amber-800">Invalid / Expired</div>
              <div className="text-xl font-black font-mono tabular-nums text-amber-900 mt-1">
                {schedulerStatus.pushStats?.invalidOrExpiredSubscriptions ?? 0}
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">404/410 &amp; disabled</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600">Sent Today</div>
              <div className="text-xl font-black font-mono tabular-nums text-slate-900 mt-1">
                {schedulerStatus.pushStats?.notificationsSentToday ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Max 3/user/day</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600">Accepted / Failed</div>
              <div className="text-lg font-black font-mono tabular-nums text-slate-900 mt-1">
                <span className="text-emerald-700">{schedulerStatus.pushStats?.pushAcceptedCount ?? schedulerStatus.totals.pushDeliveriesCount}</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-rose-600">{schedulerStatus.pushStats?.pushFailedCount ?? schedulerStatus.totals.failedDeliveries}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Push service status</div>
            </div>
          </div>

          {/* VAPID & Environment Telemetry */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-700">
            <span>
              VAPID Web Push:{' '}
              <strong className={schedulerStatus.environment.vapidConfigured ? 'text-emerald-700' : 'text-rose-700'}>
                {schedulerStatus.environment.vapidConfigured
                  ? `Active (${schedulerStatus.environment.vapidSource === 'environment' ? 'Vercel Env' : 'Persisted Keypair'})`
                  : 'Unset'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Subscribed Push Devices:{' '}
              <strong className="font-mono tabular-nums text-slate-900">
                {schedulerStatus.totals.activePushSubscriptionsCount}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Email Delivery:{' '}
              <strong className="text-slate-600">Disabled (Web Push + Bell Only)</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Cron Limit Mode:{' '}
              <strong className="text-emerald-700">Event-Driven (Vercel Hobby Compatible)</strong>
            </span>
          </div>

          {/* Admin Targeted Announcement Broadcast + Platform Notification Frequency Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-slate-200">
            {/* Targeted Announcement / Job Alert Broadcast Composer */}
            <form
              onSubmit={handleSendAdminBroadcast}
              className="lg:col-span-7 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-600" />
                  <span>Send Announcement or Targeted Job Alert (Push + Website Bell)</span>
                </h4>
                <span className="text-[10px] font-bold text-slate-500">Zero Email</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Target Audience
                  </label>
                  <select
                    value={broadcastAudience}
                    onChange={(e) => setBroadcastAudience(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="all_subscribed">All Push-Subscribed Users</option>
                    <option value="completed_profiles">Completed Profiles Only</option>
                    <option value="by_sector">Filter by Sector / Industry</option>
                    <option value="all_registered">All Active Registered Users</option>
                  </select>
                </div>

                {broadcastAudience === 'by_sector' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sector / Keyword
                    </label>
                    <input
                      type="text"
                      value={broadcastSector}
                      onChange={(e) => setBroadcastSector(e.target.value)}
                      placeholder="e.g. Banking, WASH, NGO..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Notification Title
                    </label>
                    <input
                      type="text"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      placeholder="e.g. አዳዲስ የባንክና የNGO ስራዎች ወጥተዋል!"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                )}
              </div>

              {broadcastAudience === 'by_sector' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Notification Title
                  </label>
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. New Banking & NGO Vacancies Published!"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Alert Message Body
                </label>
                <textarea
                  rows={2}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Write an announcement or vacancy alert message for matching registered users..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isSendingBroadcast ? 'Sending Broadcast...' : 'Send Targeted Alert Now'}</span>
                </button>
              </div>
            </form>

            {/* Platform Notification Frequency & Daily Limit Policy */}
            <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0B132B]" />
                  <span>Notification Frequency &amp; Daily Limit Policy</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Default Delivery Cadence
                    </label>
                    <select
                      value={policyDefaultFreq}
                      onChange={(e) => setPolicyDefaultFreq(e.target.value as NotificationFrequency)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="instant">Instant (On Publish)</option>
                      <option value="daily">Daily Digest (24h)</option>
                      <option value="weekly">Weekly Summary</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Max Alerts / User / Day
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={policyDailyCap}
                      onChange={(e) =>
                        setPolicyDailyCap(Math.min(10, Math.max(1, Number(e.target.value) || 3)))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={applyPolicyToExisting}
                    onChange={(e) => setApplyPolicyToExisting(e.target.checked)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Also apply this frequency to all existing registered users</span>
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveNotificationPolicy}
                  disabled={isSavingPolicy}
                  className="min-h-[38px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSavingPolicy ? 'Saving Policy...' : 'Save Frequency Policy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Job Notification History Log */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-600" />
                <span>Job Notification History ({schedulerStatus.notificationHistory?.length || 0})</span>
              </h4>
              <span className="text-[11px] text-slate-500">Latest real push delivery requests</span>
            </div>

            {!schedulerStatus.notificationHistory || schedulerStatus.notificationHistory.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                No push notifications have been dispatched yet. Publish a matching vacancy or tap <strong>Send Test Push to This Device</strong> above to inspect live push delivery logs.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Recipient</th>
                      <th className="py-2.5 px-3">Vacancy / Alert</th>
                      <th className="py-2.5 px-3">Platform &amp; Device</th>
                      <th className="py-2.5 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schedulerStatus.notificationHistory.slice(0, 20).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-800">{item.userName}</div>
                          {item.userEmail && <div className="text-[10px] text-slate-500">{item.userEmail}</div>}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{item.jobTitle}</div>
                          <div className="text-[10px] text-slate-500">
                            {item.employer}
                            {item.isTest ? ' · Test Push' : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-1.5">
                            {item.platform}
                          </span>
                          <span className="text-[11px] text-slate-600">{item.deviceLabel}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`font-bold text-[11px] px-2 py-0.5 rounded ${
                              item.status === 'accepted'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : item.status === 'expired'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {item.status.toUpperCase()}
                            {item.statusCode ? ` (${item.statusCode})` : ''}
                          </span>
                          {item.error && <div className="text-[10px] text-rose-700 mt-0.5 line-clamp-1">{item.error}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Integrity Flags */}
      {summary && (summary.suspiciousDuplicates.length > 0 || summary.deliveryHealth.recentFailures.length > 0) && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">Security &amp; Delivery Notices</h3>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {summary.suspiciousDuplicates.map((dup, i) => (
              <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <div className="font-bold text-amber-950">{dup.reason}</div>
                <div className="text-[11px] text-amber-900">Emails: {dup.emails.join(', ')}</div>
              </div>
            ))}
            {summary.deliveryHealth.recentFailures.slice(0, 4).map((fail) => (
              <div key={fail.id} className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-0.5">
                <div className="font-bold text-rose-900">
                  Failed {fail.channel} delivery ({fail.attempts} attempts)
                </div>
                <div className="text-[11px] text-rose-800">{fail.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search, Multi-Dimension Filter & Registered Users Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <span>Registered Users Directory ({filteredUsers.length})</span>
            </h3>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, role, industry, city..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Multi-dimension dropdown filters: Industry, Education, Experience */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">All Industries</option>
              {uniqueIndustries.map((ind) => (
                <option key={ind} value={ind}>
                  Industry: {ind}
                </option>
              ))}
            </select>

            <select
              value={educationFilter}
              onChange={(e) => setEducationFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">All Education Levels</option>
              {uniqueEducations.map((ed) => (
                <option key={ed} value={ed}>
                  Education: {ed}
                </option>
              ))}
            </select>

            <select
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="all">All Experience Levels</option>
              {uniqueExperiences.map((ex) => (
                <option key={ex} value={ex}>
                  Experience: {ex}
                </option>
              ))}
            </select>
          </div>

          {/* Profile Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            {[
              { id: 'all', label: 'All' },
              { id: 'online', label: 'Online Now' },
              { id: 'completed', label: 'Completed Profiles' },
              { id: 'incomplete', label: 'Incomplete Profiles' },
              { id: 'notifications_enabled', label: 'Push Ready' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
              { id: 'suspended', label: 'Suspended' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as UserFilterKey)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                <th className="py-3 px-4">Registered User</th>
                <th className="py-3 px-4">Background &amp; Target Role</th>
                <th className="py-3 px-4">Profile Completion &amp; Missing</th>
                <th className="py-3 px-4">Push Status</th>
                <th className="py-3 px-4 text-right">Matches</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    No registered users match your current filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{u.fullName}</span>
                        {u.isOnline && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Online
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{u.desiredJobTitle || 'Not specified'}</div>
                      <div className="text-[11px] text-slate-600">
                        {u.preferredIndustry} · {u.educationSummary || u.educationLevel} · {u.experienceBand}
                      </div>
                      {u.currentOrPreviousEmployer && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Employer: {u.currentOrPreviousEmployer}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[260px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono tabular-nums font-extrabold ${
                            u.isProfileComplete ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {u.profileCompletionPercentage}%
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            u.isProfileComplete
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {u.isProfileComplete ? 'Complete' : 'Incomplete'}
                        </span>
                      </div>
                      {u.missingSections && u.missingSections.length > 0 ? (
                        <div className="text-[10px] text-amber-800 mt-1 line-clamp-2">
                          Missing: {u.missingSections.join(', ')}
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-700 mt-1">
                          All mandatory sections completed
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {u.notificationsEnabled ? 'Enabled' : 'Disabled'} ({u.permissionStatus})
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span>Sub: {u.subscriptionStatus}</span>
                        <span>·</span>
                        <select
                          aria-label={`Notification frequency for ${u.fullName}`}
                          value={u.frequency || 'instant'}
                          disabled={updatingFreqUid === u.uid}
                          onChange={(e) =>
                            handleUpdateUserFrequency(u.uid, e.target.value as NotificationFrequency)
                          }
                          className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-bold text-slate-700 cursor-pointer"
                        >
                          <option value="instant">Instant</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {u.recommendationsCount}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-bold ${
                          u.accountStatus === 'active'
                            ? 'text-emerald-700'
                            : u.accountStatus === 'suspended'
                            ? 'text-rose-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {u.accountStatus === 'active'
                          ? 'Active'
                          : u.accountStatus === 'suspended'
                          ? 'Suspended'
                          : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                      {u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {u.accountStatus !== 'suspended' && (
                          <button
                            type="button"
                            onClick={() => handleSendTestToSavedUsers(u.uid)}
                            disabled={testingUid === u.uid}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 font-bold text-[11px] inline-flex items-center gap-1 border border-sky-200 cursor-pointer disabled:opacity-50"
                            title="Send a test Web Push & Website Bell alert to this user"
                          >
                            <Send className="w-3 h-3" />
                            <span>{testingUid === u.uid ? 'Sending...' : 'Test Push'}</span>
                          </button>
                        )}
                        {u.accountStatus === 'suspended' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetUser(u);
                              setPendingStatus('active');
                              setStatusReason('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] inline-flex items-center gap-1 border border-emerald-200 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Reactivate</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTargetUser(u);
                              setPendingStatus('suspended');
                              setStatusReason('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-[11px] inline-flex items-center gap-1 border border-rose-200 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Suspend</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Suspend / Reactivate */}
      {targetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {pendingStatus === 'suspended' ? (
                  <UserX className="w-5 h-5 text-rose-600" />
                ) : (
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                )}
                <h3 className="text-base font-extrabold text-slate-900">
                  {pendingStatus === 'suspended'
                    ? 'Suspend User Account'
                    : 'Reactivate User Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTargetUser(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Account: <strong>{targetUser.fullName}</strong> ({targetUser.email}).{' '}
              {pendingStatus === 'suspended'
                ? 'Suspending pauses all automated recommendations and Web Push alerts until reactivated.'
                : 'Reactivating restores personalized recommendations and instant Web Push alerts.'}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Audit Log Reason (Optional)
              </label>
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason recorded in administrative audit log..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                disabled={isUpdatingStatus}
                className={`px-5 py-2 rounded-xl text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 ${
                  pendingStatus === 'suspended'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isUpdatingStatus
                  ? 'Updating...'
                  : pendingStatus === 'suspended'
                  ? 'Confirm Suspend'
                  : 'Confirm Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
