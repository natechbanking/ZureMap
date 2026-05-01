import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowDown,
  faArrowLeft,
  faArrowUp,
  faArrowsUpDownLeftRight,
  faBullseye,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCopy,
  faCrosshairs,
  faLink,
  faMagnifyingGlass,
  faPaste,
  faPenToSquare,
  faPlus,
  faRotateLeft,
  faTrash,
  faTags,
  faUpRightFromSquare,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

export type ActionIconName =
  | 'copy'
  | 'paste'
  | 'focus'
  | 'link'
  | 'detach'
  | 'reset'
  | 'delete'
  | 'layout'
  | 'undo'
  | 'search'
  | 'crosshair'
  | 'plus'
  | 'duplicate'
  | 'bringFront'
  | 'sendBack'
  | 'clear'
  | 'edit'
  | 'close'
  | 'moveUp'
  | 'moveDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'tags';

export const ACTION_ICONS: Record<ActionIconName, IconDefinition> = {
  copy: faCopy,
  paste: faPaste,
  focus: faBullseye,
  link: faLink,
  detach: faUpRightFromSquare,
  reset: faArrowLeft,
  delete: faTrash,
  layout: faArrowsUpDownLeftRight,
  undo: faRotateLeft,
  search: faMagnifyingGlass,
  crosshair: faCrosshairs,
  plus: faPlus,
  duplicate: faCopy,
  bringFront: faArrowUp,
  sendBack: faArrowDown,
  clear: faXmark,
  edit: faPenToSquare,
  close: faXmark,
  moveUp: faChevronUp,
  moveDown: faChevronDown,
  chevronLeft: faChevronLeft,
  chevronRight: faChevronRight,
  tags: faTags,
};
