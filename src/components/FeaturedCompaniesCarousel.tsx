import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MapPin, ArrowRight, Building2 } from 'lucide-react';
import { ETHIOPIAN_TRUSTED_COMPANIES, EthiopianCompanyItem } from '../data/trustedCompanies';
import { Vacancy } from '../types/job';

interface Props {
  vacancies: Vacancy[];
  onSelectCompany: (company: EthiopianCompanyItem) => void;
  onViewAllCompanies: () => void;
}

export const FeaturedCompaniesCarousel: React.FC<Props> = ({
  vacancies,
  onSelectCompany,
  onViewAllCompanies,
}) => {
  const featuredList = useMemo(
    () => ETHIOPIAN_TRUSTED_COMPANIES.filter((c) => c.featured !== false),
    []
  );

  const [cardsPerView, setCardsPerView] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updateCards = () => {
      if (window.innerWidth < 640) setCardsPerView(1);
      else if (window.innerWidth < 1024) setCardsPerView(2);
      else setCardsPerView(3);
    };
    window.addEventListener('resize', updateCards);
    return () => window.removeEventListener('resize', updateCards);
  }, []);

  const maxStartIndex = Math.max(0, featuredList.length - cardsPerView);
  const safeIndex = Math.min(activeIndex, maxStartIndex);

  const pageCount = Math.max(1, Math.ceil(featuredList.length / cardsPerView));
  const currentPage = Math.min(pageCount - 1, Math.floor(safeIndex / cardsPerView));

  const handlePrev = () => {
    setActiveIndex((prev) => (prev <= 0 ? maxStartIndex : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev >= maxStartIndex ? 0 : prev + 1));
  };

  // Subtle auto-advance with hover pause
  const [isPaused, setIsPaused] = useState(false);
  useEffect(() => {
    if (isPaused || maxStartIndex <= 0) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev >= maxStartIndex ? 0 : prev + 1));
    }, 5500);
    return () => clearInterval(timer);
  }, [isPaused, maxStartIndex]);

  // Count active vacancies matching each featured organization or category
  const getCompanyOpenCount = (company: EthiopianCompanyItem) => {
    const lowerName = company.name.toLowerCase();
    const shortLower = company.shortName.toLowerCase();
    const directMatches = vacancies.filter((v) => {
      const org = (v.organization || '').toLowerCase();
      return org.includes(lowerName) || (shortLower.length >= 3 && org.includes(shortLower));
    }).length;
    if (directMatches > 0) return directMatches;
    return vacancies.filter((v) => v.category === company.categoryName).length;
  };

  return (
    <section
      aria-label="Featured Companies"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="bg-gradient-to-br from-[#1E40AF] via-[#1D4ED8] to-[#0F3D8A] text-white py-14 sm:py-16 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Featured Companies
            </h2>
            <p className="text-sm text-blue-100 mt-1.5 max-w-xl">
              Explore verified vacancies from leading banks, airlines, telecom, insurance, and UN organizations in Ethiopia.
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-end gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous featured companies"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 flex items-center justify-center text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next featured companies"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 flex items-center justify-center text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onViewAllCompanies}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-emerald-200 underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>All Featured Companies</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Carousel Track */}
        <div className="overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] -mx-2.5"
            style={{
              transform: `translate3d(-${(safeIndex * 100) / featuredList.length}%, 0, 0)`,
              width: `${(featuredList.length * 100) / cardsPerView}%`,
            }}
          >
            {featuredList.map((company) => {
              const openCount = getCompanyOpenCount(company);
              const logoFailed = failedLogos[company.id];
              return (
                <div
                  key={company.id}
                  className="px-2.5 shrink-0"
                  style={{ width: `${100 / featuredList.length}%` }}
                >
                  <div className="h-full bg-white text-[#0B132B] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200/80 p-2 flex items-center justify-center shrink-0">
                          {!logoFailed ? (
                            <img
                              src={company.logoUrl}
                              alt={company.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedLogos((prev) => ({ ...prev, [company.id]: true }))
                              }
                              className="max-h-full max-w-full w-auto h-auto object-contain"
                            />
                          ) : (
                            <Building2 className="w-7 h-7 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#0B132B] truncate">
                            {company.name}
                          </h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">
                            {company.sector}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                            <MapPin className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                            <span className="truncate">{company.location}</span>
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                        {company.summary}
                      </p>
                    </div>

                    <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600 tabular-nums">
                        {openCount > 0 ? `${openCount} Active Opportunities` : 'Verified Employer'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectCompany(company)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#16A34A] hover:text-[#15803D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>View Jobs</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation Indicators */}
        <div className="flex items-center justify-center gap-2 mt-7" role="tablist" aria-label="Featured company slides">
          {Array.from({ length: pageCount }).map((_, idx) => {
            const targetStart = Math.min(maxStartIndex, idx * cardsPerView);
            const isActive = idx === currentPage;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Show slide ${idx + 1}`}
                onClick={() => setActiveIndex(targetStart)}
                className={`h-2 rounded-full transition-all duration-200 cursor-pointer ${
                  isActive ? 'w-8 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};
