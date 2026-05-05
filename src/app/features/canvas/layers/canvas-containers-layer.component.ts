import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DrawingTool } from '../../../core/models/annotation.model';
import { IconRegistryService } from '../../../core/services/icon-registry.service';
import { RgBound, SubscriptionBound, VmBound, RouteTableBound, K8sNamespaceBound, K8sScopeBound, K8sClusterBound, SizeOffset, TagHighlightInfo, TagHighlightResizeDragState, SubscriptionDragState, VmDragState, RgDragState } from '../canvas.types';

const ZERO_OFFSET: SizeOffset = { top: 0, right: 0, bottom: 0, left: 0 };

@Component({
  selector: 'app-canvas-containers-layer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './canvas-containers-layer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasContainersLayerComponent implements AfterViewChecked {
  @ViewChild('renameInput') renameInputRef?: ElementRef;

  @Input() subscriptionBounds: SubscriptionBound[] = [];
  @Input() rgBounds: RgBound[] = [];
  @Input() vmBounds: VmBound[] = [];
  @Input() routeTableBounds: RouteTableBound[] = [];
  @Input() k8sNamespaceBounds: K8sNamespaceBound[] = [];
  @Input() k8sScopeBounds: K8sScopeBound[] = [];
  @Input() k8sClusterBounds: K8sClusterBound[] = [];
  @Input() subTagHighlights!: Map<string, TagHighlightInfo>;
  @Input() rgTagHighlights!: Map<string, TagHighlightInfo>;
  @Input() selectedTagHighlightRuleId: string | null = null;
  @Input() tagHighlightResizeDrag: TagHighlightResizeDragState | null = null;
  @Input() renamingContainer: { type: 'rg' | 'sub' | 'vm' | 'rt' | 'k8sns' | 'k8sscope' | 'k8scluster'; id: string } | null = null;
  @Input() renamingValue = '';
  @Input() activeTool: DrawingTool = 'pointer';
  @Input() subscriptionDragState: SubscriptionDragState | null = null;
  @Input() rgDragState: RgDragState | null = null;
  @Input() vmDragState: VmDragState | null = null;

  @Output() subscriptionMouseDown = new EventEmitter<{ event: MouseEvent; subscriptionId: string }>();
  @Output() rgMouseDown = new EventEmitter<{ event: MouseEvent; rgId: string }>();
  @Output() rgContextMenu = new EventEmitter<{ event: MouseEvent; bound: RgBound }>();
  @Output() vmMouseDown = new EventEmitter<{ event: MouseEvent; vmId: string }>();
  @Output() toggleSubscriptionCollapsed = new EventEmitter<string>();
  @Output() toggleRgCollapsed = new EventEmitter<string>();
  @Output() toggleVmCollapsed = new EventEmitter<string>();
  @Output() toggleRouteTableCollapsed = new EventEmitter<string>();
  @Output() toggleK8sNamespaceCollapsed = new EventEmitter<string>();
  @Output() toggleK8sScopeCollapsed = new EventEmitter<string>();
  @Output() toggleK8sClusterCollapsed = new EventEmitter<string>();
  @Output() k8sNamespaceMouseDown = new EventEmitter<{ event: MouseEvent; nsId: string }>();
  @Output() k8sScopeMouseDown = new EventEmitter<{ event: MouseEvent; scopeId: string }>();
  @Output() k8sClusterMouseDown = new EventEmitter<{ event: MouseEvent; clusterId: string }>();
  @Output() tagHighlightSelected = new EventEmitter<{ ruleId: string; event: Event }>();
  @Output() tagHighlightResizeMouseDown = new EventEmitter<{ event: MouseEvent; ruleId: string; handle: string }>();
  @Output() renameValueChange = new EventEmitter<string>();
  @Output() commitRename = new EventEmitter<void>();
  @Output() cancelRename = new EventEmitter<void>();
  @Output() startRename = new EventEmitter<{ type: 'rg' | 'sub' | 'vm' | 'rt' | 'k8sns' | 'k8sscope' | 'k8scluster'; id: string; name: string }>();

  readonly resizeHandles = [
    { id: 'nw', left: '0%',   top: '0%',   cursor: 'nw-resize' },
    { id: 'n',  left: '50%',  top: '0%',   cursor: 'n-resize'  },
    { id: 'ne', left: '100%', top: '0%',   cursor: 'ne-resize' },
    { id: 'e',  left: '100%', top: '50%',  cursor: 'e-resize'  },
    { id: 'se', left: '100%', top: '100%', cursor: 'se-resize' },
    { id: 's',  left: '50%',  top: '100%', cursor: 's-resize'  },
    { id: 'sw', left: '0%',   top: '100%', cursor: 'sw-resize' },
    { id: 'w',  left: '0%',   top: '50%',  cursor: 'w-resize'  },
  ];

  readonly subscriptionIconUrl = inject(IconRegistryService).getIconUrl('microsoft.resources/subscriptions');
  readonly rgIconUrl = inject(IconRegistryService).getIconUrl('microsoft.resources/resourcegroups');
  readonly k8sIconUrl = inject(IconRegistryService).getIconUrl('kubernetes/cluster');

  get isSubscriptionDragging(): boolean { return this.subscriptionDragState !== null; }
  get isRgDragging(): boolean { return this.rgDragState !== null; }
  get isVmDragging(): boolean { return this.vmDragState !== null; }

  private prevRenamingKey: string | null = null;

  ngAfterViewChecked(): void {
    const key = this.renamingContainer ? `${this.renamingContainer.type}::${this.renamingContainer.id}` : null;
    if (key && key !== this.prevRenamingKey) {
      this.prevRenamingKey = key;
      setTimeout(() => {
        const el = this.renameInputRef?.nativeElement as HTMLInputElement | undefined;
        if (el) { el.focus(); el.select(); }
      }, 0);
    } else if (!key) {
      this.prevRenamingKey = null;
    }
  }

  getEffectiveSizeOffset(hl: TagHighlightInfo | undefined): SizeOffset {
    if (!hl) return ZERO_OFFSET;
    if (this.tagHighlightResizeDrag?.ruleId === hl.ruleId) {
      return this.tagHighlightResizeDrag!.currentOffset;
    }
    return hl.sizeOffset ?? ZERO_OFFSET;
  }

  getHighlightBounds(
    bound: { x: number; y: number; width: number; height: number },
    hl: TagHighlightInfo | undefined,
  ): { x: number; y: number; w: number; h: number } {
    const off = this.getEffectiveSizeOffset(hl);
    return {
      x: bound.x - off.left,
      y: bound.y - off.top,
      w: bound.width + off.left + off.right,
      h: bound.height + off.top + off.bottom,
    };
  }
}
