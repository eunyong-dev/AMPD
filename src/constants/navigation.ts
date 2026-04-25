/**
 * 네비게이션 관련 상수 정의
 */

import {
  BarChartIcon,
  BuildingIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  TargetIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react';
import { NavItem, NavDocument, NavUser } from '@/types';

export const NAVIGATION_DATA = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  } as NavUser,

  navMain: [
    {
      title: 'Accounts',
      url: '/accounts',
      icon: BuildingIcon,
    },
  ] as NavItem[],

  navCampaigns: [
    {
      title: 'All Campaigns',
      url: '/campaigns',
      icon: ClipboardListIcon,
    },
    {
      title: 'My Campaigns',
      url: '/campaigns/my',
      icon: UserIcon,
    },
  ] as NavItem[],

  navAdmin: [
    {
      title: 'Permissions',
      url: '/permissions',
      icon: ShieldIcon,
      adminOnly: true,
    },
  ] as NavItem[],

  navClouds: [
    {
      title: 'Capture',
      icon: CameraIcon,
      isActive: true,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Proposal',
      icon: FileTextIcon,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
    {
      title: 'Prompts',
      icon: FileCodeIcon,
      url: '#',
      items: [
        {
          title: 'Active Proposals',
          url: '#',
        },
        {
          title: 'Archived',
          url: '#',
        },
      ],
    },
  ] as NavItem[],

  navSecondary: [] as NavItem[],

  documents: [] as NavDocument[],
};
