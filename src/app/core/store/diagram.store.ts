import { Injectable, signal, computed } from '@angular/core';
import { AzureSubscription } from '../models/azure-resource.model';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';
import { Annotation } from '../models/annotation.model';
import { TagRule } from '../../features/canvas/canvas.types';

interface DiagramSnapshot {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  annotations: Annotation[];
  customNames: [string, string][];
  tagRules: TagRule[];
  canvasSessionMode: 'scanned' | 'empty' | null;
}

export type ScanPhase =
  | 'choosing-start'
  | 'idle'
  | 'authenticating'
  | 'selecting-subscription'
  | 'selecting-options'
  | 'scanning'
  | 'laying-out'
  | 'ready'
  | 'empty'
  | 'error';

@Injectable({ providedIn: 'root' })
export class DiagramStore {
  readonly revision = signal<number>(0);
  readonly canvasSessionMode = signal<'scanned' | 'empty' | null>(null);
  readonly nodes = signal<DiagramNode[]>([]);
  readonly edges = signal<DiagramEdge[]>([]);

  readonly selectedNodeIds = signal<string[]>([]);
  readonly selectedNodeId = computed(() =>
    this.selectedNodeIds().length === 1 ? this.selectedNodeIds()[0] : null
  );
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

  // Annotations (free-draw, arrows, text, shapes)
  readonly annotations = signal<Annotation[]>([]);

  // Custom container display names (renames applied by the user)
  readonly customContainerNames = signal<Map<string, string>>(new Map());

  // Tag-based highlight rules (evaluated against RG / subscription resource tags)
  readonly tagRules = signal<TagRule[]>([]);

  setCustomContainerName(key: string, value: string | null): void {
    this.customContainerNames.update(m => {
      const next = new Map(m);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    });
    this.bumpRevision();
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────
  private _undoStack: DiagramSnapshot[] = [];
  private _redoStack: DiagramSnapshot[] = [];

  readonly canUndo = signal<boolean>(false);
  readonly canRedo = signal<boolean>(false);

  /** Snapshot current state onto the undo stack. Call BEFORE any user mutation. */
  pushUndo(): void {
    this._undoStack.push(this._snapshot());
    if (this._undoStack.length > 50) this._undoStack.shift();
    this._redoStack = [];
    this.canUndo.set(true);
    this.canRedo.set(false);
  }

  undo(): void {
    const prev = this._undoStack.pop();
    if (!prev) return;
    this._redoStack.push(this._snapshot());
    this._restore(prev);
    this.canUndo.set(this._undoStack.length > 0);
    this.canRedo.set(true);
  }

  redo(): void {
    const next = this._redoStack.pop();
    if (!next) return;
    this._undoStack.push(this._snapshot());
    this._restore(next);
    this.canUndo.set(true);
    this.canRedo.set(this._redoStack.length > 0);
  }

  private _snapshot(): DiagramSnapshot {
    return {
      nodes: this.nodes(),
      edges: this.edges(),
      annotations: this.annotations(),
      customNames: [...this.customContainerNames()],
      tagRules: this.tagRules(),
      canvasSessionMode: this.canvasSessionMode(),
    };
  }

  private _restore(s: DiagramSnapshot): void {
    this.nodes.set(s.nodes);
    this.edges.set(s.edges);
    this.annotations.set(s.annotations);
    this.customContainerNames.set(new Map(s.customNames));
    this.tagRules.set(s.tagRules);
    this.canvasSessionMode.set(s.canvasSessionMode);
    this.bumpRevision();
  }

  addAnnotation(a: Annotation): void {
    this.annotations.update(list => [...list, a]);
    this.bumpRevision();
  }
  updateAnnotation(id: string, changes: Partial<Annotation>): void {
    this.annotations.update(list => list.map(a => a.id === id ? { ...a, ...changes } : a));
    this.bumpRevision();
  }
  deleteAnnotation(id: string): void {
    this.annotations.update(list => list.filter(a => a.id !== id));
    this.bumpRevision();
  }
  undoLastAnnotation(): void {
    this.annotations.update(list => list.slice(0, -1));
    this.bumpRevision();
  }
  clearAnnotations(): void {
    this.annotations.set([]);
    this.bumpRevision();
  }
  setAnnotations(annotations: Annotation[]): void {
    this.annotations.set(annotations);
    this.bumpRevision();
  }

  setNodes(nodes: DiagramNode[]): void {
    this.nodes.set(nodes);
    this.bumpRevision();
  }
  setEdges(edges: DiagramEdge[]): void {
    this.edges.set(edges);
    this.bumpRevision();
  }

  appendNode(node: DiagramNode): void {
    this.nodes.update(current => [...current, node]);
    this.bumpRevision();
  }

  appendNodes(nodes: DiagramNode[]): void {
    this.nodes.update(current => [...current, ...nodes]);
    this.bumpRevision();
  }

  upsertNode(node: DiagramNode): void {
    this.nodes.update(current => {
      const idx = current.findIndex(n => n.id === node.id);
      return idx >= 0
        ? current.map((n, i) => (i === idx ? node : n))
        : [...current, node];
    });
    this.bumpRevision();
  }

  moveNode(nodeId: string, position: { x: number; y: number }): void {
    this.nodes.update(current =>
      current.map(n => n.id === nodeId ? { ...n, position } : n)
    );
    this.bumpRevision();
  }

  moveNodes(moves: { id: string; position: { x: number; y: number } }[]): void {
    const posMap = new Map(moves.map(m => [m.id, m.position]));
    this.nodes.update(current =>
      current.map(n => posMap.has(n.id) ? { ...n, position: posMap.get(n.id)! } : n)
    );
    this.bumpRevision();
  }

  moveNodeGroup(groupKey: string, delta: { dx: number; dy: number }): void {
    this.nodes.update(current =>
      current.map(n => {
        const rg = n.metadata?.resourceGroup || n.groupId || '';
        const subscriptionId = n.metadata?.subscriptionId || '';
        if (`${subscriptionId}::${rg}` !== groupKey) return n;
        const pos = { x: Math.max(0, n.position.x + delta.dx), y: Math.max(0, n.position.y + delta.dy) };
        return { ...n, position: pos };
      })
    );
    this.bumpRevision();
  }

  moveSubscriptionGroup(subscriptionId: string, delta: { dx: number; dy: number }): void {
    this.nodes.update(current =>
      current.map(n => {
        if ((n.metadata?.subscriptionId || '') !== subscriptionId) return n;
        const pos = { x: Math.max(0, n.position.x + delta.dx), y: Math.max(0, n.position.y + delta.dy) };
        return { ...n, position: pos };
      })
    );
    this.bumpRevision();
  }

  moveVmGroup(vmId: string, delta: { dx: number; dy: number }): void {
    this.nodes.update(current => {
      const vm = current.find(n => n.id === vmId);
      if (!vm) return current;

      const groupIds = new Set<string>([vmId, ...(vm.children ?? [])]);
      return current.map(n => {
        if (!groupIds.has(n.id)) return n;
        const pos = { x: Math.max(0, n.position.x + delta.dx), y: Math.max(0, n.position.y + delta.dy) };
        return { ...n, position: pos };
      });
    });
    this.bumpRevision();
  }

  detachNodeFromParent(childId: string, parentId: string): void {
    this.nodes.update(current =>
      current.map(n => {
        if (n.id === parentId && n.children) {
          return { ...n, children: n.children.filter(c => c !== childId) };
        }
        if (n.id === childId) {
          return { ...n, parentId };
        }
        return n;
      })
    );
    this.bumpRevision();
  }

  detachNodeFromResourceGroup(nodeId: string): void {
    this.nodes.update(current =>
      current.map(n => n.id === nodeId
        ? { ...n, group: 'standalone', groupId: n.id }
        : n
      )
    );
    this.bumpRevision();
  }

  reattachNodeToParent(childId: string, parentId: string): void {
    this.nodes.update(current =>
      current.map(n => {
        if (n.id === parentId) {
          const nextChildren = new Set(n.children ?? []);
          nextChildren.add(childId);
          return { ...n, children: Array.from(nextChildren) };
        }
        if (n.id === childId) {
          return { ...n, parentId };
        }
        return n;
      })
    );
    this.bumpRevision();
  }

  reattachNodeToResourceGroup(nodeId: string): void {
    this.nodes.update(current =>
      current.map(n => {
        if (n.id !== nodeId) return n;
        const rg = n.metadata?.resourceGroup || '';
        if (!rg) return n;
        return { ...n, group: 'resourceGroup', groupId: rg };
      })
    );
    this.bumpRevision();
  }

  deleteNode(nodeId: string): void {
    if (this.selectedNodeIds().includes(nodeId)) this.selectNodes(this.selectedNodeIds().filter(id => id !== nodeId));
    this.nodes.update(current =>
      current
        .filter(n => n.id !== nodeId)
        .map(n => n.children?.includes(nodeId)
          ? { ...n, children: n.children.filter(c => c !== nodeId) }
          : n
        )
    );
    this.edges.update(current =>
      current.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId)
    );
    this.bumpRevision();
  }

  selectNode(nodeId: string | null, openSidebar = false): void {
    this.selectNodes(nodeId ? [nodeId] : [], openSidebar);
  }

  selectNodes(ids: string[], openSidebar = false): void {
    const idSet = new Set(ids);
    this.selectedNodeIds.set(ids);
    this.sidebarOpen.set(openSidebar && ids.length === 1);
    this.nodes.update(current =>
      current.map(n => ({ ...n, selected: idSet.has(n.id) }))
    );
  }

  toggleNodeInSelection(nodeId: string): void {
    const current = this.selectedNodeIds();
    const next = current.includes(nodeId)
      ? current.filter(id => id !== nodeId)
      : [...current, nodeId];
    this.selectNodes(next);
  }

  deleteSelectedNodes(): void {
    const ids = new Set(this.selectedNodeIds());
    this.selectNodes([]);
    this.nodes.update(current =>
      current
        .filter(n => !ids.has(n.id))
        .map(n => n.children?.some(c => ids.has(c))
          ? { ...n, children: n.children.filter(c => !ids.has(c)) }
          : n
        )
    );
    this.edges.update(current =>
      current.filter(e => !ids.has(e.sourceId) && !ids.has(e.targetId))
    );
    this.bumpRevision();
  }

  loadBaseline(nodes: DiagramNode[]): void {
    this.baselineNodes.set(nodes);
  }

  clearDiagram(): void {
    this.nodes.set([]);
    this.edges.set([]);
    this.annotations.set([]);
    this.customContainerNames.set(new Map());
    this.tagRules.set([]);
    this.selectedNodeIds.set([]);
    this.sidebarOpen.set(false);
    this.scanPhase.set('idle');
    this.canvasSessionMode.set(null);
    this.errorMessage.set(null);
    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this.canUndo.set(false);
    this.canRedo.set(false);
    this.bumpRevision();
  }

  private bumpRevision(): void {
    this.revision.update(v => v + 1);
  }
}
