import React, { useState } from 'react';
import {
  Download,
  Upload,
  Save,
  BarChart3,
  Database,
  Building,
  MapPin,
  CheckCircle2,
  AlertCircle,
  FileText,
  Globe,
  X,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { SiteSettings, Vacancy, DuplicateReportItem, OFFICIAL_CATEGORIES } from '../../types/job';
import { generateFullSystemBackupSnapshot } from '../../lib/firebase';
import { DEFAULT_GA_MEASUREMENT_ID } from '../../lib/analyticsTracker';
import { AppBrandLogo } from '../AppBrandLogo';

interface Props {
  settings: SiteSettings;
  vacancies: Vacancy[];
  duplicateReports: DuplicateReportItem[];
  onSaveSettings: (settings: SiteSettings) => Promise<void>;
  onRestoreData: (backupData: {
    vacancies: Vacancy[];
    settings?: SiteSettings;
    duplicateReports?: DuplicateReportItem[];
  }) => Promise<void>;
}

export const SiteSettingsPanel: React.FC<Props> = ({
  settings,
  vacancies,
  duplicateReports,
  onSaveSettings,
  onRestoreData,
}) => {
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || 'nexusitsoultion@gmail.com');
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '+251 91 123 4567');
  const [contactAddress, setContactAddress] = useState(
    settings.contactAddress || 'Bole Subcity, Addis Ababa, Ethiopia'
  );
  const [customDomain, setCustomDomain] = useState(settings.customDomain || 'hopelandjobs.tech');
  const [aboutText, setAboutText] = useState(settings.aboutText || '');
  const [appLogoUrl, setAppLogoUrl] = useState(settings.appLogoUrl || '');
  const [appLogo512Url, setAppLogo512Url] = useState(settings.appLogo512Url || '');
  const [appLogoMaskable512Url, setAppLogoMaskable512Url] = useState(
    settings.appLogoMaskable512Url || ''
  );
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingRestore, setPendingRestore] = useState<{
    vacancies: Vacancy[];
    settings?: SiteSettings;
    duplicateReports?: DuplicateReportItem[];
    dateLabel: string;
  } | null>(null);

  React.useEffect(() => {
    setAppLogoUrl(settings.appLogoUrl || '');
    setAppLogo512Url(settings.appLogo512Url || '');
    setAppLogoMaskable512Url(settings.appLogoMaskable512Url || '');
  }, [settings.appLogoUrl, settings.appLogo512Url, settings.appLogoMaskable512Url]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
  };

  const renderSquareIconCanvas = (
    img: HTMLImageElement,
    size: number,
    paddingRatio: number,
    backgroundColor?: string
  ): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable for generating app icons.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, size, size);

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, size, size);
    }

    const innerBox = Math.round(size * (1 - paddingRatio * 2));
    const srcW = Math.max(1, img.naturalWidth || img.width || size);
    const srcH = Math.max(1, img.naturalHeight || img.height || size);
    const scale = Math.min(innerBox / srcW, innerBox / srcH);
    const drawW = Math.max(1, Math.round(srcW * scale));
    const drawH = Math.max(1, Math.round(srcH * scale));
    const dx = Math.round((size - drawW) / 2);
    const dy = Math.round((size - drawH) / 2);
    ctx.drawImage(img, dx, dy, drawW, drawH);

    // Android WebAPK and Desktop Chrome/Edge require PNG (or JPEG) icons at exact declared sizes.
    let dataUri = canvas.toDataURL('image/png');
    const maxAllowedChars = size >= 512 ? 250000 : 180000;
    if (dataUri.length > maxAllowedChars) {
      // Keep clean opaque background when falling back to JPEG for photographic uploads
      if (!backgroundColor) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }
      dataUri = canvas.toDataURL('image/jpeg', 0.86);
    }
    if (dataUri.length > 310000) {
      dataUri = canvas.toDataURL('image/jpeg', 0.74);
    }
    return dataUri;
  };

  const generateBrandLogoVariants = (
    file: File
  ): Promise<{ logo192: string; logo512: string; logoMaskable512: string }> =>
    new Promise((resolve, reject) => {
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('Logo file is too large (max 8 MB).'));
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          // Exact 192x192 PNG for phone notifications, tabs, & launcher icon
          const logo192 = renderSquareIconCanvas(img, 192, 0.04);
          // Exact 512x512 PNG for Android WebAPK, Desktop Chrome/Edge app icon, & splash screen
          const logo512 = renderSquareIconCanvas(img, 512, 0.04);
          // Exact 512x512 maskable icon with 16% safe-zone margin on clean solid backdrop
          const logoMaskable512 = renderSquareIconCanvas(img, 512, 0.16, '#FFFFFF');
          URL.revokeObjectURL(objectUrl);

          if (
            logo192.length > 320000 ||
            logo512.length > 320000 ||
            logoMaskable512.length > 320000
          ) {
            reject(new Error('Compressed icon exceeds safe storage limit. Please use a cleaner square logo.'));
            return;
          }
          resolve({ logo192, logo512, logoMaskable512 });
        } catch (err: any) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unsupported or corrupted image file. Use PNG, JPG, WebP, or SVG.'));
      };
      img.src = objectUrl;
    });

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const variants = await generateBrandLogoVariants(file);
      setAppLogoUrl(variants.logo192);
      setAppLogo512Url(variants.logo512);
      setAppLogoMaskable512Url(variants.logoMaskable512);
      showFeedback(
        'success',
        'Logo prepared in 192x192, 512x512, and Android Maskable formats! Click "Save App Logo" below to publish it across phones & computers.'
      );
    } catch (err: any) {
      showFeedback('error', err?.message || 'Could not process selected logo image.');
    } finally {
      e.target.value = '';
    }
  };

  const purgeServiceWorkerIconCache = () => {
    try {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.controller?.postMessage({ type: 'HOPELAND_PURGE_ICON_CACHE' });
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.active?.postMessage({ type: 'HOPELAND_PURGE_ICON_CACHE' });
            reg.update().catch(() => {});
          })
          .catch(() => {});
      }
    } catch {}
  };

  const handleSaveLogo = async (overrideLogo?: string) => {
    setIsSavingLogo(true);
    setFeedback(null);
    try {
      const isReset = overrideLogo === '';
      const cleanLogo = (overrideLogo !== undefined ? overrideLogo : appLogoUrl).trim();
      if (cleanLogo && !cleanLogo.startsWith('data:image/') && !/^https?:\/\//i.test(cleanLogo)) {
        showFeedback('error', 'Logo URL must start with https:// or be an uploaded image.');
        setIsSavingLogo(false);
        return;
      }
      const next512 = isReset
        ? ''
        : cleanLogo.startsWith('data:image/')
        ? appLogo512Url || cleanLogo
        : cleanLogo;
      const nextMaskable512 = isReset
        ? ''
        : cleanLogo.startsWith('data:image/')
        ? appLogoMaskable512Url || next512
        : cleanLogo;

      const nowIso = new Date().toISOString();
      await onSaveSettings({
        ...settings,
        appLogoUrl: cleanLogo,
        appLogo512Url: next512,
        appLogoMaskable512Url: nextMaskable512,
        appLogoUpdatedAt: nowIso,
        updatedAt: nowIso,
      });
      setAppLogoUrl(cleanLogo);
      setAppLogo512Url(next512);
      setAppLogoMaskable512Url(nextMaskable512);
      purgeServiceWorkerIconCache();

      showFeedback(
        'success',
        cleanLogo
          ? 'App Logo published (192px, 512px & Maskable)! Website tabs and new Phone/Computer installs use it immediately. On phones where HopelandJobs was already installed earlier, reopen the app or remove & re-install via "Download Application" to refresh the home screen icon.'
          : 'App Logo reset to default HopelandJobs green briefcase icon across phones and computers.'
      );
    } catch (err: any) {
      showFeedback('error', 'Error saving app logo: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingLogo(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const cleanDomain = customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '') || 'hopelandjobs.tech';
      const nowIso = new Date().toISOString();
      const logoChanged =
        appLogoUrl.trim() !== (settings.appLogoUrl || '').trim() ||
        appLogo512Url.trim() !== (settings.appLogo512Url || '').trim();
      await onSaveSettings({
        ...settings,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        contactAddress: contactAddress.trim(),
        customDomain: cleanDomain,
        aboutText: aboutText.trim(),
        appLogoUrl: appLogoUrl.trim(),
        appLogo512Url: appLogo512Url.trim(),
        appLogoMaskable512Url: appLogoMaskable512Url.trim(),
        appLogoUpdatedAt: logoChanged ? nowIso : settings.appLogoUpdatedAt || nowIso,
        gaMeasurementId: settings.gaMeasurementId || DEFAULT_GA_MEASUREMENT_ID,
        gaTrackingEnabled: settings.gaTrackingEnabled !== false,
        updatedAt: nowIso,
      });
      if (logoChanged) {
        purgeServiceWorkerIconCache();
      }
      showFeedback(
        'success',
        `Site settings saved permanently! Active domain: "${cleanDomain}". Always-On GA4 (${settings.gaMeasurementId || DEFAULT_GA_MEASUREMENT_ID}) preserved.`
      );
    } catch (err: any) {
      showFeedback('error', 'Error saving settings: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Export full backup as JSON (Full System Snapshot)
  const handleExportBackup = async () => {
    setFeedback(null);
    try {
      const snapshot = await generateFullSystemBackupSnapshot(
        vacancies,
        settings,
        duplicateReports
      );

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `DREAM_BIG_JOBS_FULL_SNAPSHOT_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showFeedback('success', `System snapshot exported (${snapshot.totalRecordsCount} records).`);
    } catch (err: any) {
      showFeedback('error', 'Failed to generate full system snapshot: ' + (err?.message || 'Unknown error'));
    }
  };

  // Restore backup from JSON (Backward compatible with both formats) - uses in-app modal instead of window.confirm
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const vacancyList = parsed.data?.vacancies || parsed.vacancies;

        if (!vacancyList || !Array.isArray(vacancyList)) {
          showFeedback('error', 'Invalid backup file. Must contain a valid vacancies array or data object.');
          return;
        }

        const dateLabel = parsed.timestamp || parsed.backupDate || 'Unknown date';
        setPendingRestore({
          vacancies: vacancyList,
          settings: parsed.data?.siteSettings || parsed.settings,
          duplicateReports: parsed.data?.duplicateReports || parsed.duplicateReports,
          dateLabel,
        });
      } catch (err: any) {
        showFeedback('error', 'Failed to parse backup JSON: ' + (err?.message || 'Invalid JSON'));
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    const target = pendingRestore;
    setPendingRestore(null);
    setIsRestoring(true);
    setFeedback(null);
    try {
      await onRestoreData({
        vacancies: target.vacancies,
        settings: target.settings,
        duplicateReports: target.duplicateReports,
      });
      showFeedback('success', `Backup restored cleanly (${target.vacancies.length} vacancies synchronized).`);
    } catch (err: any) {
      showFeedback('error', 'Restore failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsRestoring(false);
    }
  };

  // Category counts
  const categoryCounts = OFFICIAL_CATEGORIES.map((cat) => ({
    name: cat.name,
    count: vacancies.filter((v) => v.category === cat.name && v.status === 'published').length,
  }));

  const publishedCount = vacancies.filter((v) => v.status === 'published').length;

  return (
    <div className="space-y-8">
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
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
            className="p-1 rounded-lg hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Real Analytics Overview */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <BarChart3 className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-[#0B132B]">
            Platform Vacancy Statistics & Analytics
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#FFFBEB] p-4 rounded-2xl border border-amber-200 text-center">
            <div className="text-xs font-bold text-amber-800 uppercase">Live Published Jobs</div>
            <div className="text-3xl font-black text-amber-900 mt-1">{publishedCount}</div>
            <div className="text-[11px] text-amber-700">Currently active</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
            <div className="text-xs font-bold text-slate-500 uppercase">Total on Record</div>
            <div className="text-3xl font-black text-slate-900 mt-1">{vacancies.length}</div>
            <div className="text-[11px] text-slate-400">All statuses</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
            <div className="text-xs font-bold text-slate-500 uppercase">Drafts & Review</div>
            <div className="text-3xl font-black text-slate-700 mt-1">
              {vacancies.filter((v) => v.status === 'draft' || v.status === 'pending_review').length}
            </div>
            <div className="text-[11px] text-slate-400">Pending publication</div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
            <div className="text-xs font-bold text-slate-500 uppercase">Duplicates Discarded</div>
            <div className="text-3xl font-black text-amber-700 mt-1">{duplicateReports.length}</div>
            <div className="text-[11px] text-slate-400">Filtered out</div>
          </div>
        </div>

        {/* Breakdown by Category */}
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Active Vacancies by Sector (Real Database Count)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {categoryCounts.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
              >
                <span className="font-medium text-slate-700 line-clamp-1">{c.name}</span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-white text-slate-900 border border-slate-200 shrink-0">
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Website Contact & About Settings */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <FileText className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-[#0B132B]">
            Website Information & Contact Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Contact Phone</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Physical Address</label>
            <input
              type="text"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none"
            />
          </div>

          <div className="sm:col-span-3 bg-amber-50/70 p-4 rounded-2xl border border-amber-200">
            <label className="text-xs font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-amber-600" />
              <span>Production Website Domain (Used in Telegram Posts & Deep Links)</span>
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-mono text-slate-500 bg-white px-2.5 py-2.5 rounded-xl border border-slate-200 select-none">
                https://
              </span>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="hopelandjobs.tech"
                className="flex-1 text-xs font-mono font-bold p-2.5 rounded-xl border border-amber-300 focus:border-amber-500 outline-none bg-white text-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
              💡 When you change your domain here (e.g. to <strong>hopelandjobs.tech</strong>), all Telegram Apply Now buttons and notification deep links will automatically point to this domain.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            About HOPELAND JOBS (Homepage Mission Statement)
          </label>
          <textarea
            rows={4}
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none leading-relaxed"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold text-xs transition-all shadow-md"
        >
          {isSaving ? 'Saving...' : 'Save Website Information'}
        </button>
      </div>

      {/* App Logo & Mobile Icon Branding */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#16A34A]" />
            <div>
              <h2 className="text-xl font-bold text-[#0B132B]">
                App Logo &amp; Mobile Icon Branding
              </h2>
              <p className="text-xs text-slate-500">
                Change the logo across the website header, install popups, browser tabs, and mobile Home Screen icon whenever data loads.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Live Preview */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Live Brand Preview
            </span>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs">
              <AppBrandLogo logoUrl={appLogoUrl} size="md" variant="green" />
              <span className="font-extrabold text-lg tracking-tight text-[#0B132B]">
                Hopeland<span className="text-[#16A34A]">Jobs</span>
              </span>
            </div>

            <div className="bg-[#0B132B] p-4 rounded-xl flex items-center gap-3">
              <AppBrandLogo logoUrl={appLogoUrl} size="xl" variant="green" />
              <div>
                <p className="text-xs font-extrabold text-white">Phone &amp; Computer Icon</p>
                <p className="text-[11px] text-slate-300">192px, 512px &amp; Maskable</p>
              </div>
            </div>
          </div>

          {/* Upload & URL Controls */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs cursor-pointer transition-colors shadow-xs">
                <Upload className="w-4 h-4" />
                <span>Upload Logo Image (PNG / JPG / SVG)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />
              </label>

              {appLogoUrl && (
                <button
                  type="button"
                  onClick={() => handleSaveLogo('')}
                  disabled={isSavingLogo}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Default</span>
                </button>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Or Paste Direct Logo Image URL (HTTPS)
              </label>
              <input
                type="text"
                value={appLogoUrl.startsWith('data:image/') ? '' : appLogoUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setAppLogoUrl(val);
                  setAppLogo512Url(val);
                  setAppLogoMaskable512Url(val);
                }}
                placeholder={
                  appLogoUrl.startsWith('data:image/')
                    ? 'Custom uploaded icon pack ready (paste an https:// URL to replace)'
                    : 'https://example.com/hopeland-logo.png'
                }
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-[#16A34A] outline-none font-mono"
              />
              {appLogoUrl.startsWith('data:image/') && (
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                  Uploaded icon pack ready (192px: {Math.round(appLogoUrl.length / 1024)} KB
                  {appLogo512Url ? ` • 512px: ${Math.round(appLogo512Url.length / 1024)} KB` : ''}). Click Save App Logo to publish to phones &amp; computers.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSaveLogo()}
                disabled={isSavingLogo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B132B] hover:bg-amber-500 hover:text-slate-950 text-white font-extrabold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingLogo ? 'Publishing Logo...' : 'Save App Logo'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup and Restore Data */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Database className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-xl font-bold text-[#0B132B]">
              Database Backup & Restore
            </h2>
            <p className="text-xs text-slate-500">
              Download your entire vacancy database as a structured JSON file or restore from a previous backup anytime.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Download Complete Backup</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Export all {vacancies.length} vacancies, duplicate logs, and website settings into a single downloadable JSON file.
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B132B] hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Restore from Backup File</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Upload a JSON backup file to restore or synchronize vacancies to Firestore.
              </p>
            </div>
            <div>
              <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 transition-colors shadow-sm cursor-pointer">
                <Upload className="w-4 h-4 text-amber-600" />
                <span>{isRestoring ? 'Restoring Data...' : 'Upload & Restore Backup (.json)'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                  disabled={isRestoring}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Permanent GA4 Configuration Status Pill */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="font-extrabold text-emerald-950 block">
                Google Analytics 4 Always-On Integration
              </span>
              <span className="text-[11px] text-emerald-800">
                Measurement ID: <strong className="font-mono">{settings.gaMeasurementId || DEFAULT_GA_MEASUREMENT_ID}</strong> • Persisted across restarts and deployments.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-600 text-white shrink-0">
            {settings.gaTrackingEnabled !== false ? 'ALWAYS ENABLED' : 'PAUSED'}
          </span>
        </div>
      </div>

      {/* Explicit Restore Confirmation Modal */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900">Confirm Backup Restore</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Restore <strong>{pendingRestore.vacancies.length}</strong> vacancies and configuration from backup snapshot dated{' '}
              <strong>{pendingRestore.dateLabel}</strong>? Existing records will be merged safely without wiping analytics or staff profiles.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2 rounded-xl bg-[#0B132B] hover:bg-amber-400 hover:text-slate-950 text-white text-xs font-extrabold"
              >
                Confirm &amp; Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
