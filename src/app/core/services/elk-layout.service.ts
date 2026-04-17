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
  nodeSpacing: 60,
  componentSpacing: 80,
  groupPadding: 40,
};

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
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const elkGraph = this.toElkGraph(nodes, edges, opts);

    let result: unknown;
    if (this.worker) {
      result = await this.runInWorker(elkGraph);
    } else {
      // Use the pre-bundled ELK file to avoid the optional web-worker dependency
      const ELKConstructor = (await import('elkjs/lib/elk.bundled.js' as string)).default as new () => { layout(g: unknown): Promise<unknown> };
      const elk = new ELKConstructor();
      result = await elk.layout(elkGraph);
    }

    return this.fromElkGraph(result as ElkGraphResult, nodes);
  }

  private toElkGraph(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    opts: ELKLayoutOptions
  ): object {
    const topLevel = nodes.filter(n => !n.parentId);

    const buildElkNode = (node: DiagramNode): object => {
      const base: Record<string, unknown> = {
        id: node.id,
        width: node.size.width,
        height: node.size.height,
      };

      if (node.isPinned && node.manualPosition) {
        base['layoutOptions'] = {
          'org.eclipse.elk.noLayout': 'true',
          'org.eclipse.elk.fixedPosition': `(${node.manualPosition.x},${node.manualPosition.y})`,
        };
      }

      if (node.children?.length) {
        const children = nodes.filter(n => node.children!.includes(n.id));
        base['children'] = children.map(buildElkNode);
        base['layoutOptions'] = {
          ...(base['layoutOptions'] as object ?? {}),
          'elk.padding': `[top=${opts.groupPadding},left=${opts.groupPadding},bottom=${opts.groupPadding},right=${opts.groupPadding}]`,
        };
      }

      return base;
    };

    const internalEdgeIds = new Set(
      nodes.filter(n => n.parentId).map(n => n.id)
    );

    return {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': opts.algorithm,
        'elk.direction': opts.direction,
        'elk.spacing.nodeNode': String(opts.nodeSpacing),
        'elk.spacing.componentComponent': String(opts.componentSpacing),
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: topLevel.map(buildElkNode),
      edges: edges
        .filter(e => !internalEdgeIds.has(e.sourceId) || !internalEdgeIds.has(e.targetId))
        .map(e => ({ id: e.id, sources: [e.sourceId], targets: [e.targetId] })),
    };
  }

  private fromElkGraph(elkResult: ElkGraphResult, originalNodes: DiagramNode[]): DiagramNode[] {
    const positions = new Map<string, { x: number; y: number }>();
    this.extractPositions(elkResult, positions);

    return originalNodes.map(node => {
      if (node.isPinned && node.manualPosition) {
        return { ...node, position: node.manualPosition };
      }
      const pos = positions.get(node.id);
      return pos ? { ...node, position: pos } : node;
    });
  }

  private extractPositions(node: ElkGraphResult, map: Map<string, { x: number; y: number }>): void {
    if (node.id !== 'root' && node.x !== undefined && node.y !== undefined) {
      map.set(node.id, { x: node.x, y: node.y });
    }
    if (node.children) {
      for (const child of node.children) {
        this.extractPositions(child, map);
      }
    }
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
}

interface ElkGraphResult {
  id: string;
  x?: number;
  y?: number;
  children?: ElkGraphResult[];
}
