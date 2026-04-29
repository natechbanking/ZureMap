import {
  Component, Input, Output, EventEmitter, HostListener,
  ChangeDetectionStrategy, ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramNode } from '../../core/models/diagram-node.model';

const MINI_W = 200;
const MINI_H = 130;

const GROUP_FILL: Record<string, string> = {
  resourceGroup: 'rgba(16,185,129,0.08)',
  vnet: 'rgba(99,102,241,0.08)',
  subnet: 'rgba(139,92,246,0.06)',
};
const GROUP_STROKE: Record<string, string> = {
  resourceGroup: '#10b981',
  vnet: '#6366f1',
  subnet: '#8b5cf6',
};

interface PanEvent { scrollLeft: number; scrollTop: number; }

@Component({
  selector: 'app-minimap',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div
        class="absolute z-[130] select-none"
        [style.bottom.px]="60"
        [style.right.px]="right"
      >
        <div class="rounded-xl border border-gray-200 bg-white/95 backdrop-blur shadow-lg overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100">
            <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Minimap</span>
            <span class="text-[10px] text-gray-400">{{ nodes.length }} node{{ nodes.length === 1 ? '' : 's' }}</span>
          </div>

          <!-- SVG minimap -->
          <svg
            #svgEl
            [attr.width]="MINI_W"
            [attr.height]="MINI_H"
            class="block cursor-crosshair"
            style="background: #faf9f8;"
            (mousedown)="onMinimapMouseDown($event)"
          >
            <defs>
              <pattern id="mini-dots" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.5" fill="#d2d0ce" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mini-dots)" />

            @for (r of groupRects; track r.id) {
              <rect
                [attr.x]="r.x" [attr.y]="r.y"
                [attr.width]="r.w" [attr.height]="r.h"
                [attr.fill]="r.fill" [attr.stroke]="r.stroke"
                stroke-width="0.5" rx="1"
              />
            }

            @for (n of nodeRects; track n.id) {
              <rect
                [attr.x]="n.x" [attr.y]="n.y"
                [attr.width]="n.w" [attr.height]="n.h"
                [attr.fill]="n.fill" rx="1"
              />
            }

            @if (viewport) {
              <rect
                [attr.x]="viewport.x" [attr.y]="viewport.y"
                [attr.width]="viewport.w" [attr.height]="viewport.h"
                fill="rgba(59,130,246,0.08)" stroke="#3b82f6"
                stroke-width="1" rx="2" class="pointer-events-none"
              />
            }
          </svg>
        </div>
      </div>
    }
  `,
})
export class MinimapComponent {
  @Input({ required: true }) nodes: DiagramNode[] = [];
  @Input({ required: true }) canvasWidth!: number;
  @Input({ required: true }) canvasHeight!: number;
  @Input({ required: true }) scrollLeft!: number;
  @Input({ required: true }) scrollTop!: number;
  @Input({ required: true }) zoomLevel!: number;
  @Input({ required: true }) viewportWidth!: number;
  @Input({ required: true }) viewportHeight!: number;
  @Input({ required: true }) right!: number;
  @Input() visible = false;

  @Output() panTo = new EventEmitter<PanEvent>();

  @ViewChild('svgEl') svgEl!: ElementRef<SVGSVGElement>;

  readonly MINI_W = MINI_W;
  readonly MINI_H = MINI_H;

  private dragging = false;

  private get scale(): number {
    const sx = MINI_W / Math.max(this.canvasWidth, 1);
    const sy = MINI_H / Math.max(this.canvasHeight, 1);
    return Math.min(sx, sy);
  }

  private get offsetX(): number {
    return (MINI_W - this.canvasWidth * this.scale) / 2;
  }

  private get offsetY(): number {
    return (MINI_H - this.canvasHeight * this.scale) / 2;
  }

  private wx(canvasX: number): number { return this.offsetX + canvasX * this.scale; }
  private wy(canvasY: number): number { return this.offsetY + canvasY * this.scale; }
  private ws(size: number): number { return Math.max(2, size * this.scale); }

  get groupRects(): { id: string; x: number; y: number; w: number; h: number; fill: string; stroke: string }[] {
    // Single pass: bucket nodes by group key
    const groups = new Map<string, DiagramNode[]>();
    for (const n of this.nodes) {
      if (n.group === 'standalone') continue;
      const key = `${n.group}::${n.groupId}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(n);
      else groups.set(key, [n]);
    }

    // One pass per bucket to compute bounding box
    const out: { id: string; x: number; y: number; w: number; h: number; fill: string; stroke: string }[] = [];
    for (const [key, peers] of groups) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of peers) {
        minX = Math.min(minX, p.position.x - 12);
        minY = Math.min(minY, p.position.y - 28);
        maxX = Math.max(maxX, p.position.x + p.size.width + 12);
        maxY = Math.max(maxY, p.position.y + p.size.height + 12);
      }
      const group = peers[0].group;
      out.push({
        id: key,
        x: this.wx(minX), y: this.wy(minY),
        w: this.ws(maxX - minX), h: this.ws(maxY - minY),
        fill: GROUP_FILL[group] ?? 'rgba(107,114,128,0.06)',
        stroke: GROUP_STROKE[group] ?? '#9ca3af',
      });
    }
    return out;
  }

  get nodeRects(): { id: string; x: number; y: number; w: number; h: number; fill: string }[] {
    return this.nodes.map(n => ({
      id: n.id,
      x: this.wx(n.position.x), y: this.wy(n.position.y),
      w: this.ws(n.size.width), h: this.ws(n.size.height),
      fill: this.nodeColor(n),
    }));
  }

  get viewport(): { x: number; y: number; w: number; h: number } | null {
    if (!this.zoomLevel) return null;
    return {
      x: this.wx(this.scrollLeft / this.zoomLevel),
      y: this.wy(this.scrollTop / this.zoomLevel),
      w: Math.max(4, (this.viewportWidth / this.zoomLevel) * this.scale),
      h: Math.max(4, (this.viewportHeight / this.zoomLevel) * this.scale),
    };
  }

  private nodeColor(n: DiagramNode): string {
    if (n.status === 'failed') return '#ef4444';
    if (n.status === 'stopped') return '#9ca3af';
    const colors: Record<string, string> = {
      resourceGroup: '#34d399', vnet: '#818cf8', subnet: '#a78bfa', standalone: '#60a5fa',
    };
    return colors[n.group] ?? '#60a5fa';
  }

  onMinimapMouseDown(e: MouseEvent): void {
    e.preventDefault();
    this.dragging = true;
    this.panFromMinimap(e);
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(e: MouseEvent): void {
    if (this.dragging) this.panFromMinimap(e);
  }

  @HostListener('document:mouseup')
  onDocMouseUp(): void { this.dragging = false; }

  private panFromMinimap(e: MouseEvent): void {
    const svg = this.svgEl?.nativeElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = Math.max(0, Math.min(MINI_W, e.clientX - rect.left));
    const my = Math.max(0, Math.min(MINI_H, e.clientY - rect.top));
    const worldX = (mx - this.offsetX) / this.scale;
    const worldY = (my - this.offsetY) / this.scale;
    this.panTo.emit({
      scrollLeft: Math.max(0, worldX * this.zoomLevel - this.viewportWidth / 2),
      scrollTop: Math.max(0, worldY * this.zoomLevel - this.viewportHeight / 2),
    });
  }
}
