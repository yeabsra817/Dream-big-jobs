import React from 'react';
import {
  Landmark,
  Coins,
  Building2,
  Globe2,
  UtensilsCrossed,
  Compass,
  Scale,
  Briefcase,
  ShieldCheck,
  GraduationCap,
  HeartPulse,
  CodeXml,
  HardHat,
  ReceiptText,
  Sparkles,
  Laptop,
  HelpCircle,
} from 'lucide-react';

interface Props {
  iconName: string;
  className?: string;
}

export const CategoryIcon: React.FC<Props> = ({ iconName, className = 'w-6 h-6' }) => {
  switch (iconName) {
    case 'Landmark':
      return <Landmark className={className} />;
    case 'Coins':
      return <Coins className={className} />;
    case 'Building2':
      return <Building2 className={className} />;
    case 'Globe2':
      return <Globe2 className={className} />;
    case 'UtensilsCrossed':
      return <UtensilsCrossed className={className} />;
    case 'Compass':
      return <Compass className={className} />;
    case 'Scale':
      return <Scale className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'GraduationCap':
      return <GraduationCap className={className} />;
    case 'HeartPulse':
      return <HeartPulse className={className} />;
    case 'CodeXml':
      return <CodeXml className={className} />;
    case 'HardHat':
      return <HardHat className={className} />;
    case 'ReceiptText':
      return <ReceiptText className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Laptop':
      return <Laptop className={className} />;
    default:
      return <HelpCircle className={className} />;
  }
};
