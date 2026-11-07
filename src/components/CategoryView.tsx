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
  ChevronRight,
  ShieldCheck,
  Coins,
  GraduationCap,
  Heart,
} from 'lucide-react';
import { Vacancy, CategoryMeta, ETHIOPIAN_LOCATIONS } from '../types/job';
import { CategoryIcon } from './CategoryIcon';
import { getDaysLeft, isExpired } from '../utils/helpers';

interface Props {
  category: CategoryMeta;
  vacancies: Vacancy[];
  onBack: () => void;
  onSelectVacancy: (vacancy: Vacancy) => void;
  savedJobIds?: Set<string>;
  onToggleSaveJob?: (id: string) => void;
  onSelectLocation?: (city: string) => void;
  telegramUrl: string;
}

export const CategoryView: React.FC<Props> = ({
  category,
  vacancies,
  onBack,
  onSelectVacancy,
  savedJobIds = new Set(),
  onToggleSaveJob,
  onSelectLocation,
  telegramUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [sortBy, setSortBy] = useState<'latest' | 'deadline'>('latest');

  // Filter only published and active vacancies for this category
  const categoryVacancies = useMemo(() => {
    return vacancies.filter(
      (v) => v.category === category.name && v.status === 'published' && !isExpired(v.applicationDeadline)
    );
  }, [vacancies, category.name]);

  // Apply search and filters
  const filteredVacancies = useMemo(() => {
    return categoryVacancies
      .filter((v) => {
        const matchesSearch =
          !searchQuery.trim() ||
          v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (v.requiredSkills && v.requiredSkills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())));

        const matchesLocation =
          selectedLocation === 'All' ||
          v.location.toLowerCase().includes(selectedLocation.toLowerCase());

        const matchesType =
          selectedType === 'All' ||
          v.employmentType.toLowerCase().includes(selectedType.toLowerCase());

        return matchesSearch && matchesLocation && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          const tA = Date.parse(a.applicationDeadline) || Infinity;
          const tB = Date.parse(b.applicationDeadline) || Infinity;
          return tA - tB;
        }
        // Default latest
        const dateA = new Date(a.publishedAt || a.createdAt).getTime();
        const dateB = new Date(b.publishedAt || b.createdAt).getTime();
        return dateB - dateA;
      });
  }, [categoryVacancies, searchQuery, selectedLocation, selectedType, sortBy]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-20">
      {/* Category Banner */}
      <div className="bg-[#0B132B] text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto">
          {/* Back button */}
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-amber-400 font-semibold text-xs mb-6 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to All Job Categories</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                style={{ backgroundColor: category.bgLight, color: category.color }}
              >
                <CategoryIcon iconName={category.iconName} className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Ethiopia Job Sector
                  </span>
                  <span className="text-xs text-slate-400">{category.amharicName}</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {category.name}
                </h1>
                <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {category.description}
                </p>
              </div>
            </div>

            {/* Active vacancies counter badge */}
            <div className="bg-slate-800/80 backdrop-blur rounded-xl p-4 border border-slate-700 text-center shrink-0">
              <div className="text-2xl sm:text-3xl font-black text-amber-400">
                {categoryVacancies.length}
              </div>
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Active Vacancies
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search job title, organization, or skills..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm outline-none"
              />
            </div>

            {/* Location filter */}
            <div className="md:col-span-3">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm outline-none bg-white font-medium text-slate-700"
              >
                <option value="All">All Ethiopian Locations</option>
                {ETHIOPIAN_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Employment Type */}
            <div className="md:col-span-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm outline-none bg-white font-medium text-slate-700"
              >
                <option value="All">All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Contract">Contract</option>
                <option value="Permanent">Permanent</option>
                <option value="Internship">Internship</option>
                <option value="Remote">Remote</option>
              </select>
            </div>

            {/* Sort */}
            <div className="md:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-sm outline-none bg-white font-medium text-slate-700"
              >
                <option value="latest">Sort: Latest</option>
                <option value="deadline">Sort: Deadline</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Vacancy Listings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-600">
            Showing <strong className="text-slate-900">{filteredVacancies.length}</strong> of{' '}
            {categoryVacancies.length} verified vacancies
          </p>
          <a
            href={telegramUrl || 'https://t.me/DreamBigJobsEthiopia'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#229ED9] hover:underline cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Join Telegram Channel for Alerts</span>
          </a>
        </div>

        {filteredVacancies.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {categoryVacancies.length === 0
                ? `No published vacancies in ${category.name} yet`
                : 'No vacancies matching your filter criteria'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              {categoryVacancies.length === 0
                ? 'The administrator verifies and posts all vacancies personally. New genuine vacancies in this sector will appear as soon as they are approved.'
                : 'Try clearing your search terms or selecting "All Locations" to see all available vacancies.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {categoryVacancies.length > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedLocation('All');
                    setSelectedType('All');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors"
                >
                  Clear Filters
                </button>
              )}
              <a
                href={telegramUrl || 'https://t.me/DreamBigJobsEthiopia'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Join Our Telegram Channel @DreamBigJobsEthiopia"
                className="px-4 py-2 rounded-xl bg-[#229ED9] text-white font-semibold text-xs hover:bg-[#1E88E5] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Join Dream Big Jobs on Telegram</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredVacancies.map((vacancy) => {
              const daysInfo = getDaysLeft(vacancy.applicationDeadline);

              return (
                <div
                  key={vacancy.id}
                  onClick={() => onSelectVacancy(vacancy)}
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-lg transition-all duration-200 hover:border-amber-400 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6 group"
                >
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                        <Building className="w-3.5 h-3.5 text-slate-500" />
                        {vacancy.organization}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectLocation) {
                            onSelectLocation(vacancy.location);
                          } else {
                            setSelectedLocation(vacancy.location);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-amber-100 hover:text-amber-900 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                        title="Click to view all jobs in this location"
                      >
                        <MapPin className="w-3 h-3 text-amber-500" />
                        <span>{vacancy.location}</span>
                      </button>

                      <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {vacancy.employmentType}
                      </span>

                      {vacancy.referenceNumber && vacancy.referenceNumber !== 'Not specified in the original vacancy' && (
                        <span className="text-[11px] font-mono font-medium text-slate-400">
                          Ref: {vacancy.referenceNumber}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg sm:text-xl font-bold text-[#0B132B] group-hover:text-amber-600 transition-colors">
                      {vacancy.title}
                    </h2>

                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                      {vacancy.description}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                      {vacancy.salary && vacancy.salary !== 'Not specified in the original vacancy' && (
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                          <Coins className="w-3.5 h-3.5" />
                          {vacancy.salary}
                        </span>
                      )}

                      {vacancy.experienceYears && vacancy.experienceYears !== 'Not specified in the original vacancy' && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {vacancy.experienceYears}
                        </span>
                      )}

                      {vacancy.educationQualification && vacancy.educationQualification !== 'Not specified in the original vacancy' && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                          {vacancy.educationQualification}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Deadline & CTA */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                    <div
                      className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full ${
                        daysInfo.urgent
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-50 text-amber-900 border border-amber-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{daysInfo.text}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onToggleSaveJob && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSaveJob(vacancy.id);
                          }}
                          className={`p-2 rounded-xl transition-all border ${
                            savedJobIds.has(vacancy.id)
                              ? 'bg-rose-50 text-rose-600 border-rose-200'
                              : 'bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-slate-100 border-slate-200'
                          }`}
                          title={savedJobIds.has(vacancy.id) ? 'Remove from Saved Jobs' : 'Save Job for Later'}
                        >
                          <Heart className={`w-4 h-4 ${savedJobIds.has(vacancy.id) ? 'fill-current text-rose-500' : ''}`} />
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectVacancy(vacancy);
                        }}
                        className="inline-flex items-center gap-2 bg-[#0B132B] group-hover:bg-amber-500 group-hover:text-slate-950 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
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
