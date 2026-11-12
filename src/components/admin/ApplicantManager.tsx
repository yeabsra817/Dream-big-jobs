import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Building,
  UserCheck,
  Send,
  Eye,
  Award,
} from 'lucide-react';
import { UserJobApplication, ApplicationStatus } from '../../types/jobSeeker';
import { fetchAllApplicationsAdmin, updateApplicationStatus } from '../../lib/firebase';

export const ApplicantManager: React.FC = () => {
  const [applications, setApplications] = useState<UserJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedApplication, setSelectedApplication] = useState<UserJobApplication | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const loadApplications = async () => {
    setLoading(true);
    try {
      const data = await fetchAllApplicationsAdmin();
      setApplications(data);
    } catch (err) {
      console.error('Failed to load applications for admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    setUpdatingId(appId);
    try {
      await updateApplicationStatus(appId, newStatus, adminNotes);
      setApplications((prev) =>
        prev.map((app) =>
          app.id === appId
            ? {
                ...app,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                statusNotes: adminNotes || app.statusNotes,
              }
            : app
        )
      );
      if (selectedApplication?.id === appId) {
        setSelectedApplication((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                statusNotes: adminNotes || prev.statusNotes,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      (app.vacancyTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.organization || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Submitted
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Eye className="w-3 h-3" /> Under Review
          </span>
        );
      case 'shortlisted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Award className="w-3 h-3" /> Shortlisted
          </span>
        );
      case 'interview':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <UserCheck className="w-3 h-3" /> Interview
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Applicant & Candidate Review
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {applications.length} Received
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review submissions from Ethiopian job seekers, inspect CVs and cover letters, and track candidate progression.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadApplications}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, email, job title, or organization..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="all">All Statuses ({applications.length})</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="interview">Interview</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Layout: Split view of table and details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List (2 columns on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
              Loading applicant submissions...
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-600 font-semibold text-sm">No applications found</p>
              <p className="text-slate-400 text-xs mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try clearing the search or filter.'
                  : 'New job applications submitted by candidates will appear here immediately.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredApplications.map((app) => {
                const isSelected = selectedApplication?.id === app.id;
                return (
                  <div
                    key={app.id}
                    onClick={() => {
                      setSelectedApplication(app);
                      setAdminNotes(app.statusNotes || '');
                    }}
                    className={`p-4 transition-colors cursor-pointer hover:bg-slate-50 ${
                      isSelected ? 'bg-amber-50/60 border-l-4 border-amber-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{app.userName}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-0.5">
                          <span className="flex items-center gap-1 text-slate-600 font-medium">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                            {app.vacancyTitle}
                          </span>
                          <span>•</span>
                          <span>{app.organization}</span>
                        </div>
                      </div>
                      <div>{getStatusBadge(app.status)}</div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {app.userEmail}
                      </span>
                      <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Application Details Panel */}
        <div className="lg:col-span-1">
          {selectedApplication ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5 sticky top-24">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                    Application Details
                  </span>
                  {getStatusBadge(selectedApplication.status)}
                </div>
                <h3 className="font-extrabold text-base text-slate-900 mt-1">
                  {selectedApplication.userName}
                </h3>
                <p className="text-xs text-slate-500">{selectedApplication.vacancyTitle} at {selectedApplication.organization}</p>
              </div>

              {/* Candidate Info */}
              <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a href={`mailto:${selectedApplication.userEmail}`} className="hover:underline text-blue-600 truncate">
                    {selectedApplication.userEmail}
                  </a>
                </div>
                {selectedApplication.userPhone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <a href={`tel:${selectedApplication.userPhone}`} className="hover:underline">
                      {selectedApplication.userPhone}
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  Applied: {new Date(selectedApplication.appliedAt).toLocaleString()}
                </div>
              </div>

              {/* CV Document Attached */}
              {selectedApplication.resumeUrl ? (
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Candidate Resume / CV:
                  </label>
                  <a
                    href={selectedApplication.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors w-full"
                  >
                    <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate flex-1">{selectedApplication.resumeName || 'View Candidate CV'}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No document attached.</p>
              )}

              {/* Cover Note */}
              {selectedApplication.coverLetter && (
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Cover Letter / Statement:
                  </label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedApplication.coverLetter}
                  </div>
                </div>
              )}

              {/* Status Update Actions */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Update Candidate Status:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['submitted', 'under_review', 'shortlisted', 'interview', 'accepted', 'rejected'] as ApplicationStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(selectedApplication.id, st)}
                        disabled={updatingId === selectedApplication.id || selectedApplication.status === st}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors text-left border ${
                          selectedApplication.status === st
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500">
                    Administrator Review Notes:
                  </label>
                  <textarea
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add interview notes, feedback, or internal evaluation..."
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                  <button
                    onClick={() => handleStatusChange(selectedApplication.id, selectedApplication.status)}
                    disabled={updatingId === selectedApplication.id}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-colors"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Select an applicant from the list to view their CV, details, and update application status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
