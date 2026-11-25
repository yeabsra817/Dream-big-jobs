import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import type { AutonomousDiscoveryStatusResponse } from '../types/autonomousDiscovery';
import { fetchAutonomousDiscoveryStatus } from '../lib/autonomousDiscoveryService';

interface Props {
  onOpenInternationalOpportunities: () => void;
  onOpenVisaSponsored3kJobs: () => void;
}

function formatShortTime(iso: string | null | undefined, eatFallback?: string | null): string {
  if (eatFallback) return eatFallback;
  if (!iso) return 'Pending first cycle';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatCountdown(targetIso: string | null | undefined, nowMs: number): string {
  if (!targetIso) return 'Every 60s';
  const diffSec = Math.max(0, Math.ceil((Date.parse(targetIso) - nowMs) / 1000));
  if (Number.isNaN(diffSec)) return 'Every 60s';
  if (diffSec === 0) return 'Running now';
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export const AutonomousDiscoveryHomepageSection: React.FC<Props> = ({
  onOpenInternationalOpportunities,
  onOpenVisaSponsored3kJobs,
}) => {
  const [status, setStatus] = useState<AutonomousDiscoveryStatusResponse | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    let active = true;
    const load = async () => {
      const next = await fetchAutonomousDiscoveryStatus();
      if (active && next) setStatus(next);
    };
    load();
    const pollTimer = window.setInterval(load, 20000);
    const clockTimer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const counts = status?.counts;
  const lastError = status?.lastError || null;

  return (
    <section
      aria-label="International Jobs Opportunity and Visa-Sponsored Jobs $3,000+"
      className="bg-white py-10 sm:py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-100"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Side-by-Side Homepage Cards: International Jobs Opportunity + Visa-Sponsored Jobs $3,000+ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Existing International Jobs Opportunity Section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#16A34A]">
                <Globe className="w-4 h-4" />
                <span>6-Department Global Intelligence</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B132B]">
                International Jobs Opportunity
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Verified international employer-sponsored roles, UN &amp; World Bank openings,
                WASH vacancies, fully funded scholarships, training, and official government
                permanent residency pathways for Ethiopian professionals.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-slate-500 font-medium">Active Verified Roles</div>
                  <div className="text-xl font-bold text-[#0B132B] tabular-nums mt-0.5">
                    {counts ? counts.globalActiveCount.toLocaleString() : '—'}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/80 p-3">
                  <div className="text-xs text-slate-500 font-medium">Official PR Countries</div>
                  <div className="text-xl font-bold text-[#0B132B] tabular-nums mt-0.5">
                    {counts ? counts.prCountriesVerifiedCount.toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenInternationalOpportunities}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-[#0B132B] hover:bg-slate-800 text-white text-sm font-bold transition-colors cursor-pointer"
            >
              <span>Explore International Jobs Opportunity</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* RIGHT (Immediately Beside It): Visa-Sponsored Jobs $3,000+ */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <DollarSign className="w-4 h-4" />
                <span>Strict 6-Gate $3,000+/mo Salary &amp; Visa Audit</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0B132B]">
                Visa-Sponsored Jobs $3,000+
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Dedicated high-paying international banking, finance, accounting, branch management,
                credit, and compliance roles with confirmed employer visa sponsorship, USD-converted
                base salary above $3,000/month, and verified official employer links.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white rounded-xl border border-emerald-200/80 p-3">
                  <div className="text-xs text-slate-500 font-medium">Verified $3,000+ Matches</div>
                  <div className="text-xl font-bold text-emerald-800 tabular-nums mt-0.5">
                    {counts ? counts.visa3kVerifiedCount.toLocaleString() : '—'}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-emerald-200/80 p-3">
                  <div className="text-xs text-slate-500 font-medium">Live Postings Audited</div>
                  <div className="text-xl font-bold text-[#0B132B] tabular-nums mt-0.5">
                    {counts ? counts.visa3kAuditedCount.toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenVisaSponsored3kJobs}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-bold transition-colors cursor-pointer"
            >
              <Briefcase className="w-4 h-4" />
              <span>Open Visa-Sponsored Jobs $3,000+</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Continuous 1-Minute Autonomous Discovery Status Panel */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#16A34A] shrink-0" />
              <h3 className="text-sm font-bold text-[#0B132B]">
                Autonomous 24/7 Opportunity Discovery (Every {status?.intervalSeconds || 60} Seconds)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Next scheduled search:{' '}
                <strong className="text-[#0B132B] tabular-nums">
                  {status?.isCurrentlyRunning
                    ? 'Running now'
                    : formatCountdown(status?.nextScheduledSearchAt, nowMs)}
                </strong>
              </span>
              {status?.sourcesSummary && (
                <span className="hidden md:inline text-slate-500">
                  {status.sourcesSummary.healthyCount}/{status.sourcesSummary.totalApproved} approved sources healthy
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="text-[11px] font-medium text-slate-500">Last Successful Search</div>
              <div className="text-xs font-bold text-[#0B132B] mt-1 leading-snug">
                {formatShortTime(
                  status?.lastSuccessfulSearchAt,
                  status?.lastSuccessfulSearchAtEat
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="text-[11px] font-medium text-slate-500">Next Scheduled Search</div>
              <div className="text-xs font-bold text-[#0B132B] mt-1 leading-snug">
                {status?.nextScheduledSearchAtEat
                  ? status.nextScheduledSearchAtEat
                  : formatShortTime(status?.nextScheduledSearchAt)}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="text-[11px] font-medium text-slate-500">Discovered</div>
              <div className="text-lg font-bold text-[#0B132B] tabular-nums mt-0.5">
                {counts ? counts.opportunitiesDiscovered.toLocaleString() : '—'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="text-[11px] font-medium text-slate-500">Verified</div>
              <div className="text-lg font-bold text-[#15803D] tabular-nums mt-0.5">
                {counts ? counts.opportunitiesVerified.toLocaleString() : '—'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="text-[11px] font-medium text-slate-500">Rejected</div>
              <div className="text-lg font-bold text-slate-700 tabular-nums mt-0.5">
                {counts ? counts.opportunitiesRejected.toLocaleString() : '—'}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-3">
              <div className="text-[11px] font-medium text-slate-500">New Matching</div>
              <div className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">
                {counts ? counts.newMatchingOpportunities.toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <div
            className={`rounded-xl px-3.5 py-2.5 text-xs flex items-start gap-2 border ${
              lastError
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-white border-slate-200/80 text-slate-600'
            }`}
          >
            {lastError ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold">Last execution error: </span>
              <span>{lastError ? lastError : 'None — latest automated cycle completed cleanly.'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
