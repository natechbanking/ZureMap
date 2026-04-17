import { Injectable, signal, computed } from '@angular/core';
import { AzureSubscription } from '../models/azure-resource.model';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';

export type ScanPhase =
  | 'idle'
  | 'authenticating'
  | 'selecting-subscription'
  | 'scanning'
  | 'laying-out'
  | 'ready'
  | 'error';

@Injectable({ providedIn: 'root' })
export class DiagramStore {
  readonly nodes = signal<DiagramNode[]>([]);
  readonly edges = signal<DiagramEdge[]>([]);

  readonly selectedNodeId = signal<string | null>(null);
  readonly selectedNode = computed(() =>
    this.nodes().find(n => n.id === this.selectedNodeId()) ?? null
  );

  readonly scanPhase = signal<ScanPhase>('idle');
  readonly scanProgress = signal<{ current: number; total: number; label: string }>({
    current: 0, total: 0, label: '',
  });
  readonly activeSubscriptions = signal<AzureSubscription[]>([]);
  readonly availableSubscriptions = signal<AzureSubscription[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly sidebarOpen = signal<boolean>(false);
  readonly finOpsLayerActive = signal<boolean>(false);
  readonly zoomLevel = signal<number>(1);

  readonly nodeCount = computed(() => this.nodes().length);
  readonly edgeCount = computed(() => this.edges().length);
  readonly hasData = computed(() => this.nodes().length > 0);
  readonly totalMonthlyCost = computed(() =>
    this.nodes().reduce((s, n) => s + (n.costData?.monthlyCostUsd ?? 0), 0)
  );

  // Drift Detection
  readonly comparisonMode = signal<boolean>(false);
  readonly baselineNodes = signal<DiagramNode[]>([]);
  readonly driftSummary = computed(() => ({
    matched:   this.nodes().filter(n => n.driftStatus === 'matched').length,
    missing:   this.nodes().filter(n => n.driftStatus === 'missing').length,
    unplanned: this.nodes().filter(n => n.driftStatus === 'unplanned').length,
  }));

  setNodes(nodes: DiagramNode[]): void { this.nodes.set(nodes); }
  setEdges(edges: DiagramEdge[]): void { this.edges.set(edges); }

  appendNode(node: DiagramNode): void {
    this.nodes.update(current => [...current, node]);
  }

  appendNodes(nodes: DiagramNode[]): void {
    this.nodes.update(current => [...current, ...nodes]);
  }

  upsertNode(node: DiagramNode): void {
    this.nodes.update(current => {
      const idx = current.findIndex(n => n.id === node.id);
      return idx >= 0
        ? current.map((n, i) => (i === idx ? node : n))
        : [...current, node];
    });
  }

  moveNode(nodeId: string, position: { x: number; y: number }): void {
    this.nodes.update(current =>
      current.map(n => n.id === nodeId ? { ...n, position } : n)
    );
  }

  pinNode(nodeId: string): void {
    this.nodes.update(current =>
      current.map(n =>
        n.id === nodeId ? { ...n, isPinned: true, manualPosition: n.position } : n
      )
    );
  }

  unpinNode(nodeId: string): void {
    this.nodes.update(current =>
      current.map(n =>
        n.id === nodeId ? { ...n, isPinned: false, manualPosition: undefined } : n
      )
    );
  }

  unpinAll(): void {
    this.nodes.update(current =>
      current.map(n => ({ ...n, isPinned: false, manualPosition: undefined }))
    );
  }

  selectNode(nodeId: string | null): void {
    this.selectedNodeId.set(nodeId);
    this.sidebarOpen.set(nodeId !== null);
    this.nodes.update(current =>
      current.map(n => ({ ...n, selected: n.id === nodeId }))
    );
  }

  loadBaseline(nodes: DiagramNode[]): void {
    this.baselineNodes.set(nodes);
  }

  clearDiagram(): void {
    this.nodes.set([]);
    this.edges.set([]);
    this.selectedNodeId.set(null);
    this.sidebarOpen.set(false);
    this.scanPhase.set('idle');
    this.errorMessage.set(null);
  }
}
