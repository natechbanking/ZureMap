import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowPointer,
  faArrowUp,
  faArrowsUpDownLeftRight,
  faBullseye,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircle,
  faCircleInfo,
  faCopy,
  faCrosshairs,
  faDiamond,
  faEraser,
  faHand,
  faLayerGroup,
  faLink,
  faMagnifyingGlass,
  faMap,
  faMinus,
  faNoteSticky,
  faPaintbrush,
  faPaste,
  faPenNib,
  faPenToSquare,
  faPlus,
  faRotate,
  faRotateLeft,
  faT,
  faTags,
  faTrash,
  faUpRightFromSquare,
  faVectorSquare,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

export type ActionIconName =
  | 'arrowRight'
  | 'bringFront'
  | 'brush'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'clear'
  | 'close'
  | 'copy'
  | 'crosshair'
  | 'delete'
  | 'detach'
  | 'diamond'
  | 'duplicate'
  | 'edit'
  | 'ellipse'
  | 'eraser'
  | 'focus'
  | 'hand'
  | 'info'
  | 'layers'
  | 'layout'
  | 'line'
  | 'link'
  | 'map'
  | 'moveDown'
  | 'moveUp'
  | 'paste'
  | 'penNib'
  | 'plus'
  | 'pointer'
  | 'rectangle'
  | 'reset'
  | 'rotate'
  | 'search'
  | 'sendBack'
  | 'sticky'
  | 'tags'
  | 'text'
  | 'undo';

export const ACTION_ICONS: Record<ActionIconName, IconDefinition> = {
  arrowRight: faArrowRight,
  bringFront: faArrowUp,
  brush: faPaintbrush,
  check: faCheck,
  chevronLeft: faChevronLeft,
  chevronRight: faChevronRight,
  clear: faXmark,
  close: faXmark,
  copy: faCopy,
  crosshair: faCrosshairs,
  delete: faTrash,
  detach: faUpRightFromSquare,
  diamond: faDiamond,
  duplicate: faCopy,
  edit: faPenToSquare,
  ellipse: faCircle,
  eraser: faEraser,
  focus: faBullseye,
  hand: faHand,
  info: faCircleInfo,
  layers: faLayerGroup,
  layout: faArrowsUpDownLeftRight,
  line: faMinus,
  link: faLink,
  map: faMap,
  moveDown: faChevronDown,
  moveUp: faChevronUp,
  paste: faPaste,
  penNib: faPenNib,
  plus: faPlus,
  pointer: faArrowPointer,
  rectangle: faVectorSquare,
  reset: faArrowLeft,
  rotate: faRotate,
  search: faMagnifyingGlass,
  sendBack: faArrowDown,
  sticky: faNoteSticky,
  tags: faTags,
  text: faT,
  undo: faRotateLeft,
};
