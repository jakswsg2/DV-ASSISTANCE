/**
 * Navigation Icon Resolver
 * DV-Assistance Platform - Phase 1 Step 6
 *
 * Resolves standard Lucide icons for navigation items.
 */

import React from 'react';
import {
  ShieldAlert,
  FileText,
  HeartHandshake,
  ShieldCheck,
  MessageSquare,
  FolderLock,
  Users,
  ClipboardCheck,
  Scale,
  Stethoscope,
  Settings,
  KeyRound,
  Sliders,
  ScrollText,
  HelpCircle,
} from 'lucide-react';

interface NavIconProps {
  readonly iconName: string;
  readonly className?: string;
}

export const NavIcon: React.FC<NavIconProps> = ({ iconName, className = 'w-4 h-4' }) => {
  switch (iconName) {
    case 'ShieldAlert':
      return <ShieldAlert className={className} aria-hidden="true" />;
    case 'FileText':
      return <FileText className={className} aria-hidden="true" />;
    case 'HeartHandshake':
      return <HeartHandshake className={className} aria-hidden="true" />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'MessageSquare':
      return <MessageSquare className={className} aria-hidden="true" />;
    case 'FolderLock':
      return <FolderLock className={className} aria-hidden="true" />;
    case 'Users':
      return <Users className={className} aria-hidden="true" />;
    case 'ClipboardCheck':
      return <ClipboardCheck className={className} aria-hidden="true" />;
    case 'Scale':
      return <Scale className={className} aria-hidden="true" />;
    case 'Stethoscope':
      return <Stethoscope className={className} aria-hidden="true" />;
    case 'Settings':
      return <Settings className={className} aria-hidden="true" />;
    case 'KeyRound':
      return <KeyRound className={className} aria-hidden="true" />;
    case 'Sliders':
      return <Sliders className={className} aria-hidden="true" />;
    case 'ScrollText':
      return <ScrollText className={className} aria-hidden="true" />;
    default:
      return <HelpCircle className={className} aria-hidden="true" />;
  }
};

export default NavIcon;
