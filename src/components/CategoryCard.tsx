import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CategoryMeta } from '../types/job';
import { CategoryIcon } from './CategoryIcon';

interface Props {
  category: CategoryMeta;
  activeCount: number;
  onSelect: (categoryName: string) => void;
  language: 'en' | 'am';
}

export const CategoryCard: React.FC<Props> = ({
  category,
  activeCount,
  onSelect,
  language,
}) => {
  return (
    <div
      onClick={() => onSelect(category.name)}
      className="group relative bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer flex flex-col justify-between overflow-hidden"
    >
      {/* Decorative top accent colored line */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 transition-all duration-300 group-hover:h-2"
        style={{ backgroundColor: category.color }}
      />

      <div>
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Category Icon */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              backgroundColor: category.bgLight,
              color: category.color,
            }}
          >
            <CategoryIcon iconName={category.iconName} className="w-7 h-7" />
          </div>

          {/* Active vacancy count badge */}
          <div className="text-right">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                activeCount > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300/60'
                  : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}
            >
              {activeCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
              {activeCount} {activeCount === 1 ? 'Vacancy' : 'Vacancies'}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-[#0B132B] group-hover:text-amber-600 transition-colors line-clamp-1">
          {category.name}
        </h3>
        <p className="text-xs font-semibold text-slate-400 mb-2">
          {category.amharicName}
        </p>

        {/* Description */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
          {category.description}
        </p>

        {/* Key Ethiopian employers tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {category.featuredEmployers.slice(0, 2).map((emp, i) => (
            <span
              key={i}
              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200/80"
            >
              {emp}
            </span>
          ))}
        </div>
      </div>

      {/* Button */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 group-hover:text-amber-600 transition-colors flex items-center gap-1">
          View Vacancies
        </span>
        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 group-hover:bg-amber-400 group-hover:text-slate-950 flex items-center justify-center transition-all group-hover:translate-x-1 shadow-sm">
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
