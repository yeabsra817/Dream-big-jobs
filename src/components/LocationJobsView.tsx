import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  MapPin,
  Calendar,
  Briefcase,
  Building,
  Clock,
  Sparkles,
  Send,
  ExternalLink,
  Coins,
  GraduationCap,
  Heart,
  Share2,
  CheckCircle2,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { Vacancy, OFFICIAL_CATEGORIES, ETHIOPIAN_LOCATIONS } from '../types/job';
import { getDaysLeft, isExpired } from '../utils/helpers';

interface Props {
  initialLocation: string;
  vacancies: Vacancy[];
  onBack: () => void;
  onSelectVacancy: (vacancy: Vacancy) => void;
  savedJobIds: Set<string>;
  onToggleSaveJob: (jobId: string) => void;
  telegramUrl: string;
}

export const LocationJobsView: React.FC<Props> = ({
  initialLocation,
  vacancies,
  onBack,
  onSelectVacancy,
  savedJobIds,
  onToggleSaveJob,
  telegramUrl,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(initialLocation || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedExperience, setSelectedExperience] = useState<'All' | 'fresh' | 'mid' | 'senior'>('All');
  const [closingSoonOnly, setClosingSoonOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'latest' | 'deadline'>('latest');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter only active published vacancies
  const publishedVacancies = useMemo(() => {
    return vacancies.filter(
      (v) => v.status === 'published' && !isExpired(v.applicationDeadline)
    );
  }, [vacancies]);

  // Compute vacancy counts per city
  const cityCountMap = useMemo(() => {
    const map = new Map<string, number>();
    ETHIOPIAN_LOCATIONS.forEach((city) => {
      const keyword = city.split(' ')[0].toLowerCase();
      const count = publishedVacancies.filter((v) =>
        v.location.toLowerCase().includes(keyword)
      ).length;
      map.set(city, count);
    });
    return map;
  }, [publishedVacancies]);

  // Filter vacancies by selected city and search criteria
  const filteredVacancies = useMemo(() => {
    return publishedVacancies
      .filter((v) => {
        // City location match
        if (selectedCity !== 'All') {
          const keyword = selectedCity.split(' ')[0].toLowerCase();
          if (!v.location.toLowerCase().includes(keyword)) {
            return false;
          }
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = v.title.toLowerCase().includes(q);
          const matchesOrg = v.organization.toLowerCase().includes(q);
          const matchesLoc = v.location.toLowerCase().includes(q);
          const matchesDesc = v.description.toLowerCase().includes(q);
          const matchesSkills = v.requiredSkills?.some((s) => s.toLowerCase().includes(q));
          if (!matchesTitle && !matchesOrg && !matchesLoc && !matchesDesc && !matchesSkills) {
            return false;
          }
        }

        // Category filter
        if (selectedCategory !== 'All' && v.category !== selectedCategory) {
          return false;
        }

        // Experience Level Filter (Smart Ethiopian Candidate Helper)
        if (selectedExperience !== 'All') {
          const expText = (v.experienceYears || '').toLowerCase();
          const qualText = (v.educationQualification || '').toLowerCase();
          const isFresh =
            expText.includes('0') ||
            expText.includes('entry') ||
            expText.includes('fresh') ||
            expText.includes('not specified') ||
            expText.includes('1 year') ||
            qualText.includes('fresh');

          if (selectedExperience === 'fresh' && !isFresh) {
            return false;
          }
          if (selectedExperience === 'mid' && !expText.includes('2') && !expText.includes('3') && !expText.includes('4')) {
            return false;
          }
          if (selectedExperience === 'senior' && !expText.includes('5') && !expText.includes('6') && !expText.includes('7') && !expText.includes('8') && !expText.includes('10')) {
            return false;
          }
        }

        // Urgent / Closing Soon filter (< 3 days)
        if (closingSoonOnly) {
          const daysInfo = getDaysLeft(v.applicationDeadline);
          if (daysInfo.daysLeft > 3) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          const tA = Date.parse(a.applicationDeadline) || Infinity;
          const tB = Date.parse(b.applicationDeadline) || Infinity;
          return tA - tB;
        }
        const dateA = new Date(a.publishedAt || a.createdAt).getTime();
        const dateB = new Date(b.publishedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
  }, [
    publishedVacancies,
    selectedCity,
    searchQuery,
    selectedCategory,
    selectedExperience,
    closingSoonOnly,
    sortBy,
  ]);

  const handleQuickShareTelegram = (v: Vacancy, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?jobId=${v.id}`;
    const text = encodeURIComponent(
      `💼 ${v.title} at ${v.organization}\n📍 Location: ${v.location}\n💰 Salary: ${v.salary}\n⏳ Deadline: ${v.applicationDeadline}\nApply on DREAM BIG JOBS:\n${url}`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`, '_blank');
  };

  const handleCopyLink = (v: Vacancy, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?jobId=${v.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24">
      {/* City Banner Header */}
      <div className="bg-[#0B132B] text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto">
          {/* Back button */}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-amber-400 font-semibold text-xs mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to All Categories</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Jobs by Location</span>
                </span>
                <span className="text-xs text-slate-400">Ethiopia Nationwide Portal</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-white flex items-center gap-3">
                <span>{selectedCity === 'All' ? 'All Ethiopian Locations' : `${selectedCity} Vacancies`}</span>
                <span className="text-2xl">🇪🇹</span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                {selectedCity === 'All'
                  ? 'Browse verified job vacancies across Addis Ababa, regional state capitals, industrial zones, and nationwide projects.'
                  : `Explore career opportunities and open positions located in ${selectedCity} across banking, NGOs, hotels, and corporate sectors.`}
              </p>
            </div>

            {/* Total count badge */}
            <div className="bg-slate-900/90 backdrop-blur rounded-2xl p-4 border border-slate-700/80 text-center shrink-0 min-w-[130px]">
              <div className="text-3xl font-black text-amber-400">
                {filteredVacancies.length}
              </div>
              <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mt-0.5">
                {filteredVacancies.length === 1 ? 'Vacancy' : 'Vacancies'} Listed
              </div>
            </div>
          </div>

          {/* Quick Horizontal City Filter Bar */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <span>Select Ethiopian City or Region:</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setSelectedCity('All')}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCity === 'All'
                    ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                    : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span>All Locations</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/20">
                  {publishedVacancies.length}
                </span>
              </button>

              {ETHIOPIAN_LOCATIONS.map((loc) => {
                const count = cityCountMap.get(loc) || 0;
                const isSelected = selectedCity.toLowerCase() === loc.toLowerCase();

                return (
                  <button
                    key={loc}
                    onClick={() => setSelectedCity(loc)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                        : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    <span>{loc}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-slate-950/20 text-slate-950'
                          : count > 0
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-200 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search job title, bank, NGO, or skills..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-xs text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Category Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-xs text-slate-700 bg-white"
              >
                <option value="All">All 16 Job Sectors</option>
                {OFFICIAL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Smart Experience Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedExperience}
                onChange={(e) => setSelectedExperience(e.target.value as any)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-xs text-slate-700 bg-white"
              >
                <option value="All">All Experience Levels</option>
                <option value="fresh">🎓 Fresh Graduate (0 - 1 Year)</option>
                <option value="mid">💼 Mid-Level (2 - 4 Years)</option>
                <option value="senior">⭐ Senior (5+ Years)</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="md:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'latest' | 'deadline')}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 outline-none text-xs text-slate-700 bg-white font-medium"
              >
                <option value="latest">Sort: Newest</option>
                <option value="deadline">Sort: Deadline</option>
              </select>
            </div>
          </div>

          {/* Quick Smart Badges Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setClosingSoonOnly(!closingSoonOnly)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  closingSoonOnly
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${closingSoonOnly ? 'fill-current' : 'text-rose-500'}`} />
                <span>Closing Soon (&lt; 3 Days)</span>
              </button>

              <button
                onClick={() => setSelectedExperience(selectedExperience === 'fresh' ? 'All' : 'fresh')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                  selectedExperience === 'fresh'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Fresh Graduate / 0 Yr</span>
              </button>
            </div>

            <div className="text-slate-500 text-[11px] font-semibold">
              Showing {filteredVacancies.length} of {publishedVacancies.length} vacancies
            </div>
          </div>
        </div>
      </div>

      {/* Main Vacancies List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {filteredVacancies.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center max-w-lg mx-auto border border-slate-200 shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#0B132B]">
              No Vacancies Found in {selectedCity}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We did not find active vacancies matching your selected location or filters. New vacancies are
              uploaded and broadcast to Telegram daily.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedCity('All');
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedExperience('All');
                  setClosingSoonOnly(false);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
              >
                Show All Ethiopian Jobs ({publishedVacancies.length})
              </button>
              <a
                href={telegramUrl || 'https://t.me/DreamBigJobsEthiopia'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5 fill-current" />
                <span>Join Telegram Alerts</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVacancies.map((vacancy) => {
              const daysInfo = getDaysLeft(vacancy.applicationDeadline);
              const isUrgent = daysInfo.daysLeft <= 3 && daysInfo.daysLeft >= 0;
              const isSaved = savedJobIds.has(vacancy.id);

              return (
                <div
                  key={vacancy.id}
                  onClick={() => onSelectVacancy(vacancy)}
                  className="bg-white rounded-2xl p-5 border border-slate-200/90 hover:border-amber-400 hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between group relative"
                >
                  {/* Top Bar: Sector & Save Button */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 line-clamp-1">
                        {vacancy.category}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSaveJob(vacancy.id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSaved
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                          }`}
                          title={isSaved ? 'Remove from Saved Jobs' : 'Save Job for Later'}
                        >
                          <Heart className={`w-4 h-4 ${isSaved ? 'fill-current text-rose-500' : ''}`} />
                        </button>

                        <button
                          onClick={(e) => handleQuickShareTelegram(vacancy, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-500 hover:bg-sky-50 transition-colors"
                          title="Share to Telegram"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Job Title & Employer */}
                    <h3 className="font-extrabold text-base text-[#0B132B] group-hover:text-amber-600 transition-colors leading-snug line-clamp-2">
                      {vacancy.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mt-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="line-clamp-1">{vacancy.organization}</span>
                    </div>

                    {/* Meta Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-600 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="line-clamp-1">{vacancy.location}</span>
                      </div>

                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{vacancy.experienceYears || '0-2 Yrs'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500 col-span-2">
                        <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="line-clamp-1 text-emerald-700 font-semibold">
                          {vacancy.salary || 'As per Company Scale'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Deadline & Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div
                      className={`text-[11px] font-bold flex items-center gap-1 ${
                        isUrgent ? 'text-rose-600 animate-pulse' : 'text-slate-500'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{daysInfo.text}</span>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Apply</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
