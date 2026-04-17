import { Injectable } from '@angular/core';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';

export interface ELKLayoutOptions {
  algorithm: 'layered' | 'mrtree' | 'force' | 'radial' | 'box';
  direction: 'DOWN' | 'RIGHT' | 'UP' | 'LEFT';
  nodeSpacing: number;
  componentSpacing: number;
  groupPadding: number;
}

const DEFAULT_OPTIONS: ELKLayoutOptions = {
  algorithm: 'layered',
  direction: 'DOWN',
  nodeSpacing: 40,
  componentSpacing: 84,
  groupPadding: 44,
};

const NODE_W = 140;
const NODE_H = 92;
const GRID_COLS = 4;
const H_GAP = 48;
const V_GAP = 48;
const GROUP_LABEL_H = 36;
const GROUP_PAD = 24;
const GROUP_GAP_X = 80;
const GROUP_GAP_Y = 80;
const CANVAS_MARGIN_X = 72;
const CANVAS_MARGIN_Y = 96;

@Injectable({ providedIn: 'root' })
export class ELKLayoutService {
  private worker: Worker | null = null;

  constructor() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('../workers/elk-layout.worker', import.meta.url));
    }
  }

  async layout(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    options: Partial<ELKLayoutOptions> = {}
  ): Promise<DiagramNode[]> {
    if (nodes.length === 0) return nodes;

    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Identify true ELK compound children (VNet -> subnet only).
    const childNodeIds = new Set<string>();
    for (const n of nodes) {
      if (!this.shouldUseElkChildren(n)) continue;
      if (n.children?.length) n.children.forEach(id => childNodeIds.add(id));
    }

    // Group top-level nodes (non-child, non-subnet standalone) by resource group
    const rgMap = new Map<string, DiagramNode[]>();
    for (const node of nodes) {
      if (childNodeIds.has(node.id)) continue; // handled as VNet child
      const rg = node.metadata?.resourceGroup || node.groupId || 'default';
      if (!rgMap.has(rg)) rgMap.set(rg, []);
      rgMap.get(rg)!.push(node);
    }

    // Prefer connected nodes first so ELK places edge-related items closer.
    const degreeByNodeId = new Map<string, number>();
    for (const edge of edges) {
      degreeByNodeId.set(edge.sourceId, (degreeByNodeId.get(edge.sourceId) ?? 0) + 1);
      degreeByNodeId.set(edge.targetId, (degreeByNodeId.get(edge.targetId) ?? 0) + 1);
    }

    // Sort each resource group's nodes by connectivity, then type.
    for (const [, rgNodes] of rgMap) {
      rgNodes.sort((a, b) => {
        const degreeDelta = (degreeByNodeId.get(b.id) ?? 0) - (degreeByNodeId.get(a.id) ?? 0);
        if (degreeDelta !== 0) return degreeDelta;
        return a.resourceType.localeCompare(b.resourceType);
      });
    }

    try {
      const elkGraph = this.buildElkGraph(nodes, edges, opts, rgMap, childNodeIds);
      let result: unknown;
      if (this.worker) {
        result = await this.runInWorker(elkGraph);
      } else {
        const ELKConstructor = (await import('elkjs/lib/elk.bundled.js' as string)).default as new () => { layout(g: unknown): Promise<unknown> };
        const elk = new ELKConstructor();
        result = await elk.layout(elkGraph);
      }

      const positions = new Map<string, { x: number; y: number }>();
      this.extractPositions(result as ElkNode, positions, 0, 0);

      // If ELK gave us real positions for most nodes, use them
      const positioned = positions.size >= Math.max(1, nodes.length * 0.5);
      if (positioned) {
        const laidOut = nodes.map(node => {
          if (node.isPinned && node.manualPosition) return { ...node, position: node.manualPosition };
          const pos = positions.get(node.id);
          return pos ? { ...node, position: pos } : node;
        });
        return this.applyCanvasMargin(laidOut);
      }
    } catch {
      // fall through to manual layout
    }

    return this.applyCanvasMargin(this.manualGroupLayout(nodes, rgMap, childNodeIds));
  }

  private buildElkGraph(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    opts: ELKLayoutOptions,
    rgMap: Map<string, DiagramNode[]>,
    childNodeIds: Set<string>,
  ): object {
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // Build a map from nodeId -> rgName so we can classify edges
    const nodeToRg = new Map<string, string>();
    for (const [rgName, rgNodes] of rgMap) {
      for (const node of rgNodes) {
        nodeToRg.set(node.id, rgName);
        if (node.children) {
          for (const childId of node.children) nodeToRg.set(childId, rgName);
        }
      }
    }

    // Split edges: intra-RG edges go inside the RG container, inter-RG go at root
    const intraRgEdges = new Map<string, DiagramEdge[]>();
    const interRgEdges: DiagramEdge[] = [];
    for (const edge of edges) {
      const sourceRg = nodeToRg.get(edge.sourceId);
      const targetRg = nodeToRg.get(edge.targetId);
      if (sourceRg && targetRg && sourceRg === targetRg) {
        if (!intraRgEdges.has(sourceRg)) intraRgEdges.set(sourceRg, []);
        intraRgEdges.get(sourceRg)!.push(edge);
      } else {
        interRgEdges.push(edge);
      }
    }

    const buildLayoutNode = (node: DiagramNode): object => {
      const base: Record<string, unknown> = { id: node.id };
      if (node.isPinned && node.manualPosition) {
        base['layoutOptions'] = { 'org.eclipse.elk.noLayout': 'true' };
      }
      const children = this.shouldUseElkChildren(node)
        ? (node.children ?? [])
          .map(id => nodeById.get(id))
          .filter((n): n is DiagramNode => !!n)
        : [];
      if (children.length) {
        base['children'] = children.map(c => ({
          id: c.id,
          width: c.size.width,
          height: c.size.height,
        }));
        base['layoutOptions'] = {
          ...(base['layoutOptions'] as object ?? {}),
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.padding': `[top=40,left=20,bottom=20,right=20]`,
          'elk.spacing.nodeNode': String(opts.nodeSpacing),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.nodeSpacing),
        };
      } else {
        // Leaf nodes keep fixed dimensions; compound nodes are auto-sized by ELK.
        base['width'] = node.size.width;
        base['height'] = node.size.height;
      }
      return base;
    };

    const rgContainers = Array.from(rgMap.entries()).map(([rgName, rgNodes]) => ({
      id: `__rg__${rgName}`,
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': opts.direction,
        'elk.spacing.nodeNode': String(opts.nodeSpacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.nodeSpacing),
        'elk.padding': `[top=${opts.groupPadding + GROUP_LABEL_H},left=${opts.groupPadding},bottom=${opts.groupPadding},right=${opts.groupPadding}]`,
        'elk.layered.wrapping.strategy': 'MULTI_EDGE',
        'elk.layered.wrapping.additionalEdgeSpacing': '10',
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.nodePlacement.favorStraightEdges': 'true',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.layered.thoroughness': '20',
      },
      children: rgNodes.map(buildLayoutNode),
      // Intra-RG edges let ELK's layered algorithm place connected nodes close together
      edges: (intraRgEdges.get(rgName) ?? []).map(e => ({
        id: e.id,
        sources: [e.sourceId],
        targets: [e.targetId],
      })),
    }));

    const rootEdges = interRgEdges
      .filter(e => !childNodeIds.has(e.sourceId) || !childNodeIds.has(e.targetId))
      .map(e => ({ id: e.id, sources: [e.sourceId], targets: [e.targetId] }));

    return {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'box',
        'elk.spacing.nodeNode': String(opts.componentSpacing),
        'elk.box.packingMode': 'GROUP_DEC',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: rgContainers,
      edges: rootEdges,
    };
  }

  private extractPositions(
    node: ElkNode,
    map: Map<string, { x: number; y: number }>,
    offsetX: number,
    offsetY: number,
  ): void {
    const absX = (node.x ?? 0) + offsetX;
    const absY = (node.y ?? 0) + offsetY;

    const isSynthetic = node.id === 'root' || node.id.startsWith('__rg__');
    if (!isSynthetic && node.x !== undefined && node.y !== undefined) {
      map.set(node.id, { x: absX, y: absY });
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractPositions(child, map, isSynthetic ? absX : absX, isSynthetic ? absY : absY);
      }
    }
  }

  // Manual grid layout grouped by resource group — used as fallback and guarantees visible spread
  private manualGroupLayout(
    nodes: DiagramNode[],
    rgMap: Map<string, DiagramNode[]>,
    childNodeIds: Set<string>,
  ): DiagramNode[] {
    const result = new Map<string, { x: number; y: number }>();

    let groupX = GROUP_PAD;
    let groupY = GROUP_PAD;
    let rowMaxH = 0;
    const canvasMaxW = (NODE_W + H_GAP) * GRID_COLS + GROUP_PAD * 2 + GROUP_GAP_X;

    for (const [, rgNodes] of rgMap) {
      let col = 0;
      let row = 0;

      for (const node of rgNodes) {
        result.set(node.id, {
          x: groupX + GROUP_PAD + col * (NODE_W + H_GAP),
          y: groupY + GROUP_LABEL_H + GROUP_PAD + row * (NODE_H + V_GAP),
        });

        // Place VNet children right below their parent
        if (this.shouldUseElkChildren(node) && node.children?.length) {
          node.children.forEach((childId, ci) => {
            result.set(childId, {
              x: groupX + GROUP_PAD + ci * (NODE_W + H_GAP),
              y: groupY + GROUP_LABEL_H + GROUP_PAD + (row + 1) * (NODE_H + V_GAP) + 24,
            });
          });
        }

        col++;
        if (col >= GRID_COLS) { col = 0; row++; }
      }

      const rows = Math.ceil(rgNodes.length / GRID_COLS);
      const groupW = Math.min(rgNodes.length, GRID_COLS) * (NODE_W + H_GAP) - H_GAP + GROUP_PAD * 2;
      const groupH = GROUP_LABEL_H + GROUP_PAD + rows * (NODE_H + V_GAP) + GROUP_PAD;

      rowMaxH = Math.max(rowMaxH, groupH);
      groupX += groupW + GROUP_GAP_X;

      if (groupX + groupW > canvasMaxW) {
        groupX = GROUP_PAD;
        groupY += rowMaxH + GROUP_GAP_Y;
        rowMaxH = 0;
      }
    }

    // Place child nodes (subnets) that weren't placed yet
    for (const node of nodes) {
      if (childNodeIds.has(node.id) && !result.has(node.id)) {
        const parent = nodes.find(n => n.children?.includes(node.id));
        const parentPos = parent ? result.get(parent.id) : null;
        result.set(node.id, parentPos
          ? { x: parentPos.x + NODE_W + H_GAP, y: parentPos.y }
          : { x: 20, y: 20 });
      }
    }

    return nodes.map(node => {
      if (node.isPinned && node.manualPosition) return { ...node, position: node.manualPosition };
      const pos = result.get(node.id);
      return pos ? { ...node, position: pos } : node;
    });
  }

  private runInWorker(graph: object): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const worker = this.worker!;
      const handler = (e: MessageEvent) => {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        resolve(e.data);
      };
      const errHandler = (e: ErrorEvent) => {
        worker.removeEventListener('message', handler);
        worker.removeEventListener('error', errHandler);
        reject(new Error(e.message));
      };
      worker.addEventListener('message', handler);
      worker.addEventListener('error', errHandler);
      worker.postMessage(graph);
    });
  }

  private applyCanvasMargin(nodes: DiagramNode[]): DiagramNode[] {
    if (!nodes.length) return nodes;

    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const dx = Math.max(0, CANVAS_MARGIN_X - minX);
    const dy = Math.max(0, CANVAS_MARGIN_Y - minY);
    if (dx === 0 && dy === 0) return nodes;

    return nodes.map(n => {
      const position = { x: n.position.x + dx, y: n.position.y + dy };
      if (!n.isPinned) return { ...n, position };
      const manualPosition = n.manualPosition
        ? { x: n.manualPosition.x + dx, y: n.manualPosition.y + dy }
        : position;
      return { ...n, position, manualPosition };
    });
  }

  private shouldUseElkChildren(node: DiagramNode): boolean {
    return node.resourceType === 'microsoft.network/virtualnetworks';
  }
}

interface ElkNode {
  id: string;
  x?: number;
  y?: number;
  children?: ElkNode[];
}
