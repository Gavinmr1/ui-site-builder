import {
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  PhotoIcon,
  CodeBracketIcon,
  ViewfinderCircleIcon,
  FolderOpenIcon,
  DocumentIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

export type IconName = 
  | 'eye'
  | 'eye-off'
  | 'lock'
  | 'unlock'
  | 'trash'
  | 'duplicate'
  | 'check'
  | 'x'
  | 'plus'
  | 'minus'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'menu'
  | 'settings'
  | 'help'
  | 'download'
  | 'upload'
  | 'sparkles'
  | 'edit'
  | 'ellipsis'
  | 'image'
  | 'code'
  | 'preview'
  | 'folder'
  | 'document'
  | 'clipboard';

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const iconMap: Record<IconName, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'eye': EyeIcon,
  'eye-off': EyeSlashIcon,
  'lock': LockClosedIcon,
  'unlock': LockOpenIcon,
  'trash': TrashIcon,
  'duplicate': DocumentDuplicateIcon,
  'check': CheckIcon,
  'x': XMarkIcon,
  'plus': PlusIcon,
  'minus': MinusIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-up': ChevronUpIcon,
  'chevron-left': ChevronLeftIcon,
  'chevron-right': ChevronRightIcon,
  'menu': Bars3Icon,
  'settings': Cog6ToothIcon,
  'help': QuestionMarkCircleIcon,
  'download': ArrowDownTrayIcon,
  'upload': ArrowUpTrayIcon,
  'sparkles': SparklesIcon,
  'edit': PencilIcon,
  'ellipsis': EllipsisVerticalIcon,
  'image': PhotoIcon,
  'code': CodeBracketIcon,
  'preview': ViewfinderCircleIcon,
  'folder': FolderOpenIcon,
  'document': DocumentIcon,
  'clipboard': ClipboardDocumentIcon,
};

export const allIconNames = Object.keys(iconMap) as IconName[];

export function Icon({ name, className = '', size = 20, strokeWidth = 2 }: IconProps) {
  const IconComponent = iconMap[name];
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return null;
  }

  return (
    <IconComponent 
      className={className} 
      width={size} 
      height={size}
      strokeWidth={strokeWidth}
    />
  );
}

// Convenience hook for getting icon names by category
export const LayerIcons = {
  visibility: 'eye' as const,
  hidden: 'eye-off' as const,
  lock: 'lock' as const,
  unlock: 'unlock' as const,
  delete: 'trash' as const,
  duplicate: 'duplicate' as const,
};

export const ToolbarIcons = {
  add: 'plus' as const,
  remove: 'minus' as const,
  settings: 'settings' as const,
  help: 'help' as const,
  download: 'download' as const,
  upload: 'upload' as const,
  menu: 'menu' as const,
};

export const ActionIcons = {
  check: 'check' as const,
  close: 'x' as const,
  edit: 'edit' as const,
  copy: 'duplicate' as const,
  code: 'code' as const,
  preview: 'preview' as const,
};
