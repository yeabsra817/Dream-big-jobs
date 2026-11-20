import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Layout,
  Globe,
  Megaphone,
  Layers,
  Footprints,
  Image as ImageIcon,
  Upload,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { SiteContentConfig, SiteSettings } from '../../types/job';
import { DEFAULT_SITE_CONTENT, resolveSiteContent } from '../../utils/siteContentDefaults';

interface Props {
  settings: SiteSettings;
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  onPreviewWebsite?: () => void;
}

type EditorSectionTab = 'brand' | 'hero' | 'sections' | 'footer';

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer hover:border-slate-300 transition-colors">
    <div className="min-w-0">
      <div className="text-xs font-bold text-[#0B132B] flex items-center gap-1.5">
        {checked ? (
          <Eye className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
        ) : (
          <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}
        <span>{label}</span>
      </div>
      {description && (
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A] ${
        checked ? 'bg-[#16A34A]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </label>
);

export const HomepageWebsiteEditor: React.FC<Props> = ({
  settings,
  onSaveSettings,
  onPreviewWebsite,
}) => {
  const [subTab, setSubTab] = useState<EditorSectionTab>('hero');
  const [content, setContent] = useState<Required<SiteContentConfig>>(() =>
    resolveSiteContent(settings)
  );
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '');
  const [contactAddress, setContactAddress] = useState(settings.contactAddress || '');
  const [aboutText, setAboutText] = useState(settings.aboutText || '');
  const [customDomain, setCustomDomain] = useState(settings.customDomain || 'hopelandjobs.tech');
  const [telegramChannelName, setTelegramChannelName] = useState(
    settings.telegramChannelName || '@DreamBigJobsEthiopia'
  );
  const [telegramChannelUrl, setTelegramChannelUrl] = useState(
    settings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia'
  );

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  useEffect(() => {
    setContent(resolveSiteContent(settings));
    setContactEmail(settings.contactEmail || '');
    setContactPhone(settings.contactPhone || '');
    setContactAddress(settings.contactAddress || '');
    setAboutText(settings.aboutText || '');
    setCustomDomain(settings.customDomain || 'hopelandjobs.tech');
    setTelegramChannelName(settings.telegramChannelName || '@DreamBigJobsEthiopia');
    setTelegramChannelUrl(settings.telegramChannelUrl || 'https://t.me/DreamBigJobsEthiopia');
  }, [settings]);

  const updateField = <K extends keyof SiteContentConfig>(
    key: K,
    value: Required<SiteContentConfig>[K]
  ) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const handleHeroImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Hero image is too large (max 5 MB).' });
      e.target.value = '';
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 1440;
        const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(objectUrl);
        if (dataUri.length > 420000) {
          updateField('heroCustomBackgroundUrl', canvas.toDataURL('image/jpeg', 0.62));
        } else {
          updateField('heroCustomBackgroundUrl', dataUri);
        }
        setFeedback({
          type: 'success',
          text: 'Custom hero backdrop prepared! Click "Save & Publish Changes" to make it live.',
        });
      } catch (err: any) {
        URL.revokeObjectURL(objectUrl);
        setFeedback({ type: 'error', text: err?.message || 'Could not process image.' });
      } finally {
        e.target.value = '';
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setFeedback({ type: 'error', text: 'Unsupported image format. Use JPG, PNG, or WebP.' });
      e.target.value = '';
    };
    img.src = objectUrl;
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const cleanDomain =
        customDomain
          .trim()
          .replace(/^https?:\/\//i, '')
          .replace(/\/+$/, '') || 'hopelandjobs.tech';
      const nowIso = new Date().toISOString();

      await onSaveSettings({
        ...settings,
        contactEmail: contactEmail.trim() || settings.contactEmail,
        contactPhone: contactPhone.trim() || settings.contactPhone,
        contactAddress: contactAddress.trim() || settings.contactAddress,
        aboutText: aboutText.trim() || settings.aboutText,
        customDomain: cleanDomain,
        telegramChannelName: telegramChannelName.trim() || settings.telegramChannelName,
        telegramChannelUrl: telegramChannelUrl.trim() || settings.telegramChannelUrl,
        siteContent: { ...content },
        updatedAt: nowIso,
      });

      setFeedback({
        type: 'success',
        text: 'All homepage & website amendments have been saved and published live across the site.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: 'Could not save website changes: ' + (err?.message || 'Unknown error'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmResetDefaults = async () => {
    setConfirmResetOpen(false);
    setContent({ ...DEFAULT_SITE_CONTENT });
    setIsSaving(true);
    setFeedback(null);
    try {
      await onSaveSettings({
        ...settings,
        siteContent: { ...DEFAULT_SITE_CONTENT },
        updatedAt: new Date().toISOString(),
      });
      setFeedback({
        type: 'success',
        text: 'Homepage & website text and visibility settings restored to defaults.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: 'Reset failed: ' + (err?.message || 'Unknown error'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-[#16A34A] shrink-0" />
            <h2 className="text-lg sm:text-xl font-bold text-[#0B132B]">
              Homepage &amp; Full Website Editor
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            Full Admin authority to amend headlines, Amharic &amp; English text, banners, navigation, section visibility, hero imagery, categories, footer, and social links across the entire site.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onPreviewWebsite && (
            <button
              type="button"
              onClick={onPreviewWebsite}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B132B] font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>View Live Site</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            disabled={isSaving}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Publishing...' : 'Save & Publish Changes'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'hero', label: 'Hero & Search', icon: Layout },
            { id: 'brand', label: 'Brand, Header & Banners', icon: Megaphone },
            { id: 'sections', label: 'Homepage Sections & Visibility', icon: Layers },
            { id: 'footer', label: 'Footer, Contact & Social', icon: Footprints },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0B132B] text-white'
                  : 'bg-white text-slate-600 hover:text-[#0B132B] border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: HERO & SEARCH */}
      {subTab === 'hero' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-[#0B132B]">Homepage Hero &amp; Search Bar</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit the main homepage headlines, Amharic subtitle, search placeholders, quick action buttons, and hero background image.
            </p>
          </div>

          <ToggleRow
            label="Show Homepage Hero Section"
            description="Toggle the top hero banner and search box on the homepage."
            checked={content.showHeroSection}
            onChange={(v) => updateField('showHeroSection', v)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Main Hero Headline (English)
              </label>
              <input
                type="text"
                value={content.heroTitle}
                onChange={(e) => updateField('heroTitle', e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Hero Subtitle (Amharic / Bilingual)
              </label>
              <input
                type="text"
                value={content.heroSubtitleAmharic}
                onChange={(e) => updateField('heroSubtitleAmharic', e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Jobs Search Input Placeholder
              </label>
              <input
                type="text"
                value={content.heroSearchPlaceholderJobs}
                onChange={(e) => updateField('heroSearchPlaceholderJobs', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Companies Search Input Placeholder
              </label>
              <input
                type="text"
                value={content.heroSearchPlaceholderCompanies}
                onChange={(e) => updateField('heroSearchPlaceholderCompanies', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Search Button Label
              </label>
              <input
                type="text"
                value={content.heroSearchButtonText}
                onChange={(e) => updateField('heroSearchButtonText', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                No-Login Notice (English)
              </label>
              <input
                type="text"
                value={content.heroNoLoginNoticeEn}
                onChange={(e) => updateField('heroNoLoginNoticeEn', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                No-Login Notice (Amharic)
              </label>
              <input
                type="text"
                value={content.heroNoLoginNoticeAm}
                onChange={(e) => updateField('heroNoLoginNoticeAm', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Register CTA Button Text
              </label>
              <input
                type="text"
                value={content.heroRegisterButtonText}
                onChange={(e) => updateField('heroRegisterButtonText', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Download App CTA Button Text
              </label>
              <input
                type="text"
                value={content.heroDownloadButtonText}
                onChange={(e) => updateField('heroDownloadButtonText', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Benefits Jump Button Text
              </label>
              <input
                type="text"
                value={content.heroBenefitsButtonText}
                onChange={(e) => updateField('heroBenefitsButtonText', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>
          </div>

          {/* Hero Background Image Customization */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0B132B]">
                <ImageIcon className="w-4 h-4 text-[#16A34A]" />
                <span>Custom Hero Background Image (Optional)</span>
              </div>
              {content.heroCustomBackgroundUrl && (
                <button
                  type="button"
                  onClick={() => updateField('heroCustomBackgroundUrl', '')}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Use Default Backdrop
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Hero Image</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleHeroImageUpload}
                  className="hidden"
                />
              </label>
              <input
                type="text"
                value={
                  content.heroCustomBackgroundUrl.startsWith('data:image/')
                    ? ''
                    : content.heroCustomBackgroundUrl
                }
                onChange={(e) => updateField('heroCustomBackgroundUrl', e.target.value)}
                placeholder={
                  content.heroCustomBackgroundUrl.startsWith('data:image/')
                    ? 'Custom uploaded image ready (paste https:// URL to replace)'
                    : 'Or paste direct HTTPS image URL...'
                }
                className="flex-1 min-w-[220px] text-xs p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#16A34A]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BRAND, HEADER & BANNERS */}
      {subTab === 'brand' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-[#0B132B]">
              Brand Name, Top Navigation &amp; Announcement Banner
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize the site brand name, browser title, top announcement bar, app download bar, reminder timer, and which navigation links are visible.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Brand Name (Part 1)
              </label>
              <input
                type="text"
                value={content.brandPrimary}
                onChange={(e) => updateField('brandPrimary', e.target.value)}
                placeholder="Hopeland"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Brand Name (Green Accent)
              </label>
              <input
                type="text"
                value={content.brandAccent}
                onChange={(e) => updateField('brandAccent', e.target.value)}
                placeholder="Jobs"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Production Website Domain
              </label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="hopelandjobs.tech"
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Browser Tab Title
              </label>
              <input
                type="text"
                value={content.browserTitle}
                onChange={(e) => updateField('browserTitle', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none"
              />
            </div>
          </div>

          {/* Sitewide Announcement Banner */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <ToggleRow
              label="Show Sitewide Top Announcement Banner"
              description="Display a live notice bar at the very top of every page (e.g. urgent recruitment notice, holiday hours, or Telegram update)."
              checked={content.showAnnouncementBanner}
              onChange={(v) => updateField('showAnnouncementBanner', v)}
            />
            {content.showAnnouncementBanner && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Announcement Message
                  </label>
                  <input
                    type="text"
                    value={content.announcementText}
                    onChange={(e) => updateField('announcementText', e.target.value)}
                    placeholder="New verified banking & NGO vacancies posted today across Ethiopia!"
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Optional Link URL
                  </label>
                  <input
                    type="text"
                    value={content.announcementLinkUrl}
                    onChange={(e) => updateField('announcementLinkUrl', e.target.value)}
                    placeholder="https://t.me/DreamBigJobsEthiopia"
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Link Button Text
                  </label>
                  <input
                    type="text"
                    value={content.announcementLinkLabel}
                    onChange={(e) => updateField('announcementLinkLabel', e.target.value)}
                    placeholder="Learn More"
                    className="w-full text-xs p-2.5 rounded-xl border border-amber-300 bg-white outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* App Download Bar & Reminder Interval */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <ToggleRow
              label="Show Top Optional Download App Strip"
              description="Show the dark header strip inviting phone and computer visitors to install the official app."
              checked={content.showTopDownloadBar}
              onChange={(v) => updateField('showTopDownloadBar', v)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Download Button Text
                </label>
                <input
                  type="text"
                  value={content.topDownloadBarText}
                  onChange={(e) => updateField('topDownloadBarText', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Download Strip Subtitle
                </label>
                <input
                  type="text"
                  value={content.topDownloadBarSubtitle}
                  onChange={(e) => updateField('topDownloadBarSubtitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  App Download Reminder Interval
                </label>
                <select
                  value={String(content.downloadReminderIntervalSeconds)}
                  onChange={(e) =>
                    updateField('downloadReminderIntervalSeconds', Number(e.target.value))
                  }
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white outline-none"
                >
                  <option value="60">Every 1 minute (60s)</option>
                  <option value="120">Every 2 minutes (120s)</option>
                  <option value="300">Every 5 minutes (300s)</option>
                  <option value="0">Disabled (Only top strip)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Menu Visibility */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Top Navigation Menu Items
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <ToggleRow
                label="Jobs Link"
                checked={content.showNavJobs}
                onChange={(v) => updateField('showNavJobs', v)}
              />
              <ToggleRow
                label="Categories Link"
                checked={content.showNavCategories}
                onChange={(v) => updateField('showNavCategories', v)}
              />
              <ToggleRow
                label="International Jobs"
                checked={content.showNavInternational}
                onChange={(v) => updateField('showNavInternational', v)}
              />
              <ToggleRow
                label="Immigration & Residence"
                checked={content.showNavImmigration}
                onChange={(v) => updateField('showNavImmigration', v)}
              />
              <ToggleRow
                label="Scholarships"
                checked={content.showNavScholarships}
                onChange={(v) => updateField('showNavScholarships', v)}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HOMEPAGE SECTIONS & VISIBILITY */}
      {subTab === 'sections' && (
        <div className="space-y-5">
          {/* Companies & Categories */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-[#0B132B]">
              Companies Strip &amp; Job Categories Section
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ToggleRow
                label="Show Trusted Companies Carousel"
                description="Horizontal logo strip under the Hero section."
                checked={content.showTrustedCompanies}
                onChange={(v) => updateField('showTrustedCompanies', v)}
              />
              <ToggleRow
                label="Show Job Categories Section"
                description="Show or completely hide the Job Categories bar on the homepage."
                checked={content.showCategoriesSection}
                onChange={(v) => updateField('showCategoriesSection', v)}
              />
              <ToggleRow
                label="Expand All Categories by Default"
                description="Off = Hidden by default until visitor taps List All Job Categories."
                checked={content.categoriesDefaultExpanded}
                onChange={(v) => updateField('categoriesDefaultExpanded', v)}
              />
              <ToggleRow
                label="Show Featured Companies Blue Carousel"
                description="Featured employers showcase section."
                checked={content.showFeaturedCompanies}
                onChange={(v) => updateField('showFeaturedCompanies', v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Trusted Companies Heading
                </label>
                <input
                  type="text"
                  value={content.trustedCompaniesTitle}
                  onChange={(e) => updateField('trustedCompaniesTitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Categories Section Title
                </label>
                <input
                  type="text"
                  value={content.categoriesTitle}
                  onChange={(e) => updateField('categoriesTitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  List Categories Button Text
                </label>
                <input
                  type="text"
                  value={content.categoriesShowButtonText}
                  onChange={(e) => updateField('categoriesShowButtonText', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hide Categories Button Text
                </label>
                <input
                  type="text"
                  value={content.categoriesHideButtonText}
                  onChange={(e) => updateField('categoriesHideButtonText', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Featured Companies Heading
                </label>
                <input
                  type="text"
                  value={content.featuredCompaniesTitle}
                  onChange={(e) => updateField('featuredCompaniesTitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Featured Companies Subtitle
                </label>
                <input
                  type="text"
                  value={content.featuredCompaniesSubtitle}
                  onChange={(e) => updateField('featuredCompaniesSubtitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Optional Register & App Download Benefits Section */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-[#0B132B]">
              Optional Registration &amp; App Benefits Showcase (English &amp; Amharic)
            </h3>
            <ToggleRow
              label="Show Optional Benefits Section"
              description="Displays the bold English & Amharic benefits cards for optional registration and downloading the app."
              checked={content.showBenefitsSection}
              onChange={(v) => updateField('showBenefitsSection', v)}
            />
            {content.showBenefitsSection && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Top Kicker Line
                  </label>
                  <input
                    type="text"
                    value={content.benefitsBadgeText}
                    onChange={(e) => updateField('benefitsBadgeText', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Main Section Heading (English)
                  </label>
                  <input
                    type="text"
                    value={content.benefitsHeadingEn}
                    onChange={(e) => updateField('benefitsHeadingEn', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Subheading (Amharic)
                  </label>
                  <input
                    type="text"
                    value={content.benefitsSubheadingAm}
                    onChange={(e) => updateField('benefitsSubheadingAm', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Register Card Title (English)
                  </label>
                  <input
                    type="text"
                    value={content.registerCardTitleEn}
                    onChange={(e) => updateField('registerCardTitleEn', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Register Card Title (Amharic)
                  </label>
                  <input
                    type="text"
                    value={content.registerCardTitleAm}
                    onChange={(e) => updateField('registerCardTitleAm', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    App Download Card Title (English)
                  </label>
                  <input
                    type="text"
                    value={content.appCardTitleEn}
                    onChange={(e) => updateField('appCardTitleEn', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    App Download Card Title (Amharic)
                  </label>
                  <input
                    type="text"
                    value={content.appCardTitleAm}
                    onChange={(e) => updateField('appCardTitleAm', e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* How It Works + CV Assistance + About */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-[#0B132B]">
              How It Works, CV Assistance &amp; About Sections
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ToggleRow
                label="Show How HopelandJobs Works Section"
                checked={content.showHowItWorksSection}
                onChange={(v) => updateField('showHowItWorksSection', v)}
              />
              <ToggleRow
                label="Show CV & Application Assistance Section"
                checked={content.showCvAssistanceSection}
                onChange={(v) => updateField('showCvAssistanceSection', v)}
              />
              <ToggleRow
                label="Show AI Career & CV Advisor Box"
                checked={content.showAiCareerAdvisor}
                onChange={(v) => updateField('showAiCareerAdvisor', v)}
              />
              <ToggleRow
                label="Show About Section on Homepage"
                checked={content.showAboutSection}
                onChange={(v) => updateField('showAboutSection', v)}
              />
            </div>

            {content.showHowItWorksSection && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      How It Works Heading
                    </label>
                    <input
                      type="text"
                      value={content.howItWorksTitle}
                      onChange={(e) => updateField('howItWorksTitle', e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      How It Works Subtitle
                    </label>
                    <input
                      type="text"
                      value={content.howItWorksSubtitle}
                      onChange={(e) => updateField('howItWorksSubtitle', e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      num: 'Step 1',
                      tKey: 'howItWorksStep1Title' as const,
                      dKey: 'howItWorksStep1Desc' as const,
                    },
                    {
                      num: 'Step 2',
                      tKey: 'howItWorksStep2Title' as const,
                      dKey: 'howItWorksStep2Desc' as const,
                    },
                    {
                      num: 'Step 3',
                      tKey: 'howItWorksStep3Title' as const,
                      dKey: 'howItWorksStep3Desc' as const,
                    },
                  ].map((s) => (
                    <div
                      key={s.num}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                    >
                      <div className="text-[11px] font-bold uppercase text-[#16A34A]">{s.num}</div>
                      <input
                        type="text"
                        value={content[s.tKey]}
                        onChange={(e) => updateField(s.tKey, e.target.value)}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-200 bg-white outline-none"
                      />
                      <textarea
                        rows={3}
                        value={content[s.dKey]}
                        onChange={(e) => updateField(s.dKey, e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white outline-none leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  CV Assistance Heading
                </label>
                <input
                  type="text"
                  value={content.cvAssistanceTitle}
                  onChange={(e) => updateField('cvAssistanceTitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  About Section Heading
                </label>
                <input
                  type="text"
                  value={content.aboutSectionTitle}
                  onChange={(e) => updateField('aboutSectionTitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  CV Assistance Description
                </label>
                <textarea
                  rows={2}
                  value={content.cvAssistanceSubtitle}
                  onChange={(e) => updateField('cvAssistanceSubtitle', e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: FOOTER, CONTACT & SOCIAL */}
      {subTab === 'footer' && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-[#0B132B]">
              Footer, Contact Information &amp; Social Media Links
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Update contact details, about statement, footer columns, copyright line, Telegram channel link, and optional social media pages.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Physical Address
              </label>
              <input
                type="text"
                value={contactAddress}
                onChange={(e) => setContactAddress(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              About Text (Homepage &amp; Footer Mission Statement)
            </label>
            <textarea
              rows={3}
              value={aboutText}
              onChange={(e) => setAboutText(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Telegram Handle
              </label>
              <input
                type="text"
                value={telegramChannelName}
                onChange={(e) => setTelegramChannelName(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Telegram Channel URL
              </label>
              <input
                type="text"
                value={telegramChannelUrl}
                onChange={(e) => setTelegramChannelUrl(e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Footer Telegram Button Text
              </label>
              <input
                type="text"
                value={content.footerTelegramButtonText}
                onChange={(e) => updateField('footerTelegramButtonText', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Footer Verification Trust Line
              </label>
              <input
                type="text"
                value={content.footerVerificationText}
                onChange={(e) => updateField('footerVerificationText', e.target.value)}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Custom Copyright Text (Optional)
              </label>
              <input
                type="text"
                value={content.footerCopyrightText}
                onChange={(e) => updateField('footerCopyrightText', e.target.value)}
                placeholder="© 2026 HopelandJobs. All rights reserved."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <ToggleRow
              label="Show Footer Sector Links"
              checked={content.showFooterSectors}
              onChange={(v) => updateField('showFooterSectors', v)}
            />
            <ToggleRow
              label="Show Footer Key Cities"
              checked={content.showFooterCities}
              onChange={(v) => updateField('showFooterCities', v)}
            />
            <ToggleRow
              label="Show Footer Global Pathways"
              checked={content.showFooterGlobalLinks}
              onChange={(v) => updateField('showFooterGlobalLinks', v)}
            />
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Optional Social Media Links (Shown in Footer when Filled)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Facebook</label>
                <input
                  type="url"
                  value={content.socialFacebookUrl}
                  onChange={(e) => updateField('socialFacebookUrl', e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">LinkedIn</label>
                <input
                  type="url"
                  value={content.socialLinkedinUrl}
                  onChange={(e) => updateField('socialLinkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/company/..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">X / Twitter</label>
                <input
                  type="url"
                  value={content.socialTwitterUrl}
                  onChange={(e) => updateField('socialTwitterUrl', e.target.value)}
                  placeholder="https://x.com/..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">TikTok</label>
                <input
                  type="url"
                  value={content.socialTiktokUrl}
                  onChange={(e) => updateField('socialTiktokUrl', e.target.value)}
                  placeholder="https://tiktok.com/@..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">YouTube</label>
                <input
                  type="url"
                  value={content.socialYoutubeUrl}
                  onChange={(e) => updateField('socialYoutubeUrl', e.target.value)}
                  placeholder="https://youtube.com/@..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-[#16A34A] text-white font-bold text-xs inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving Changes...' : 'Save & Publish All Website Changes'}</span>
        </button>
      </div>

      {/* In-App Reset Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#0B132B]">Reset Website Content to Defaults?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore all homepage headlines, section visibility switches, banner text, and footer copy back to HopelandJobs defaults. Your jobs, logo, and Telegram bot token will remain untouched.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetDefaults}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
