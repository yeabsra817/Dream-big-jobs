import React, { useState } from 'react';
import { ETHIOPIAN_TRUSTED_COMPANIES, EthiopianCompanyItem } from '../data/trustedCompanies';

interface Props {
  onSelectCompany: (company: EthiopianCompanyItem) => void;
}

const LogoCard: React.FC<{
  company: EthiopianCompanyItem;
  onSelect: (company: EthiopianCompanyItem) => void;
}> = ({ company, onSelect }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(company)}
      title={`Explore jobs at ${company.name}`}
      aria-label={`Explore jobs at ${company.name}`}
      className="group/logo shrink-0 flex items-center justify-center h-16 sm:h-[72px] w-36 sm:w-44 px-4 py-2.5 rounded-xl bg-white border border-slate-200/70 hover:border-[#16A34A]/50 hover:shadow-sm transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]"
    >
      {!imgFailed ? (
        <img
          src={company.logoUrl}
          alt={company.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="max-h-full max-w-full w-auto h-auto object-contain grayscale-[15%] group-hover/logo:grayscale-0 transition-all duration-200"
        />
      ) : (
        <span className="text-xs font-bold text-[#0B132B] text-center truncate">
          {company.shortName}
        </span>
      )}
    </button>
  );
};

export const TrustedCompaniesCarousel: React.FC<Props> = ({ onSelectCompany }) => {
  const duplicatedList = [...ETHIOPIAN_TRUSTED_COMPANIES, ...ETHIOPIAN_TRUSTED_COMPANIES];

  return (
    <section
      aria-label="Trusted By Ethiopian Companies"
      className="bg-white py-9 sm:py-11 border-t border-slate-100"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-7">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#0B132B]">
            Trusted By
          </h2>
        </div>
      </div>

      <div className="trusted-marquee-group relative max-w-7xl mx-auto overflow-hidden px-2">
        {/* Subtle edge fade masks */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-20 bg-gradient-to-r from-white to-transparent z-10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-20 bg-gradient-to-l from-white to-transparent z-10"
        />

        <div className="trusted-marquee-track items-center gap-4 sm:gap-6 py-1">
          {duplicatedList.map((company, index) => (
            <LogoCard
              key={`${company.id}-${index}`}
              company={company}
              onSelect={onSelectCompany}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
