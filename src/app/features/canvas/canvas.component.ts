import { Component, inject, effect, ViewChild, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { ExportService } from '../../core/services/export.service';
import { CostService } from '../../core/services/cost.service';
import { DriftService } from '../../core/services/drift.service';
import { ExportService as ExpSvc } from '../../core/services/export.service';
import { DiagramNodeComponent } from './diagram-node/diagram-node.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { DiagramNode } from '../../core/models/diagram-node.model';

const RENDER_BATCH_SIZE = 50;

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, DiagramNodeComponent, SidebarComponent, ToolbarComponent],
  template: `
    <div class="h-screen flex flex-col bg-gray-50 overflow-hidden">

      <app-toolbar
        [nodeCount]="store.nodeCount()"
        [edgeCount]="store.edgeCount()"
        [totalCost]="store.totalMonthlyCost()"
        [finOpsActive]="store.finOpsLayerActive()"
        [comparisonMode]="store.comparisonMode()"
        [driftSummary]="store.driftSummary()"
        (exportSvg)="exportSvg()"
        (exportPng)="exportPng()"
        (exportJson)="exportJson()"
        (toggleFinOps)="toggleFinOps()"
        (rescan)="rescan()"
        (unpinAll)="store.unpinAll()"
        (importJson)="onImportJson($event)"
        (toggleDrift)="toggleDrift()"
      />

      <div class="flex flex-1 overflow-hidden">
        <div
          #canvasHost
          class="flex-1 relative overflow-auto bg-[#faf9f8]"
          style="background-image: radial-gradient(circle, #d2d0ce 1px, transparent 1px); background-size: 24px 24px;"
        >
          <div
            class="relative"
            [style.width.px]="canvasWidth"
            [style.height.px]="canvasHeight"
          >
            @for (node of visibleNodes; track node.id) {
              <div
                class="absolute"
                [style.left.px]="node.position.x"
                [style.top.px]="node.position.y"
                draggable="true"
                (dragstart)="onDragStart($event, node)"
                (dragend)="onDragEnd($event, node)"
              >
                <app-diagram-node
                  [node]="node"
                  [finOpsActive]="store.finOpsLayerActive()"
                  (clicked)="store.selectNode($event)"
                  (pinToggled)="togglePin($event)"
                />
              </div>
            }

            <svg
              class="absolute top-0 left-0 pointer-events-none"
              [attr.width]="canvasWidth"
              [attr.height]="canvasHeight"
            >
              <defs>
                <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#605e5c" />
                </marker>
              </defs>
              @for (edge of store.edges(); track edge.id) {
                <line
                  [attr.x1]="getEdgeX1(edge.sourceId)"
                  [attr.y1]="getEdgeY1(edge.sourceId)"
                  [attr.x2]="getEdgeX2(edge.targetId)"
                  [attr.y2]="getEdgeY2(edge.targetId)"
                  [attr.stroke]="edge.style.strokeColor"
                  [attr.stroke-width]="edge.style.strokeWidth"
                  [attr.stroke-dasharray]="edge.style.dashArray ?? null"
                  [attr.marker-end]="edge.style.markerEnd === 'arrow' ? 'url(#arrow)' : null"
                  [class.animate-pulse]="edge.animated"
                />
              }
            </svg>
          </div>
        </div>

        @if (store.sidebarOpen()) {
          <app-sidebar />
        }
      </div>
    </div>
  `,
})
export class CanvasComponent implements OnInit {
  @ViewChild('canvasHost', { read: ElementRef }) canvasHostRef!: ElementRef;

  store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  private exportSvc = inject(ExportService);
  private costSvc = inject(CostService);
  private driftSvc = inject(DriftService);
  private router = inject(Router);

  visibleNodes: DiagramNode[] = [];
  private renderBatch = 0;

  get canvasWidth(): number {
    const nodes = this.store.nodes();
    return Math.max(1200, ...nodes.map(n => n.position.x + n.size.width + 80));
  }

  get canvasHeight(): number {
    const nodes = this.store.nodes();
    return Math.max(800, ...nodes.map(n => n.position.y + n.size.height + 80));
  }

  ngOnInit(): void {
    effect(() => {
      const nodes = this.store.nodes();
      this.renderProgressively(nodes);
    });
  }

  private renderProgressively(nodes: DiagramNode[]): void {
    this.visibleNodes = [];
    this.renderBatch = 0;
    this.addBatch(nodes);
  }

  private addBatch(all: DiagramNode[]): void {
    const start = this.renderBatch * RENDER_BATCH_SIZE;
    const end = Math.min(start + RENDER_BATCH_SIZE, all.length);
    this.visibleNodes = [...this.visibleNodes, ...all.slice(start, end)];
    this.renderBatch++;
    if (end < all.length) {
      requestAnimationFrame(() => this.addBatch(all));
    }
  }

  getEdgeX1(nodeId: string): number {
    const n = this.store.nodes().find(n => n.id === nodeId);
    return n ? n.position.x + n.size.width / 2 : 0;
  }
  getEdgeY1(nodeId: string): number {
    const n = this.store.nodes().find(n => n.id === nodeId);
    return n ? n.position.y + n.size.height / 2 : 0;
  }
  getEdgeX2 = this.getEdgeX1.bind(this);
  getEdgeY2 = this.getEdgeY1.bind(this);

  private dragOffset = { x: 0, y: 0 };

  onDragStart(event: DragEvent, node: DiagramNode): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.dragOffset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.dataTransfer!.setData('nodeId', node.id);
  }

  onDragEnd(event: DragEvent, node: DiagramNode): void {
    const canvas = this.canvasHostRef?.nativeElement as HTMLElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left - this.dragOffset.x + canvas.scrollLeft;
    const y = event.clientY - rect.top - this.dragOffset.y + canvas.scrollTop;
    this.store.moveNode(node.id, { x: Math.max(0, x), y: Math.max(0, y) });
  }

  togglePin(nodeId: string): void {
    const node = this.store.nodes().find(n => n.id === nodeId);
    if (!node) return;
    node.isPinned ? this.store.unpinNode(nodeId) : this.store.pinNode(nodeId);
  }

  async toggleFinOps(): Promise<void> {
    const active = !this.store.finOpsLayerActive();
    this.store.finOpsLayerActive.set(active);
    if (active && !this.store.nodes().some(n => n.costData)) {
      const subIds = this.store.activeSubscriptions().map(s => s.subscriptionId);
      if (subIds.length === 0) return;
      const costs = await this.costSvc.getSubscriptionCosts(subIds[0]).toPromise();
      if (costs) {
        this.store.setNodes(this.costSvc.enrichNodesWithCosts(this.store.nodes(), costs));
      }
    }
  }

  toggleDrift(): void {
    if (!this.store.comparisonMode()) {
      const drifted = this.driftSvc.computeDrift(
        this.store.baselineNodes(),
        this.store.nodes()
      );
      this.store.setNodes(drifted);
      this.store.comparisonMode.set(true);
    } else {
      this.store.comparisonMode.set(false);
      this.store.setNodes(this.store.nodes().map(n => ({ ...n, driftStatus: undefined })));
    }
  }

  exportSvg(): void {
    if (this.canvasHostRef) this.exportSvc.exportSVG(this.canvasHostRef);
  }

  async exportPng(): Promise<void> {
    if (this.canvasHostRef) await this.exportSvc.exportPNG(this.canvasHostRef);
  }

  exportJson(): void {
    this.exportSvc.exportJSON(
      this.store.nodes(),
      this.store.edges(),
      this.store.activeSubscriptions()
    );
  }

  async onImportJson(file: File): Promise<void> {
    try {
      const state = await this.exportSvc.importJSON(file);
      this.store.loadBaseline(state.nodes);
    } catch {
      console.error('Failed to import ZureMap JSON');
    }
  }

  rescan(): void {
    this.store.clearDiagram();
    this.router.navigate(['/scan']);
  }
}
