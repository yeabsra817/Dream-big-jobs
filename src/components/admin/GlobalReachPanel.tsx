import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Filter,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {
  GlobalReachChannel,
  GlobalReachContact,
  GlobalReachContactCategory,
  GlobalReachDashboardResponse,
  GlobalReachGeneratedDraft,
  GlobalReachOutreachApproach,
  GlobalReachRegion,
  GlobalReachSponsorshipTier,
  GlobalReachUserProfile,
  GlobalReachVerificationStatus,
} from '../../types/globalReach';
import {
  GLOBAL_REACH_ALL_APPROACHES,
  GLOBAL_REACH_ALL_CATEGORIES,
  GLOBAL_REACH_APPROACH_LABELS,
  GLOBAL_REACH_CATEGORY_LABELS,
  GLOBAL_REACH_ORG_SIZE_LABELS,
  GLOBAL_REACH_SPONSORSHIP_LABELS,
  GLOBAL_REACH_VERIFICATION_LABELS,
  buildBulkBccGmailBatches,
  buildPublicTelUrl,
  buildSingleGmailComposeUrl,
  buildWhatsAppChatUrl,
  inspectInstagramUrl,
  inspectLinkedInUrl,
  sanitizeExternalHttpUrl,
} from '../../utils/globalReachEngine';
import {
  acknowledgeGlobalReachNotifications,
  addGlobalReachSuppression,
  controlGlobalReachScheduler,
  createGlobalReachContact,
  deleteGlobalReachContact,
  fetchGlobalReachDashboard,
  generateGlobalReachDrafts,
  logGlobalReachOutreach,
  purgeGlobalReachWorkspaceData,
  removeGlobalReachSuppression,
  triggerGlobalReachDiscoveryNow,
  updateGlobalReachContact,
  updateGlobalReachProfile,
  verifyGlobalReachContactLive,
} from '../../lib/globalReachService';

interface Props {
  actorEmail?: string | null;
  actorUid?: string | null;
  compactMode?: boolean;
}

type SubTab = 'directory' | 'automation' | 'followups' | 'notifications' | 'profile';

const ALL_REGIONS: GlobalReachRegion[] = [
  'Europe',
  'North America',
  'Middle East',
  'Asia',
  'Africa',
  'Australia & Oceania',
  'South America',
];

function formatShortDate(iso?: string | null): string {
  if (!iso) return 'Not yet';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const GlobalReachPanel: React.FC<Props> = ({
  actorEmail,
  actorUid,
  compactMode = false,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('directory');
  const [data, setData] = useState<GlobalReachDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  const [sponsorshipFilter, setSponsorshipFilter] = useState<string>('all');
  const [importantOnly, setImportantOnly] = useState<boolean>(false);

  // Live Discovery controls
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverRegion, setDiscoverRegion] = useState<GlobalReachRegion | 'all'>('all');
  const [discoverCountry, setDiscoverCountry] = useState('');
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [isControllingScheduler, setIsControllingScheduler] = useState(false);

  // Selection & Bulk Outreach
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkBccModal, setShowBulkBccModal] = useState(false);
  const [bulkApproach, setBulkApproach] = useState<GlobalReachOutreachApproach>('employment_request');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkBody, setBulkBody] = useState('');
  const [bulkApproved, setBulkApproved] = useState(false);
  const [bulkFollowUpDate, setBulkFollowUpDate] = useState('');

  // Single Composer Modal
  const [composerContact, setComposerContact] = useState<GlobalReachContact | null>(null);
  const [composerApproach, setComposerApproach] = useState<GlobalReachOutreachApproach>('employment_request');
  const [composerDraft, setComposerDraft] = useState<GlobalReachGeneratedDraft | null>(null);
  const [composerSubject, setComposerSubject] = useState('');
  const [composerMessage, setComposerMessage] = useState('');
  const [composerWaText, setComposerWaText] = useState('');
  const [composerLiNote, setComposerLiNote] = useState('');
  const [composerFollowUpText, setComposerFollowUpText] = useState('');
  const [composerFollowUpDate, setComposerFollowUpDate] = useState('');
  const [composerHumanApproved, setComposerHumanApproved] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Edit Contact / Add Contact Modal
  const [editingContact, setEditingContact] = useState<GlobalReachContact | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<GlobalReachContactCategory>('potential_employers');
  const [editFollowUp, setEditFollowUp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editLinkedIn, setEditLinkedIn] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    entityType: 'organization' as 'individual' | 'organization',
    fullName: '',
    companyName: '',
    positionOrRole: '',
    industry: 'Banking & Financial Services',
    country: '',
    city: '',
    officialWebsite: '',
    publicEmail: '',
    whatsAppBusinessNumber: '',
    linkedInUrl: '',
    instagramUrl: '',
    category: 'potential_employers' as GlobalReachContactCategory,
    personalNotes: '',
  });

  // Profile & Privacy State
  const [profileDraft, setProfileDraft] = useState<GlobalReachUserProfile | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [suppressDomain, setSuppressDomain] = useState('');
  const [suppressReason, setSuppressReason] = useState('Contact requested opt-out');
  const [confirmPurge, setConfirmPurge] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const resp = await fetchGlobalReachDashboard(actorEmail, actorUid);
      setData(resp);
      setProfileDraft((prev) => prev || resp.profile);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to load Global Reach workspace.');
    } finally {
      setLoading(false);
    }
  }, [actorEmail, actorUid]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredContacts = useMemo(() => {
    if (!data?.contacts) return [];
    const q = searchText.trim().toLowerCase();
    return data.contacts.filter((c) => {
      if (regionFilter !== 'all' && c.region !== regionFilter) return false;
      if (countryFilter !== 'all' && c.country !== countryFilter) return false;
      if (industryFilter !== 'all' && c.industry !== industryFilter) return false;
      if (entityTypeFilter !== 'all' && c.entityType !== entityTypeFilter) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (verificationFilter !== 'all' && c.verificationStatus !== verificationFilter) return false;
      if (sponsorshipFilter !== 'all' && c.sponsorshipTier !== sponsorshipFilter) return false;
      if (importantOnly && !c.isImportant) return false;
      if (channelFilter !== 'all') {
        if (channelFilter === 'gmail' && !c.publicEmail) return false;
        if (channelFilter === 'whatsapp' && !(c.whatsAppBusinessUrl || c.whatsAppBusinessNumber)) return false;
        if (channelFilter === 'linkedin' && !c.linkedInUrl) return false;
        if (channelFilter === 'instagram' && !c.instagramUrl) return false;
        if (channelFilter === 'contact_page' && !c.contactPageUrl) return false;
        if (channelFilter === 'phone' && !c.publicBusinessPhone) return false;
      }
      if (q) {
        const hay = [
          c.fullName,
          c.companyName,
          c.positionOrRole,
          c.industry,
          c.country,
          c.city,
          c.publicEmail,
          c.personalNotes,
          c.sourceName,
          ...(c.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    data?.contacts,
    searchText,
    regionFilter,
    countryFilter,
    industryFilter,
    entityTypeFilter,
    categoryFilter,
    channelFilter,
    verificationFilter,
    sponsorshipFilter,
    importantOnly,
  ]);

  const selectedContacts = useMemo(() => {
    if (!data?.contacts) return [];
    return data.contacts.filter((c) => selectedIds.has(c.id));
  }, [data?.contacts, selectedIds]);

  const bulkBccBatches = useMemo(() => {
    const emails = selectedContacts.map((c) => c.publicEmail || '').filter(Boolean);
    return buildBulkBccGmailBatches({
      recipients: emails,
      subject: bulkSubject,
      body: bulkBody,
      maxPerBatch: 25,
    });
  }, [selectedContacts, bulkSubject, bulkBody]);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard fallback not critical
    }
  };

  const handleRunDiscoveryNow = async () => {
    setIsDiscovering(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await triggerGlobalReachDiscoveryNow(actorEmail, actorUid, {
        region: discoverRegion,
        country: discoverCountry.trim() || undefined,
        query: discoverQuery.trim() || undefined,
      });
      setFeedbackMsg(
        `Discovery cycle completed (${res.cycleLog.regionScanned}): ${res.cycleLog.newContactsAdded} new contacts added, ${res.cycleLog.verifiedCount} verified, ${res.cycleLog.duplicatesPrevented} duplicates prevented.`
      );
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Live discovery run failed.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleSchedulerControl = async (action: 'pause' | 'resume' | 'enable' | 'disable') => {
    setIsControllingScheduler(true);
    setErrorMsg(null);
    try {
      await controlGlobalReachScheduler(actorEmail, actorUid, action);
      setFeedbackMsg(`Hourly automation updated: ${action}.`);
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update scheduler state.');
    } finally {
      setIsControllingScheduler(false);
    }
  };

  const openComposer = (contact: GlobalReachContact, initialApproach?: GlobalReachOutreachApproach) => {
    const defaultApproach: GlobalReachOutreachApproach =
      initialApproach ||
      (contact.mentorshipAvailable
        ? 'professional_mentorship'
        : contact.websiteDevProspect && !/bank|finance/i.test(contact.industry)
        ? 'website_development'
        : /bank|finance|microfinance|fintech/i.test(contact.industry)
        ? 'banking_finance_career'
        : 'employment_request');

    setComposerContact(contact);
    setComposerApproach(defaultApproach);
    setComposerDraft(null);
    setComposerSubject('');
    setComposerMessage('');
    setComposerWaText('');
    setComposerLiNote('');
    setComposerFollowUpText('');
    setComposerFollowUpDate('');
    setComposerHumanApproved(false);
    setComposerError(null);
  };

  const handleGenerateComposerDraft = async (mode: 'ai' | 'manual_template') => {
    if (!composerContact) return;
    setIsGeneratingDraft(true);
    setComposerError(null);
    try {
      const drafts = await generateGlobalReachDrafts(actorEmail, actorUid, {
        contactIds: [composerContact.id],
        approach: composerApproach,
        mode,
      });
      const d = drafts[0];
      if (d) {
        setComposerDraft(d);
        setComposerSubject(d.subject);
        setComposerMessage(d.message);
        setComposerWaText(d.whatsappShortMessage);
        setComposerLiNote(d.linkedInNote);
        setComposerFollowUpText(d.followUpMessage);
      }
    } catch (err: any) {
      setComposerError(err?.message || 'Draft generation failed.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleRecordAndOpenChannel = async (
    contact: GlobalReachContact,
    channel: GlobalReachChannel,
    urlToOpen: string,
    previewText: string,
    subject?: string
  ) => {
    try {
      await logGlobalReachOutreach(actorEmail, actorUid, {
        contactIds: [contact.id],
        channel,
        approach: composerApproach,
        subject,
        messagePreview: previewText || subject || `Opened ${channel}`,
        mode: 'single',
        nextFollowUpDate: composerFollowUpDate || undefined,
      });
      await loadDashboard();
    } catch {
      // Non-blocking log failure
    }
    const link = document.createElement('a');
    link.href = urlToOpen;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  };

  const handleOpenBulkModal = async () => {
    if (selectedContacts.length === 0) return;
    setBulkApproved(false);
    setBulkFollowUpDate('');
    setShowBulkBccModal(true);
    // Load respectful editable template for bulk review
    try {
      const drafts = await generateGlobalReachDrafts(actorEmail, actorUid, {
        contactIds: [selectedContacts[0].id],
        approach: bulkApproach,
        mode: 'manual_template',
      });
      if (drafts[0]) {
        setBulkSubject(drafts[0].subject);
        setBulkBody(drafts[0].message);
      }
    } catch {
      // Keep editable inputs empty
    }
  };

  const handleVerifyLive = async (contactId: string) => {
    setVerifyingId(contactId);
    setErrorMsg(null);
    try {
      const res = await verifyGlobalReachContactLive(actorEmail, actorUid, contactId);
      setFeedbackMsg(
        `Verified ${res.contact.fullName}: ${GLOBAL_REACH_VERIFICATION_LABELS[res.contact.verificationStatus]}`
      );
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Live contact verification failed.');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleToggleImportant = async (contact: GlobalReachContact) => {
    try {
      await updateGlobalReachContact(actorEmail, actorUid, contact.id, {
        isImportant: !contact.isImportant,
        isSavedByUser: true,
      });
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update contact.');
    }
  };

  const handleSaveEditContact = async () => {
    if (!editingContact) return;
    try {
      await updateGlobalReachContact(actorEmail, actorUid, editingContact.id, {
        personalNotes: editNotes,
        category: editCategory,
        nextFollowUpDate: editFollowUp,
        publicEmail: editEmail,
        whatsAppBusinessNumber: editWhatsApp,
        linkedInUrl: editLinkedIn,
        instagramUrl: editInstagram,
        isSavedByUser: true,
      });
      setEditingContact(null);
      setFeedbackMsg('Contact updated and saved.');
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save contact edits.');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteGlobalReachContact(actorEmail, actorUid, contactId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete contact.');
    }
  };

  const handleCreateManualContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await createGlobalReachContact(actorEmail, actorUid, newContactForm);
      setShowAddModal(false);
      setNewContactForm({
        entityType: 'organization',
        fullName: '',
        companyName: '',
        positionOrRole: '',
        industry: 'Banking & Financial Services',
        country: '',
        city: '',
        officialWebsite: '',
        publicEmail: '',
        whatsAppBusinessNumber: '',
        linkedInUrl: '',
        instagramUrl: '',
        category: 'potential_employers',
        personalNotes: '',
      });
      setFeedbackMsg('Contact added to your Global Reach directory.');
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not add contact.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileDraft) return;
    setIsSavingProfile(true);
    setErrorMsg(null);
    try {
      const updated = await updateGlobalReachProfile(actorEmail, actorUid, profileDraft);
      setProfileDraft(updated);
      setFeedbackMsg('Professional profile saved and contact relevance scores refreshed.');
      await loadDashboard();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExportJson = () => {
    if (!data) return;
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      workspaceId: data.workspaceId,
      profile: data.profile,
      contacts: selectedIds.size > 0 ? selectedContacts : data.contacts,
      suppressionList: data.suppressionList,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hopeland-global-reach-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <RefreshCw className="w-6 h-6 text-slate-600 animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-800">Loading Global Reach workspace...</p>
      </div>
    );
  }

  const stats = data?.stats;
  const scheduler = data?.scheduler;

  return (
    <div className="space-y-6">
      {/* Header Surface */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-950 tracking-tight">
                  GLOBAL REACH — Discover People, Build Connections, Find Opportunities Worldwide
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  {data?.isOwnerWorkspace
                    ? `Private Owner Workspace (${data.profile.fullName}) · Autonomous hourly discovery across real public sources`
                    : `Private User Workspace · Isolated to your own professional profile and contacts`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunDiscoveryNow}
              disabled={isDiscovering}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isDiscovering ? 'animate-spin' : ''}`} />
              <span>{isDiscovering ? 'Discovering Live...' : 'Run Live Discovery Now'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contact</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export JSON</span>
            </button>
          </div>
        </div>

        {/* Top KPI Strip (Strict Real DB Counters, Tabular Numerals) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-200">
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">Total Contacts</div>
              <div className="text-xl font-bold text-slate-950 tabular-nums mt-0.5">{stats.totalContacts}</div>
              <div className="text-[11px] text-slate-600 tabular-nums">+{stats.newContactsThisHour} this hour</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">Verified Contacts</div>
              <div className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">{stats.verifiedContactsFound}</div>
              <div className="text-[11px] text-slate-600 tabular-nums">{stats.newCompaniesDiscovered} organizations</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">Public Emails</div>
              <div className="text-xl font-bold text-slate-950 tabular-nums mt-0.5">{stats.contactsWithPublicEmail}</div>
              <div className="text-[11px] text-slate-600 tabular-nums">WA: {stats.contactsWithPublicWhatsApp} · LI: {stats.contactsWithLinkedIn}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">Employers / Sponsorship</div>
              <div className="text-xl font-bold text-slate-950 tabular-nums mt-0.5">{stats.potentialEmployersFound}</div>
              <div className="text-[11px] text-slate-600 tabular-nums">{stats.potentialSponsorshipOpportunities} intl signals</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">Mentors &amp; Web Prospects</div>
              <div className="text-xl font-bold text-slate-950 tabular-nums mt-0.5">
                {stats.potentialMentorsFound} / {stats.websiteDevelopmentProspects}
              </div>
              <div className="text-[11px] text-slate-600 tabular-nums">{stats.outreachSentCount} outreach logged</div>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
              <div className="text-[11px] font-medium text-slate-500">Hourly Automation</div>
              <div className="text-sm font-bold text-slate-950 mt-1 capitalize">
                {scheduler?.status.replace('_', ' ')}
              </div>
              <div className="text-[11px] text-slate-600 truncate" title={scheduler?.nextScheduledRunEat || ''}>
                Next: {scheduler?.nextScheduledRunEat || 'Paused'}
              </div>
            </div>
          </div>
        )}

        {/* Segmented Sub-Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 mt-5 pt-4 border-t border-slate-200">
          {(
            [
              { id: 'directory', label: `Contact Directory (${data?.contacts.length || 0})`, icon: Users },
              { id: 'automation', label: 'Hourly Automation & Sources', icon: Clock },
              { id: 'followups', label: `Follow-Ups & History (${stats?.upcomingFollowUpsCount || 0})`, icon: Calendar },
              {
                id: 'notifications',
                label: `Alerts${data?.unreadNotificationsCount ? ` (${data.unreadNotificationsCount})` : ''}`,
                icon: Bell,
              },
              { id: 'profile', label: 'Profile, Privacy & Opt-Outs', icon: Shield },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubTab(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Banners */}
      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center justify-between gap-3 text-rose-900 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="p-1 text-rose-700 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {feedbackMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-3 text-emerald-900 text-xs sm:text-sm font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="p-1 text-emerald-700 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================== TAB 1: DIRECTORY & DISCOVERY ==================== */}
      {subTab === 'directory' && (
        <div className="space-y-4">
          {/* Targeted On-Demand Discovery Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Targeted Global Discovery (Optional Region, Country or Keyword Override)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <select
                value={discoverRegion}
                onChange={(e) => setDiscoverRegion(e.target.value as GlobalReachRegion | 'all')}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-800 bg-white"
              >
                <option value="all">Rotate All 7 Global Regions Automatically</option>
                {ALL_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={discoverCountry}
                onChange={(e) => setDiscoverCountry(e.target.value)}
                placeholder="Optional country (e.g., Germany, UAE, Canada)"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-800"
              />
              <input
                type="text"
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
                placeholder="Optional topic (e.g., banking, fintech, mentor)"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-800"
              />
              <button
                type="button"
                onClick={handleRunDiscoveryNow}
                disabled={isDiscovering}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{isDiscovering ? 'Searching Live Sources...' : 'Search Public Internet'}</span>
              </button>
            </div>
          </div>

          {/* Search & Multi-Facet Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search contacts by name, organization, country, industry, email, or notes..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => setImportantOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-semibold cursor-pointer ${
                  importantOnly
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Star className={`w-4 h-4 ${importantOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
                <span>Important Only</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">All Regions</option>
                {ALL_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">All Countries</option>
                {(data?.availableCountries || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">Individuals &amp; Orgs</option>
                <option value="individual">Individuals Only</option>
                <option value="organization">Organizations Only</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">All 12 Categories</option>
                {GLOBAL_REACH_ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {GLOBAL_REACH_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">All Channels</option>
                <option value="gmail">Has Public Email</option>
                <option value="whatsapp">Has WhatsApp Business</option>
                <option value="linkedin">Has LinkedIn</option>
                <option value="instagram">Has Instagram</option>
                <option value="contact_page">Has Contact Page</option>
                <option value="phone">Has Business Phone</option>
              </select>

              <select
                value={verificationFilter}
                onChange={(e) => setVerificationFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">All Verification Tiers</option>
                {(Object.keys(GLOBAL_REACH_VERIFICATION_LABELS) as GlobalReachVerificationStatus[]).map((v) => (
                  <option key={v} value={v}>
                    {GLOBAL_REACH_VERIFICATION_LABELS[v]}
                  </option>
                ))}
              </select>

              <select
                value={sponsorshipFilter}
                onChange={(e) => setSponsorshipFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="all">All Sponsorship Tiers</option>
                {(Object.keys(GLOBAL_REACH_SPONSORSHIP_LABELS) as GlobalReachSponsorshipTier[]).map((s) => (
                  <option key={s} value={s}>
                    {GLOBAL_REACH_SPONSORSHIP_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Selection Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      filteredContacts.length > 0 &&
                      filteredContacts.every((c) => selectedIds.has(c.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="rounded border-slate-300"
                  />
                  <span>
                    Showing {filteredContacts.length} contacts ({selectedIds.size} selected)
                  </span>
                </label>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenBulkModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Bulk BCC Gmail ({selectedContacts.filter((c) => c.publicEmail).length} with email)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Contact Cards List */}
          {filteredContacts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
              <Globe className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">
                No contacts match the current filters yet.
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "Run Live Discovery Now" to discover verified real organizations and public professional contacts worldwide, or clear active filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContacts.map((contact) => {
                const liInfo = inspectLinkedInUrl(contact.linkedInUrl);
                const igInfo = inspectInstagramUrl(contact.instagramUrl);
                const waUrl = buildWhatsAppChatUrl(
                  contact.whatsAppBusinessUrl || contact.whatsAppBusinessNumber
                );
                const telUrl = buildPublicTelUrl(contact.publicBusinessPhone);
                const safeWeb = sanitizeExternalHttpUrl(contact.officialWebsite);
                const safeContactPage = sanitizeExternalHttpUrl(contact.contactPageUrl);
                const safeSource = sanitizeExternalHttpUrl(contact.sourceUrl);
                const quickGmail = contact.publicEmail
                  ? buildSingleGmailComposeUrl({
                      to: contact.publicEmail,
                      subject: `Professional Introduction — ${data?.profile.fullName || 'Global Reach'}`,
                      body: `Dear ${contact.entityType === 'individual' ? contact.fullName : `${contact.companyName} Team`},\n\n`,
                    })
                  : null;

                return (
                  <div
                    key={contact.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3.5"
                  >
                    {/* Card Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(contact.id)}
                          onChange={(e) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(contact.id);
                              else next.delete(contact.id);
                              return next;
                            });
                          }}
                          className="mt-1 rounded border-slate-300"
                          aria-label={`Select ${contact.fullName}`}
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-bold text-slate-950">
                              {contact.fullName}
                            </span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs font-semibold text-slate-700">
                              {contact.entityType === 'individual' ? 'Individual' : GLOBAL_REACH_ORG_SIZE_LABELS[contact.organizationSize]}
                            </span>
                            <span className="text-xs text-slate-500">·</span>
                            <span className="text-xs font-medium text-slate-600">
                              {GLOBAL_REACH_CATEGORY_LABELS[contact.category]}
                            </span>
                          </div>

                          <div className="text-xs sm:text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">{contact.companyName}</span>
                            {contact.positionOrRole && (
                              <span className="text-slate-600"> — {contact.positionOrRole}</span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>
                              {[contact.city, contact.country, contact.region].filter(Boolean).join(', ')}
                            </span>
                            <span>·</span>
                            <span>{contact.industry}</span>
                            <span>·</span>
                            <span>Discovered {formatShortDate(contact.discoveredAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Score & Quick Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-start">
                        <div className="text-right pr-2 border-r border-slate-200">
                          <div className="text-[11px] text-slate-500">Relevance</div>
                          <div className="text-base font-bold text-slate-950 tabular-nums">
                            {contact.relevanceScore}/100
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleImportant(contact)}
                          title={contact.isImportant ? 'Unmark important' : 'Mark important'}
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              contact.isImportant ? 'fill-amber-500 text-amber-500' : 'text-slate-400'
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyLive(contact.id)}
                          disabled={verifyingId === contact.id}
                          title="Re-verify official website and contact details live"
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          <RefreshCw className={`w-4 h-4 ${verifyingId === contact.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingContact(contact);
                            setEditNotes(contact.personalNotes || '');
                            setEditCategory(contact.category);
                            setEditFollowUp(contact.nextFollowUpDate || '');
                            setEditEmail(contact.publicEmail || '');
                            setEditWhatsApp(contact.whatsAppBusinessNumber || '');
                            setEditLinkedIn(contact.linkedInUrl || '');
                            setEditInstagram(contact.instagramUrl || '');
                          }}
                          title="Edit contact, category, notes, and follow-up date"
                          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContact(contact.id)}
                          title="Delete contact"
                          className="p-2 rounded-lg border border-slate-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Verification, Sponsorship & Relevance Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{GLOBAL_REACH_VERIFICATION_LABELS[contact.verificationStatus]}</span>
                        </div>
                        <p className="text-slate-600 mt-1 leading-relaxed">{contact.verificationNotes}</p>
                        {contact.lastVerifiedAt && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            Checked: {formatShortDate(contact.lastVerifiedAt)}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="font-semibold text-slate-900">
                          {GLOBAL_REACH_SPONSORSHIP_LABELS[contact.sponsorshipTier]}
                        </div>
                        <p className="text-slate-600 mt-1 leading-relaxed">
                          {contact.sponsorshipEvidenceNote}
                        </p>
                      </div>

                      <div>
                        <div className="font-semibold text-slate-900">Why Recommended</div>
                        <ul className="mt-1 space-y-0.5 text-slate-600 list-disc pl-4">
                          {contact.relevanceReasons.slice(0, 3).map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Direct Communication & Outreach Actions Row */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openComposer(contact)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Prepare Personalized Intro</span>
                      </button>

                      {quickGmail && (
                        <a
                          href={quickGmail}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50"
                        >
                          <Mail className="w-3.5 h-3.5 text-rose-600" />
                          <span>Open Gmail ({contact.publicEmail})</span>
                        </a>
                      )}

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp Business ({contact.whatsAppBusinessNumber})</span>
                        </a>
                      )}

                      {liInfo.validUrl && (
                        <a
                          href={liInfo.validUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={liInfo.messagingNote}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sky-300 bg-sky-50 text-sky-900 text-xs font-semibold hover:bg-sky-100"
                        >
                          <Linkedin className="w-3.5 h-3.5" />
                          <span>LinkedIn Profile</span>
                        </a>
                      )}

                      {igInfo.validUrl && (
                        <a
                          href={igInfo.validUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={igInfo.messagingNote}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50"
                        >
                          <Instagram className="w-3.5 h-3.5 text-pink-600" />
                          <span>Instagram</span>
                        </a>
                      )}

                      {safeContactPage && (
                        <a
                          href={safeContactPage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Contact Page</span>
                        </a>
                      )}

                      {safeWeb && (
                        <a
                          href={safeWeb}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium hover:bg-slate-100"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Official Website</span>
                        </a>
                      )}

                      {telUrl && (
                        <a
                          href={telUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium hover:bg-slate-100"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{contact.publicBusinessPhone}</span>
                        </a>
                      )}

                      {safeSource && safeSource !== safeWeb && (
                        <a
                          href={safeSource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-500 underline hover:text-slate-800 ml-auto"
                        >
                          Source: {contact.sourceName}
                        </a>
                      )}
                    </div>

                    {/* Personal Notes / Follow-up / Recent Outreach strip */}
                    {(contact.personalNotes || contact.nextFollowUpDate || contact.outreachHistory.length > 0) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        {contact.nextFollowUpDate && (
                          <span className="font-semibold text-amber-800">
                            Follow-up scheduled: {contact.nextFollowUpDate}
                          </span>
                        )}
                        {contact.outreachHistory.length > 0 && (
                          <span>
                            Outreach logged: {contact.outreachHistory.length} (last via{' '}
                            {contact.outreachHistory[0].channel} on{' '}
                            {formatShortDate(contact.outreachHistory[0].sentAt)})
                          </span>
                        )}
                        {contact.personalNotes && (
                          <span className="text-slate-700">Note: {contact.personalNotes}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: HOURLY AUTOMATION & SOURCES ==================== */}
      {subTab === 'automation' && stats && scheduler && (
        <div className="space-y-4">
          {/* Scheduler Control Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  24/7 Autonomous Hourly Discovery Engine
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                  Runs server-side every 60 minutes across rotating global regions and real permitted public sources — even when your browser or phone is closed.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {scheduler.paused || !scheduler.enabled ? (
                  <button
                    type="button"
                    disabled={isControllingScheduler}
                    onClick={() => handleSchedulerControl('resume')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Hourly Search</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isControllingScheduler}
                    onClick={() => handleSchedulerControl('pause')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Automation</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isControllingScheduler}
                  onClick={() => handleSchedulerControl('disable')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  <span>Disable</span>
                </button>
                <button
                  type="button"
                  disabled={isDiscovering}
                  onClick={handleRunDiscoveryNow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                  <span>Run Cycle Now</span>
                </button>
              </div>
            </div>

            {/* All Required Real Database Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Automation Status</div>
                <div className="font-bold text-slate-950 mt-0.5 capitalize">{stats.automationStatus.replace('_', ' ')}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Last Successful Search</div>
                <div className="font-bold text-slate-950 mt-0.5">{stats.lastSuccessfulSearchEat || 'Not run yet'}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Next Scheduled Search</div>
                <div className="font-bold text-slate-950 mt-0.5">{stats.nextScheduledSearchEat || 'Paused / Disabled'}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Total Search Cycles Completed</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.totalSearchCyclesCompleted}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">New Contacts Discovered This Hour</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.newContactsThisHour}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Unique Companies / Organizations</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.newCompaniesDiscovered}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Verified Contacts Found</div>
                <div className="font-bold text-emerald-700 tabular-nums mt-0.5">{stats.verifiedContactsFound}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Potential Employers Found</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.potentialEmployersFound}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Potential Mentors Found</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.potentialMentorsFound}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Contacts with Public Email</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.contactsWithPublicEmail}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Public WhatsApp Business Contacts</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.contactsWithPublicWhatsApp}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">LinkedIn / Instagram Profiles</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">
                  {stats.contactsWithLinkedIn} / {stats.contactsWithInstagram}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Potential Sponsorship Signals</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.potentialSponsorshipOpportunities}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Website Dev Prospects</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.websiteDevelopmentProspects}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Search Cycle Failures</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.searchFailures}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-slate-500">Recorded Source / API Errors</div>
                <div className="font-bold text-slate-950 tabular-nums mt-0.5">{stats.apiErrors}</div>
              </div>
            </div>

            {scheduler.recoveryNotes && (
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                Crash-recovery note: {scheduler.recoveryNotes}
              </div>
            )}
          </div>

          {/* Transparent Sources Status Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-950">
              Permitted Discovery Sources — Operational vs Additional Credentials Required
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Source</th>
                    <th className="py-2 pr-3 font-semibold">Status</th>
                    <th className="py-2 pr-3 font-semibold">Contacts Saved</th>
                    <th className="py-2 font-semibold">Details / Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.sources || []).map((src) => (
                    <tr key={src.id}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        {src.name}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            src.status === 'operational'
                              ? 'text-emerald-700'
                              : src.status === 'requires_api_key'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {src.status === 'operational'
                            ? 'Operational'
                            : src.status === 'requires_api_key'
                            ? `Requires Server Key (${src.envVarName})`
                            : 'Platform Permission Required'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums font-semibold text-slate-800">
                        {src.contactsDiscoveredTotal}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {src.description}
                        {src.lastError && (
                          <div className="text-rose-700 mt-0.5">Last error: {src.lastError}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Hourly Cycle Logs */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-950">Recent Discovery Cycles</h3>
            {!data?.recentCycles.length ? (
              <p className="text-xs text-slate-500">No discovery cycles recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Finished</th>
                      <th className="py-2 pr-3 font-semibold">Trigger</th>
                      <th className="py-2 pr-3 font-semibold">Region / Countries</th>
                      <th className="py-2 pr-3 font-semibold">New</th>
                      <th className="py-2 pr-3 font-semibold">Verified</th>
                      <th className="py-2 pr-3 font-semibold">Deduped</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recentCycles.map((cyc) => (
                      <tr key={cyc.id}>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                          {formatShortDate(cyc.finishedAt)}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{cyc.trigger}</td>
                        <td className="py-2 pr-3 text-slate-800">
                          <span className="font-semibold">{cyc.regionScanned}</span> ({cyc.countriesScanned.join(', ')})
                        </td>
                        <td className="py-2 pr-3 tabular-nums font-bold text-emerald-700">{cyc.newContactsAdded}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-800">{cyc.verifiedCount}</td>
                        <td className="py-2 pr-3 tabular-nums text-slate-600">{cyc.duplicatesPrevented}</td>
                        <td className="py-2 font-semibold text-slate-800">{cyc.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 3: FOLLOW-UPS & OUTREACH LOG ==================== */}
      {subTab === 'followups' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="text-base font-bold text-slate-950">
            Scheduled Follow-Ups &amp; Approved Communication History
          </h3>
          {(() => {
            const engaged = (data?.contacts || []).filter(
              (c) => c.nextFollowUpDate || c.outreachHistory.length > 0
            );
            if (engaged.length === 0) {
              return (
                <p className="text-xs sm:text-sm text-slate-600">
                  No outreach or follow-ups logged yet. Use "Prepare Personalized Intro" on any contact to draft, review, approve, and log outreach.
                </p>
              );
            }
            return (
              <div className="space-y-3">
                {engaged.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-sm text-slate-950">{c.fullName}</span>{' '}
                        <span className="text-xs text-slate-600">
                          — {c.companyName} ({c.country})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.nextFollowUpDate && (
                          <span className="text-xs font-semibold text-amber-800">
                            Follow-up: {c.nextFollowUpDate}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openComposer(c)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                        >
                          Prepare Follow-Up
                        </button>
                      </div>
                    </div>
                    {c.outreachHistory.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        {c.outreachHistory.map((h) => (
                          <div key={h.id} className="text-xs text-slate-700 flex flex-wrap justify-between gap-2">
                            <span>
                              <strong className="capitalize">{h.channel}</strong> ({GLOBAL_REACH_APPROACH_LABELS[h.approach]}) ·{' '}
                              {h.subject || h.messagePreview.slice(0, 80)}
                            </span>
                            <span className="text-slate-500">{formatShortDate(h.sentAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ==================== TAB 4: NOTIFICATIONS ==================== */}
      {subTab === 'notifications' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-950">Global Reach Notifications</h3>
            <button
              type="button"
              onClick={async () => {
                await acknowledgeGlobalReachNotifications(actorEmail, actorUid);
                await loadDashboard();
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Mark All Read
            </button>
          </div>
          {!data?.notifications.length ? (
            <p className="text-xs sm:text-sm text-slate-600">No notifications recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    n.read ? 'opacity-70' : ''
                  }`}
                >
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-slate-950">{n.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500">{formatShortDate(n.createdAt)}</span>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={async () => {
                          await acknowledgeGlobalReachNotifications(actorEmail, actorUid, n.id);
                          await loadDashboard();
                        }}
                        className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Ack
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 5: PROFILE, PRIVACY & OPT-OUTS ==================== */}
      {subTab === 'profile' && profileDraft && (
        <div className="space-y-4">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  Active Private Professional Profile
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Strictly private to your account. Used only to rank contact relevance and accurately draft your personalized introductions.
                </p>
              </div>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Full Name</span>
                <input
                  type="text"
                  value={profileDraft.fullName}
                  onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Email</span>
                <input
                  type="email"
                  value={profileDraft.email}
                  onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Nationality / Current Country</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={profileDraft.nationality}
                    onChange={(e) => setProfileDraft({ ...profileDraft, nationality: e.target.value })}
                    placeholder="Nationality"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                  <input
                    type="text"
                    value={profileDraft.currentCountry}
                    onChange={(e) => setProfileDraft({ ...profileDraft, currentCountry: e.target.value })}
                    placeholder="Country"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Education Degree</span>
                <input
                  type="text"
                  value={profileDraft.educationDegree}
                  onChange={(e) => setProfileDraft({ ...profileDraft, educationDegree: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">University &amp; Graduation Year</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={profileDraft.educationInstitution}
                    onChange={(e) => setProfileDraft({ ...profileDraft, educationInstitution: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                  <input
                    type="text"
                    value={profileDraft.graduationYear}
                    onChange={(e) => setProfileDraft({ ...profileDraft, graduationYear: e.target.value })}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Total / Management Years &amp; Role</span>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={profileDraft.totalExperienceYears}
                    onChange={(e) =>
                      setProfileDraft({ ...profileDraft, totalExperienceYears: Number(e.target.value) || 0 })
                    }
                    className="px-2.5 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={profileDraft.managementExperienceYears}
                    onChange={(e) =>
                      setProfileDraft({
                        ...profileDraft,
                        managementExperienceYears: Number(e.target.value) || 0,
                      })
                    }
                    className="px-2.5 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                  <input
                    type="text"
                    value={profileDraft.currentOrRecentRole}
                    onChange={(e) => setProfileDraft({ ...profileDraft, currentOrRecentRole: e.target.value })}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Core Experience Areas (comma-separated)</span>
                <textarea
                  rows={2}
                  value={profileDraft.coreExperienceAreas.join(', ')}
                  onChange={(e) =>
                    setProfileDraft({
                      ...profileDraft,
                      coreExperienceAreas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Additional Capabilities (comma-separated)</span>
                <textarea
                  rows={2}
                  value={profileDraft.additionalCapabilities.join(', ')}
                  onChange={(e) =>
                    setProfileDraft({
                      ...profileDraft,
                      additionalCapabilities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </label>
            </div>

            <label className="block space-y-1 text-xs">
              <span className="font-semibold text-slate-700">Personal Story &amp; Objectives Summary</span>
              <textarea
                rows={3}
                value={profileDraft.personalStorySummary}
                onChange={(e) => setProfileDraft({ ...profileDraft, personalStorySummary: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
              />
            </label>
          </form>

          {/* Opt-Out Suppression List & Privacy Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-950">Opt-Out / Do-Not-Contact Suppression List</h4>
              <p className="text-xs text-slate-600">
                Any email or domain listed here is automatically blocked from future discovery saves and bulk outreach batches.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <input
                  type="email"
                  value={suppressEmail}
                  onChange={(e) => setSuppressEmail(e.target.value)}
                  placeholder="Email to block (optional)"
                  className="px-3 py-2 rounded-lg border border-slate-300"
                />
                <input
                  type="text"
                  value={suppressDomain}
                  onChange={(e) => setSuppressDomain(e.target.value)}
                  placeholder="Domain to block (e.g., example.org)"
                  className="px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex gap-2 text-xs">
                <input
                  type="text"
                  value={suppressReason}
                  onChange={(e) => setSuppressReason(e.target.value)}
                  placeholder="Reason"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await addGlobalReachSuppression(actorEmail, actorUid, {
                        email: suppressEmail.trim() || undefined,
                        domain: suppressDomain.trim() || undefined,
                        reason: suppressReason.trim() || 'User opt-out',
                      });
                      setSuppressEmail('');
                      setSuppressDomain('');
                      await loadDashboard();
                    } catch (err: any) {
                      setErrorMsg(err?.message || 'Failed to add suppression rule.');
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Add Block
                </button>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.suppressionList || []).map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-slate-900">{s.email || s.domain}</span>
                      <span className="text-slate-500"> — {s.reason}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await removeGlobalReachSuppression(actorEmail, actorUid, s.id);
                        await loadDashboard();
                      }}
                      className="text-rose-600 hover:underline font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-950">Data Privacy &amp; Workspace Controls</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your Global Reach profile, saved contacts, personal notes, and outreach logs are strictly isolated to your authenticated workspace. No unsolicited messages are ever sent automatically without your review and approval.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export My Data (JSON)</span>
                </button>
                {!confirmPurge ? (
                  <button
                    type="button"
                    onClick={() => setConfirmPurge(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Saved Contacts</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await purgeGlobalReachWorkspaceData(actorEmail, actorUid);
                        setConfirmPurge(false);
                        setFeedbackMsg('Workspace contacts and notifications cleared.');
                        await loadDashboard();
                      }}
                      className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                    >
                      Confirm Permanent Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPurge(false)}
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: SINGLE PERSONALIZED OUTREACH COMPOSER ==================== */}
      {composerContact && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-950">
                  Personalized Introduction Composer — {composerContact.fullName}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {composerContact.companyName} · {composerContact.country} ·{' '}
                  {GLOBAL_REACH_SPONSORSHIP_LABELS[composerContact.sponsorshipTier]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerContact(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <label className="block space-y-1 text-xs sm:col-span-1">
                <span className="font-semibold text-slate-700">Outreach Approach (8 Styles)</span>
                <select
                  value={composerApproach}
                  onChange={(e) => setComposerApproach(e.target.value as GlobalReachOutreachApproach)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 bg-white"
                >
                  {GLOBAL_REACH_ALL_APPROACHES.map((a) => (
                    <option key={a} value={a}>
                      {GLOBAL_REACH_APPROACH_LABELS[a]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={isGeneratingDraft}
                onClick={() => handleGenerateComposerDraft('ai')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingDraft ? 'Generating...' : 'Generate with Gemini AI'}</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingDraft}
                onClick={() => handleGenerateComposerDraft('manual_template')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Load Editable Template</span>
              </button>
            </div>

            {composerError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                {composerError}
              </div>
            )}

            {composerDraft && (
              <div className="text-[11px] text-slate-500">
                Draft source: {composerDraft.generatedBy === 'gemini_ai' ? `Gemini AI (${composerDraft.modelUsed})` : 'Manual Editable Starter Template'} — review and edit freely before approving.
              </div>
            )}

            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Email Subject</span>
                <input
                  type="text"
                  value={composerSubject}
                  onChange={(e) => setComposerSubject(e.target.value)}
                  placeholder="Enter or generate email subject"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </label>

              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Email / Introduction Message</span>
                <textarea
                  rows={8}
                  value={composerMessage}
                  onChange={(e) => setComposerMessage(e.target.value)}
                  placeholder="Generate a personalized draft or write your respectful introduction here..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 leading-relaxed"
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="font-semibold text-slate-700">Short WhatsApp Business Message</span>
                  <textarea
                    rows={3}
                    value={composerWaText}
                    onChange={(e) => setComposerWaText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-semibold text-slate-700">LinkedIn Connection Note (max 290 chars)</span>
                  <textarea
                    rows={3}
                    maxLength={295}
                    value={composerLiNote}
                    onChange={(e) => setComposerLiNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-2 border-t border-slate-200">
                <label className="block space-y-1">
                  <span className="font-semibold text-slate-700">Optional Follow-Up Reminder Date</span>
                  <input
                    type="date"
                    value={composerFollowUpDate}
                    onChange={(e) => setComposerFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </label>

                <label className="inline-flex items-start gap-2 pt-4 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={composerHumanApproved}
                    onChange={(e) => setComposerHumanApproved(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    I have reviewed and approved this message as accurate, respectful, and ready to open in my chosen platform.
                  </span>
                </label>
              </div>
            </div>

            {/* Platform Launch Row */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
              {composerContact.publicEmail && (() => {
                const gmailUrl = buildSingleGmailComposeUrl({
                  to: composerContact.publicEmail,
                  subject: composerSubject || `Introduction — ${data?.profile.fullName || ''}`,
                  body: composerMessage,
                });
                if (!gmailUrl) return null;
                return (
                  <button
                    type="button"
                    disabled={!composerHumanApproved || !composerMessage.trim()}
                    onClick={() =>
                      handleRecordAndOpenChannel(
                        composerContact,
                        'gmail',
                        gmailUrl,
                        composerMessage,
                        composerSubject
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Open Gmail ({composerContact.publicEmail})</span>
                  </button>
                );
              })()}

              {(() => {
                const waUrl = buildWhatsAppChatUrl(
                  composerContact.whatsAppBusinessUrl || composerContact.whatsAppBusinessNumber,
                  composerWaText || composerMessage.slice(0, 400)
                );
                if (!waUrl) return null;
                return (
                  <button
                    type="button"
                    disabled={!composerHumanApproved}
                    onClick={() =>
                      handleRecordAndOpenChannel(
                        composerContact,
                        'whatsapp',
                        waUrl,
                        composerWaText || composerMessage
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Open WhatsApp Business</span>
                  </button>
                );
              })()}

              {(() => {
                const li = inspectLinkedInUrl(composerContact.linkedInUrl);
                if (!li.validUrl) return null;
                return (
                  <button
                    type="button"
                    disabled={!composerHumanApproved}
                    onClick={async () => {
                      await copyText('li', composerLiNote || composerMessage);
                      await handleRecordAndOpenChannel(
                        composerContact,
                        'linkedin',
                        li.validUrl!,
                        composerLiNote || composerMessage
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-700 text-white text-xs font-semibold hover:bg-sky-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Linkedin className="w-4 h-4" />
                    <span>Copy Note &amp; Open LinkedIn</span>
                  </button>
                );
              })()}

              {(() => {
                const ig = inspectInstagramUrl(composerContact.instagramUrl);
                if (!ig.validUrl) return null;
                return (
                  <button
                    type="button"
                    disabled={!composerHumanApproved}
                    onClick={async () => {
                      await copyText('ig', composerWaText || composerMessage);
                      await handleRecordAndOpenChannel(
                        composerContact,
                        'instagram',
                        ig.validUrl!,
                        composerWaText || composerMessage
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    <Instagram className="w-4 h-4 text-pink-600" />
                    <span>Copy &amp; Open Instagram</span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => copyText('full', `${composerSubject}\n\n${composerMessage}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer ml-auto"
              >
                {copiedKey === 'full' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'full' ? 'Copied' : 'Copy Message'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: BULK BCC-ONLY GMAIL COMPOSER ==================== */}
      {showBulkBccModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-950">
                  Bulk Gmail Outreach — Strict BCC Privacy Protection
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Recipients are placed strictly in BCC so no recipient can ever see another person&apos;s email address. Nothing is sent automatically until you review and click Send in Gmail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkBccModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Subject</span>
                <input
                  type="text"
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Respectful General Introduction Body</span>
                <textarea
                  rows={7}
                  value={bulkBody}
                  onChange={(e) => setBulkBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </label>
              <label className="inline-flex items-start gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkApproved}
                  onChange={(e) => setBulkApproved(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>
                  I confirm I have reviewed this outreach message and approve opening Gmail with BCC recipients.
                </span>
              </label>
            </div>

            {bulkBccBatches.length === 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                None of the selected contacts have a valid public email address.
              </p>
            ) : (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                {bulkBccBatches.map((batch) => (
                  <div
                    key={batch.batchIndex}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <span>
                      <strong>
                        BCC Batch {batch.batchIndex}/{batch.totalBatches}
                      </strong>{' '}
                      — {batch.recipients.length} recipients (strictly BCC)
                    </span>
                    <button
                      type="button"
                      disabled={!bulkApproved || !bulkBody.trim()}
                      onClick={async () => {
                        await logGlobalReachOutreach(actorEmail, actorUid, {
                          contactIds: selectedContacts
                            .filter((c) => c.publicEmail && batch.recipients.includes(c.publicEmail.toLowerCase()))
                            .map((c) => c.id),
                          channel: 'gmail',
                          approach: bulkApproach,
                          subject: bulkSubject,
                          messagePreview: bulkBody,
                          mode: 'bulk_bcc',
                          nextFollowUpDate: bulkFollowUpDate || undefined,
                        });
                        const a = document.createElement('a');
                        a.href = batch.gmailComposeUrl;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.click();
                        await loadDashboard();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Open BCC Batch in Gmail</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT CONTACT & NOTES ==================== */}
      {editingContact && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950">Edit Contact — {editingContact.fullName}</h3>
              <button type="button" onClick={() => setEditingContact(null)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Category</span>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as GlobalReachContactCategory)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                {GLOBAL_REACH_ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {GLOBAL_REACH_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Public Email</span>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Published WhatsApp Business (+...)</span>
                <input
                  type="text"
                  value={editWhatsApp}
                  onChange={(e) => setEditWhatsApp(e.target.value)}
                  placeholder="+44..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">LinkedIn Profile URL</span>
                <input
                  type="url"
                  value={editLinkedIn}
                  onChange={(e) => setEditLinkedIn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="font-semibold text-slate-700">Instagram Profile URL</span>
                <input
                  type="url"
                  value={editInstagram}
                  onChange={(e) => setEditInstagram(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Follow-Up Date</span>
              <input
                type="date"
                value={editFollowUp}
                onChange={(e) => setEditFollowUp(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700">Personal Notes</span>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditContact}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD MANUAL CONTACT ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <form
            onSubmit={handleCreateManualContact}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950">Add Verified / Public Contact</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={newContactForm.entityType}
                onChange={(e) =>
                  setNewContactForm({
                    ...newContactForm,
                    entityType: e.target.value as 'individual' | 'organization',
                  })
                }
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="organization">Organization</option>
                <option value="individual">Individual</option>
              </select>
              <select
                value={newContactForm.category}
                onChange={(e) =>
                  setNewContactForm({
                    ...newContactForm,
                    category: e.target.value as GlobalReachContactCategory,
                  })
                }
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                {GLOBAL_REACH_ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {GLOBAL_REACH_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <input
                required
                type="text"
                placeholder="Full Name or Organization *"
                value={newContactForm.fullName}
                onChange={(e) => setNewContactForm({ ...newContactForm, fullName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                placeholder="Company Name"
                value={newContactForm.companyName}
                onChange={(e) => setNewContactForm({ ...newContactForm, companyName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                placeholder="Position / Role"
                value={newContactForm.positionOrRole}
                onChange={(e) => setNewContactForm({ ...newContactForm, positionOrRole: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                placeholder="Industry"
                value={newContactForm.industry}
                onChange={(e) => setNewContactForm({ ...newContactForm, industry: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                placeholder="Country"
                value={newContactForm.country}
                onChange={(e) => setNewContactForm({ ...newContactForm, country: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="url"
                placeholder="Official Website (https://...)"
                value={newContactForm.officialWebsite}
                onChange={(e) => setNewContactForm({ ...newContactForm, officialWebsite: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="email"
                placeholder="Public Professional Email"
                value={newContactForm.publicEmail}
                onChange={(e) => setNewContactForm({ ...newContactForm, publicEmail: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="text"
                placeholder="Published WhatsApp Business (+...)"
                value={newContactForm.whatsAppBusinessNumber}
                onChange={(e) =>
                  setNewContactForm({ ...newContactForm, whatsAppBusinessNumber: e.target.value })
                }
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="url"
                placeholder="LinkedIn URL"
                value={newContactForm.linkedInUrl}
                onChange={(e) => setNewContactForm({ ...newContactForm, linkedInUrl: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="url"
                placeholder="Instagram URL"
                value={newContactForm.instagramUrl}
                onChange={(e) => setNewContactForm({ ...newContactForm, instagramUrl: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Personal notes..."
              value={newContactForm.personalNotes}
              onChange={(e) => setNewContactForm({ ...newContactForm, personalNotes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Save Contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
