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
  FileText,
} from 'lucide-react';
import { SiteSettings, Vacancy, DuplicateReportItem, OFFICIAL_CATEGORIES } from '../../types/job';

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
  const [aboutText, setAboutText] = useState(settings.aboutText || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings({
        ...settings,
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        contactAddress: contactAddress.trim(),
        aboutText: aboutText.trim(),
        updatedAt: new Date().toISOString(),
      });
      alert('Site settings saved successfully!');
    } catch (err: any) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Export full backup as JSON
  const handleExportBackup = () => {
    const backupObj = {
      backupDate: new Date().toISOString(),
      platform: 'DREAM BIG JOBS',
      version: '1.0.0',
      totalVacancies: vacancies.length,
      vacancies,
      settings,
      duplicateReports,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `DREAM_BIG_JOBS_BACKUP_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Restore backup from JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.vacancies || !Array.isArray(parsed.vacancies)) {
          alert('Invalid backup file. Must contain a valid vacancies array.');
          return;
        }

        if (
          confirm(
            `Restore ${parsed.vacancies.length} vacancies from backup file dated ${
              parsed.backupDate || 'Unknown'
            }?`
          )
        ) {
          setIsRestoring(true);
          await onRestoreData({
            vacancies: parsed.vacancies,
            settings: parsed.settings,
            duplicateReports: parsed.duplicateReports,
          });
          alert('Backup restored successfully!');
        }
      } catch (err: any) {
        alert('Failed to parse backup JSON: ' + err.message);
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Category counts
  const categoryCounts = OFFICIAL_CATEGORIES.map((cat) => ({
    name: cat.name,
    count: vacancies.filter((v) => v.category === cat.name && v.status === 'published').length,
  }));

  const publishedCount = vacancies.filter((v) => v.status === 'published').length;

  return (
    <div className="space-y-8">
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
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">
            About DREAM BIG JOBS (Homepage Mission Statement)
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
      </div>
    </div>
  );
};
