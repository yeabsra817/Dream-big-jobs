import React, { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';

interface Props {
  logoUrl?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'green' | 'amber';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-7 h-7 rounded-lg',
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-2xl',
  xl: 'w-16 h-16 rounded-2xl',
};

const ICON_CLASSES: Record<NonNullable<Props['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export const AppBrandLogo: React.FC<Props> = ({
  logoUrl,
  alt = 'HopelandJobs Logo',
  size = 'md',
  variant = 'green',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

  const cleanUrl = typeof logoUrl === 'string' ? logoUrl.trim() : '';
  const sizeCls = SIZE_CLASSES[size];
  const iconCls = ICON_CLASSES[size];

  if (cleanUrl && !imgError) {
    return (
      <div
        className={`${sizeCls} overflow-hidden bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-xs ${className}`}
      >
        <img
          src={cleanUrl}
          alt={alt}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const bgCls =
    variant === 'amber'
      ? 'bg-amber-400 text-slate-950'
      : 'bg-[#16A34A] text-white group-hover:bg-[#15803D] transition-colors';

  return (
    <div
      className={`${sizeCls} ${bgCls} flex items-center justify-center shrink-0 shadow-xs ${className}`}
    >
      <Briefcase className={iconCls} />
    </div>
  );
};
