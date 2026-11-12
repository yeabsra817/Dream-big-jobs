import React, { useState } from 'react';
import {
  Briefcase,
  Search,
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Building,
  TrendingUp,
} from 'lucide-react';
import { CategoryMeta, OFFICIAL_CATEGORIES, Vacancy } from '../types/job';
import { CategoryCard } from './CategoryCard';

interface Props {
  vacancies: Vacancy[];
  onSelectCategory: (category: CategoryMeta) => void;
  onBack: () => void;
  language?: 'en' | 'am';
  categories?: CategoryMeta[];
}

export const AllCategoriesView: React.FC<Props> = ({
  vacancies,
  onSelectCategory,
  onBack,
  language = 'en',
  categories = OFFICIAL_CATEGORIES,
}) => {
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(false);

  // Compute actual published count map
  const activeCountMap = React.useMemo(() => {
    const map = new Map<string, number>();
    vacancies.forEach((v) => {
      if (v.status === 'published') {
        map.set(v.category, (map.get(v.category) || 0) + 1);
      }
    });
    return map;
  }, [vacancies]);

  const filteredCategories = React.useMemo(() => {
    return OFFICIAL_CATEGORIES.filter((cat) => {
      const count = activeCountMap.get(cat.name) || 0;
      if (hideZero && count === 0) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        cat.name.toLowerCase().includes(q) ||
        cat.amharicName.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q)
      );
    });
  }, [activeCountMap, search, hideZero]);

  const totalPublished = React.useMemo(() => {
    return vacancies.filter((v) => v.status === 'published').length;
  }, [vacancies]);

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24">
      {/* Header Banner */}
      <div className="bg-[#0B132B] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        <div className="max-w-7xl mx-auto space-y-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-300 hover:text-amber-400 font-bold text-xs transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Homepage</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 mb-2">
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>All Professional Sectors</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Official Ethiopian Job Categories
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl mt-1.5 leading-relaxed">
                Explore all verified career sectors in Ethiopia. Vacancy counts reflect actual active opportunities currently published in our verified database.
              </p>
            </div>

            {/* Quick Filter Bar */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-semibold cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span>Active vacancies only</span>
              </label>

              <div className="text-right">
                <span className="text-[11px] font-bold text-slate-400 block">Total Active Vacancies</span>
                <span className="text-xl font-black text-amber-400 font-mono">{totalPublished}</span>
              </div>
            </div>
          </div>

          {/* Search bar within categories */}
          <div className="pt-4 max-w-xl">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search category by keyword, banking, NGO, IT, medical..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-400 focus:border-amber-400 outline-none font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredCategories.map((category) => {
            const count = activeCountMap.get(category.name) || 0;
            return (
              <CategoryCard
                key={category.id}
                category={category}
                activeCount={count}
                onSelect={() => onSelectCategory(category)}
                language={language}
              />
            );
          })}
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No matching categories found</h3>
            <p className="text-xs text-slate-500">Try modifying your search term or unchecking the active vacancies filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
