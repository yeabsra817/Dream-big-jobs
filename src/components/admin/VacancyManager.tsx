import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Edit,
  Trash2,
  Send,
  Eye,
  Calendar,
  Clock,
  Sparkles,
  Building,
  CheckCircle,
  AlertTriangle,
  Archive,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Vacancy } from '../../types/job';
import { isExpired, getDaysLeft } from '../../utils/helpers';
import { VacancyDetailModal } from '../VacancyDetailModal';

interface Props {
  vacancies: Vacancy[];
  onEditVacancy: (vacancy: Vacancy) => void;
  onDeleteVacancy: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, newStatus: Vacancy['status'], newDeadline?: string) => Promise<void>;
  onOpenManualPost: () => void;
  onBroadcastTelegram: (vacancy: Vacancy) => void;
  telegramUrl: string;
}

export const VacancyManager: React.FC<Props> = ({
  vacancies,
  onEditVacancy,
  onDeleteVacancy,
  onUpdateStatus,
  onOpenManualPost,
  onBroadcastTelegram,
  telegramUrl,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInspect, setSelectedInspect] = useState<Vacancy | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [newDeadlines, setNewDeadlines] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return vacancies.filter((v) => {
      const isAutoExpired = isExpired(v.applicationDeadline);
      const computedStatus = isAutoExpired && v.status === 'published' ? 'expired' : v.status;

      const matchesSearch =
        !search.trim() ||
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.organization.toLowerCase().includes(search.toLowerCase()) ||
        (v.referenceNumber && v.referenceNumber.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ||
        computedStatus === statusFilter ||
        (statusFilter === 'expired' && isAutoExpired);

      return matchesSearch && matchesStatus;
    });
  }, [vacancies, search, statusFilter]);

  const handleExtend = async (v: Vacancy) => {
    const customDate = newDeadlines[v.id];
    if (!customDate) {
      alert('Please enter a new deadline (e.g. 2026-12-15).');
      return;
    }
    await onUpdateStatus(v.id, 'published', customDate);
    setExtendingId(null);
  };

  const getStatusBadge = (v: Vacancy) => {
    const expired = isExpired(v.applicationDeadline);
    if (expired && v.status === 'published') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          Expired (Deadline Passed)
        </span>
      );
    }

    switch (v.status) {
      case 'published':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Published (Live)
          </span>
        );
      case 'draft':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            Draft
          </span>
        );
      case 'pending_review':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            Pending Review
          </span>
        );
      case 'closed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800">
            Closed
          </span>
        );
      case 'archived':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
            Archived
          </span>
        );
      case 'duplicate':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
            Duplicate
          </span>
        );
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100">{v.status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0B132B]">
              All Vacancies Management ({vacancies.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Full lifecycle control: publish, archive, extend deadlines, broadcast to Telegram, or edit details.
            </p>
          </div>

          <button
            onClick={onOpenManualPost}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Post New Vacancy Manually</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by job title, organization, reference number..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 text-xs outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 text-xs outline-none bg-white font-medium text-slate-700"
            >
              <option value="all">All Statuses ({vacancies.length})</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
              <option value="pending_review">Pending Review</option>
              <option value="expired">Expired (Past Deadline)</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Vacancies Table / List */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No vacancies match your search or filter.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((vacancy) => {
              const isAutoExpired = isExpired(vacancy.applicationDeadline);

              return (
                <div
                  key={vacancy.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {getStatusBadge(vacancy)}
                        {vacancy.telegramPublished ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#229ED9]/15 text-[#0277BD] border border-[#229ED9]/30 flex items-center gap-1">
                            <Send className="w-3 h-3 fill-current" />
                            <span>Telegram: Sent {vacancy.telegramMessageId ? `(#${vacancy.telegramMessageId})` : ''}</span>
                          </span>
                        ) : vacancy.telegramPublishError ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1" title={vacancy.telegramPublishError}>
                            <AlertTriangle className="w-3 h-3" />
                            <span>Telegram Failed</span>
                          </span>
                        ) : null}
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {vacancy.category}
                        </span>
                        <span className="text-xs text-slate-500">📍 {vacancy.location}</span>
                      </div>
                      <h4 className="text-base font-bold text-[#0B132B]">
                        {vacancy.title}
                      </h4>
                      <p className="text-xs font-semibold text-slate-600">
                        {vacancy.organization}
                      </p>
                    </div>

                    <div className="text-xs text-slate-500 sm:text-right shrink-0">
                      <div>Deadline: <strong className="text-slate-800">{vacancy.applicationDeadline}</strong></div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Created: {new Date(vacancy.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Deadline Extension Box */}
                  {extendingId === vacancy.id && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-amber-900">Extend Deadline:</span>
                      <input
                        type="text"
                        placeholder="YYYY-MM-DD (e.g. 2026-12-15)"
                        value={newDeadlines[vacancy.id] || ''}
                        onChange={(e) =>
                          setNewDeadlines({ ...newDeadlines, [vacancy.id]: e.target.value })
                        }
                        className="text-xs p-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                      <button
                        onClick={() => handleExtend(vacancy)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 font-bold text-xs text-slate-950"
                      >
                        Apply & Reactivate
                      </button>
                      <button
                        onClick={() => setExtendingId(null)}
                        className="px-2 py-1 text-xs text-slate-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedInspect(vacancy)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={() => onEditVacancy(vacancy)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => onBroadcastTelegram(vacancy)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          vacancy.telegramPublished
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            : 'bg-[#229ED9]/15 text-[#0288D1] hover:bg-[#229ED9]/25 border border-[#229ED9]/30'
                        }`}
                        title="Broadcast formatted post to Telegram Channel @DreamBigJobsEthiopia"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{vacancy.telegramPublished ? 'Re-send to Telegram' : 'Send to Telegram'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAutoExpired && (
                        <button
                          onClick={() => setExtendingId(vacancy.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Extend Deadline</span>
                        </button>
                      )}

                      {vacancy.status !== 'published' && !isAutoExpired && (
                        <button
                          onClick={() => onUpdateStatus(vacancy.id, 'published')}
                          className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Publish Now</span>
                        </button>
                      )}

                      {vacancy.status === 'published' && (
                        <button
                          onClick={() => onUpdateStatus(vacancy.id, 'closed')}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800"
                        >
                          Close
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${vacancy.title}"?`)) {
                            onDeleteVacancy(vacancy.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        title="Delete vacancy"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedInspect && (
        <VacancyDetailModal
          vacancy={selectedInspect}
          onClose={() => setSelectedInspect(null)}
          telegramUrl={telegramUrl}
        />
      )}
    </div>
  );
};
