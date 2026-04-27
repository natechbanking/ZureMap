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
  nodeSpacing: 30,
  componentSpacing: 48,
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
const SUB_GAP = 120;
const CANVAS_MARGIN_X = 72;
const CANVAS_MARGIN_Y = 96;

type ClassifiedEdges = {
  intraVmEdges: Map<string, DiagramEdge[]>;
  intraRgEdges: Map<string, DiagramEdge[]>;
  intraSubEdges: Map<string, DiagramEdge[]>;
  rootEdgeList: DiagramEdge[];
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
    if (nodes.length === 0) return nodes;

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    // VNet compound children (subnets rendered inside VNet node)
    const childNodeIds = new Set<string>();
    for (const n of nodes) {
      if (!this.shouldUseElkChildren(n)) continue;
      if (n.children?.length) n.children.forEach(id => childNodeIds.add(id));
    }

    // VM groups: VMs that have visible children (NICs, disks, etc.)
    const vmChildIds = new Set<string>();
    const vmParentIds = new Set<string>();
    const vmGroups = new Map<string, DiagramNode[]>();
    for (const n of nodes) {
      if (n.resourceType !== 'microsoft.compute/virtualmachines') continue;
      if (!n.children?.length) continue;
      const children = n.children.map(id => nodeById.get(id)).filter((c): c is DiagramNode => !!c);
      if (children.length === 0) continue;
      vmParentIds.add(n.id);
      children.forEach(c => vmChildIds.add(c.id));
      vmGroups.set(n.id, [n, ...children]);
    }

    // Standalone top-level nodes: exclude VNet children, VM children, and VMs-with-children.
    const rgMap = new Map<string, DiagramNode[]>();
    for (const node of nodes) {
      if (childNodeIds.has(node.id)) continue;
      if (vmChildIds.has(node.id)) continue;
      if (vmParentIds.has(node.id)) continue;
      const subId = node.metadata?.subscriptionId || '';
      const rg = node.metadata?.resourceGroup || node.groupId || 'default';
      const key = `${subId}::${rg}`;
      if (!rgMap.has(key)) rgMap.set(key, []);
      rgMap.get(key)!.push(node);
    }

    // Group VM groups by the same RG key used in rgMap
    const vmGroupsByRg = new Map<string, Map<string, DiagramNode[]>>();
    for (const [vmId, members] of vmGroups) {
      const vm = members[0];
      const subId = vm.metadata?.subscriptionId || '';
      const rg = vm.metadata?.resourceGroup || vm.groupId || 'default';
      const key = `${subId}::${rg}`;
      if (!vmGroupsByRg.has(key)) vmGroupsByRg.set(key, new Map());
      vmGroupsByRg.get(key)!.set(vmId, members);
    }

    // Build container maps (nodeToRg, nodeToVm, multiSub) needed for edge classification
    const { nodeToRg, nodeToVm, multiSub } = this.buildNodeMaps(nodes, rgMap, vmGroupsByRg);

    // Classify edges once — shared by the sort step, buildElkGraph, and gridPackRgGroups
    const classified = this.classifyEdges(edges, nodeToRg, nodeToVm, childNodeIds, multiSub);
    const { intraRgEdges, intraSubEdges, rootEdgeList } = classified;

    // BFS-cluster sort: connected nodes become adjacent in ELK children arrays so
    // considerModelOrder can keep them together during crossing minimization.
    for (const [rgKey, rgNodes] of rgMap) {
      rgMap.set(rgKey, this.sortByConnectivityClusters(rgNodes, intraRgEdges.get(rgKey) ?? []));
    }

    // Collect cross-RG edges for gridPackRgGroups affinity sort.
    // multiSub=true  → intraSubEdges covers same-sub cross-RG edges
    // multiSub=false → all cross-RG edges fall into rootEdgeList
    const crossRgEdges: DiagramEdge[] = [
      ...Array.from(intraSubEdges.values()).flat(),
      ...rootEdgeList,
    ];

    try {
      const elkGraph = this.buildElkGraph(
        nodes, edges, opts, rgMap, childNodeIds, vmGroupsByRg,
        nodeToRg, classified, multiSub,
      );
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

      if (positions.size >= Math.max(1, nodes.length * 0.5)) {
        const laidOut = nodes.map(node => {
          const pos = positions.get(node.id);
          return pos ? { ...node, position: pos } : node;
        });
        return this.gridPackRgGroups(laidOut, nodes, rgMap, vmGroupsByRg, crossRgEdges);
      }
    } catch {
      // fall through to manual layout
    }

    return this.gridPackRgGroups(
      this.manualGroupLayout(nodes, rgMap, childNodeIds, vmGroupsByRg),
      nodes, rgMap, vmGroupsByRg, crossRgEdges,
    );
  }

  // ── Helpers extracted from buildElkGraph ────────────────────────────────────

  private buildNodeMaps(
    nodes: DiagramNode[],
    rgMap: Map<string, DiagramNode[]>,
    vmGroupsByRg: Map<string, Map<string, DiagramNode[]>>,
  ): { nodeToRg: Map<string, string>; nodeToVm: Map<string, string>; multiSub: boolean } {
    void nodes;
    const nodeToRg = new Map<string, string>();
    for (const [rgKey, rgNodes] of rgMap) {
      for (const node of rgNodes) {
        nodeToRg.set(node.id, rgKey);
        if (node.children) for (const childId of node.children) nodeToRg.set(childId, rgKey);
      }
    }
    for (const [rgKey, vmGroupsInRg] of vmGroupsByRg) {
      void rgKey;
      for (const members of vmGroupsInRg.values())
        for (const m of members) nodeToRg.set(m.id, rgKey);
    }

    const nodeToVm = new Map<string, string>();
    for (const [, vmGroupsInRg] of vmGroupsByRg)
      for (const [vmId, members] of vmGroupsInRg)
        for (const m of members) nodeToVm.set(m.id, vmId);

    const allRgKeys = new Set([...rgMap.keys(), ...vmGroupsByRg.keys()]);
    const uniqueSubs = new Set(Array.from(allRgKeys).map(k => k.split('::')[0]));
    return { nodeToRg, nodeToVm, multiSub: uniqueSubs.size > 1 };
  }

  private classifyEdges(
    edges: DiagramEdge[],
    nodeToRg: Map<string, string>,
    nodeToVm: Map<string, string>,
    childNodeIds: Set<string>,
    multiSub: boolean,
  ): ClassifiedEdges {
    const intraVmEdges  = new Map<string, DiagramEdge[]>();
    const intraRgEdges  = new Map<string, DiagramEdge[]>();
    const intraSubEdges = new Map<string, DiagramEdge[]>();
    const rootEdgeList: DiagramEdge[] = [];

    for (const edge of edges) {
      if (childNodeIds.has(edge.sourceId) && childNodeIds.has(edge.targetId)) continue;

      const sourceRg  = nodeToRg.get(edge.sourceId);
      const targetRg  = nodeToRg.get(edge.targetId);
      const sourceVm  = nodeToVm.get(edge.sourceId);
      const targetVm  = nodeToVm.get(edge.targetId);
      const sourceSub = sourceRg?.split('::')[0];
      const targetSub = targetRg?.split('::')[0];

      if (sourceVm && targetVm && sourceVm === targetVm) {
        if (!intraVmEdges.has(sourceVm)) intraVmEdges.set(sourceVm, []);
        intraVmEdges.get(sourceVm)!.push(edge);
      } else if (sourceRg && targetRg && sourceRg === targetRg) {
        if (!intraRgEdges.has(sourceRg)) intraRgEdges.set(sourceRg, []);
        intraRgEdges.get(sourceRg)!.push(edge);
      } else if (multiSub && sourceSub && targetSub && sourceSub === targetSub) {
        if (!intraSubEdges.has(sourceSub)) intraSubEdges.set(sourceSub, []);
        intraSubEdges.get(sourceSub)!.push(edge);
      } else {
        rootEdgeList.push(edge);
      }
    }
    return { intraVmEdges, intraRgEdges, intraSubEdges, rootEdgeList };
  }

  // BFS-cluster sort: orders standalone nodes within an RG so directly-connected
  // pairs are adjacent in the children array. ELK's considerModelOrder setting
  // then prefers configurations that keep model-ordered nodes together, reducing
  // edge crossings. Isolated nodes (no intra-RG edges) are appended last by type.
  private sortByConnectivityClusters(nodes: DiagramNode[], intraRgEdgeList: DiagramEdge[]): DiagramNode[] {
    if (nodes.length <= 1) return nodes;

    const nodeIds = new Set(nodes.map(n => n.id));
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const edge of intraRgEdgeList) {
      if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) continue;
      adj.get(edge.sourceId)!.push(edge.targetId);
      adj.get(edge.targetId)!.push(edge.sourceId);
    }

    const localDegree = new Map(nodes.map(n => [n.id, adj.get(n.id)!.length]));
    const nodeById    = new Map(nodes.map(n => [n.id, n]));
    const visited     = new Set<string>();
    const result: DiagramNode[] = [];

    const sorted = [...nodes].sort((a, b) => {
      const dd = (localDegree.get(b.id) ?? 0) - (localDegree.get(a.id) ?? 0);
      return dd !== 0 ? dd : a.resourceType.localeCompare(b.resourceType);
    });

    for (const seed of sorted) {
      if (visited.has(seed.id) || (localDegree.get(seed.id) ?? 0) === 0) continue;
      const queue = [seed.id];
      visited.add(seed.id);
      while (queue.length) {
        const cur = queue.shift()!;
        result.push(nodeById.get(cur)!);
        const neighbors = (adj.get(cur) ?? [])
          .filter(id => !visited.has(id))
          .sort((a, b) => (localDegree.get(b) ?? 0) - (localDegree.get(a) ?? 0));
        for (const nb of neighbors) { visited.add(nb); queue.push(nb); }
      }
    }

    // Append isolated nodes sorted by resourceType
    nodes
      .filter(n => !visited.has(n.id))
      .sort((a, b) => a.resourceType.localeCompare(b.resourceType))
      .forEach(n => result.push(n));

    return result;
  }

  // ── ELK graph construction ──────────────────────────────────────────────────

  private buildElkGraph(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    opts: ELKLayoutOptions,
    rgMap: Map<string, DiagramNode[]>,
    childNodeIds: Set<string>,
    vmGroupsByRg: Map<string, Map<string, DiagramNode[]>>,
    nodeToRg: Map<string, string>,
    classified: ClassifiedEdges,
    multiSub: boolean,
  ): object {
    void edges;
    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const allRgKeys = new Set([...rgMap.keys(), ...vmGroupsByRg.keys()]);
    const { intraVmEdges, intraRgEdges, intraSubEdges, rootEdgeList } = classified;

    // ── Build leaf / VNet compound nodes ─────────────────────────────────────
    const buildLayoutNode = (node: DiagramNode): object => {
      const base: Record<string, unknown> = { id: node.id };
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
          'elk.layered.cycleBreaking.strategy': 'GREEDY',
          'elk.layered.mergeEdges': 'true',
        };
      } else {
        base['width'] = node.size.width;
        base['height'] = node.size.height;
      }
      return base;
    };

    // ── __vm__ containers (box — keeps members tightly packed) ────────────────
    const buildVmElkNode = (vmId: string, members: DiagramNode[]): object => ({
      id: `__vm__${vmId}`,
      layoutOptions: {
        'elk.algorithm': 'box',
        'elk.spacing.nodeNode': String(Math.round(opts.nodeSpacing * 0.5)),
        'elk.box.packingMode': 'GROUP_DEC',
        'elk.padding': `[top=20,left=14,bottom=14,right=14]`,
        'elk.margins': `[top=16,left=0,bottom=0,right=0]`,
      },
      children: members.map((n: DiagramNode) => ({
        id: n.id,
        width: n.size.width,
        height: n.size.height,
      })),
    });

    // ── __rg__ containers (layered — uses intra-RG edges for node ordering) ──
    const rgContainersByKey = new Map(
      Array.from(allRgKeys).map(rgKey => {
        const standaloneNodes = rgMap.get(rgKey) ?? [];
        const vmGroupsInRg = vmGroupsByRg.get(rgKey) ?? new Map();
        const vmElkNodes = Array.from(vmGroupsInRg.entries())
          .map(([vmId, members]) => buildVmElkNode(vmId, members));

        return [
          rgKey,
          {
            id: `__rg__${rgKey}`,
            layoutOptions: {
              'elk.algorithm': 'layered',
              'elk.direction': 'RIGHT',
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
              'elk.layered.cycleBreaking.strategy': 'GREEDY',
              'elk.layered.mergeEdges': 'true',
              'elk.separateConnectedComponents': 'false',
              'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
            },
            children: [...vmElkNodes, ...standaloneNodes.map(buildLayoutNode)],
            edges: (intraRgEdges.get(rgKey) ?? []).map(e => ({
              id: e.id, sources: [e.sourceId], targets: [e.targetId],
            })),
          },
        ] as [string, object];
      })
    );

    // ── Group RG containers by subscription ───────────────────────────────────
    const subToRgContainers = new Map<string, object[]>();
    for (const [rgKey, rgContainer] of rgContainersByKey) {
      const subId = rgKey.split('::')[0];
      if (!subToRgContainers.has(subId)) subToRgContainers.set(subId, []);
      subToRgContainers.get(subId)!.push(rgContainer);
    }

    // ── __sub__ containers (rectpacking — spreads RGs in 2-D grid) ────────────
    const topLevelChildren: object[] = multiSub
      ? Array.from(subToRgContainers.entries()).map(([subId, subRgs]) => ({
          id: `__sub__${subId}`,
          layoutOptions: {
            'elk.algorithm': 'rectpacking',
            'elk.spacing.nodeNode': String(opts.componentSpacing),
            'elk.padding': `[top=48,left=32,bottom=32,right=32]`,
            'elk.aspectRatio': '1.6',
            'elk.rectpacking.optimizationGoal': 'ASPECT_RATIO_DRIVEN',
            'elk.expandNodes': 'false',
            'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          },
          children: subRgs,
          edges: (intraSubEdges.get(subId) ?? []).map(e => ({
            id: e.id, sources: [e.sourceId], targets: [e.targetId],
          })),
        }))
      : Array.from(rgContainersByKey.values());

    // ── Root (rectpacking — arranges sub/RG containers in a 2-D grid) ─────────
    const rootEdges = rootEdgeList.map(e => ({ id: e.id, sources: [e.sourceId], targets: [e.targetId] }));

    // nodeToRg used to validate cross-container edge references exist
    void nodeToRg;

    return {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'rectpacking',
        'elk.spacing.nodeNode': String(opts.componentSpacing),
        'elk.aspectRatio': '1.6',
        'elk.rectpacking.optimizationGoal': 'ASPECT_RATIO_DRIVEN',
        'elk.expandNodes': 'false',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      },
      children: topLevelChildren,
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

    const isSynthetic = node.id === 'root'
      || node.id.startsWith('__rg__')
      || node.id.startsWith('__sub__')
      || node.id.startsWith('__vm__');

    if (!isSynthetic && node.x !== undefined && node.y !== undefined) {
      map.set(node.id, { x: absX, y: absY });
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractPositions(child, map, absX, absY);
      }
    }
  }

  // Manual grid layout — fallback when ELK fails.
  private manualGroupLayout(
    nodes: DiagramNode[],
    rgMap: Map<string, DiagramNode[]>,
    childNodeIds: Set<string>,
    vmGroupsByRg: Map<string, Map<string, DiagramNode[]>>,
  ): DiagramNode[] {
    const result = new Map<string, { x: number; y: number }>();

    const subToRgKeys = new Map<string, string[]>();
    const allRgKeys = new Set([...rgMap.keys(), ...vmGroupsByRg.keys()]);
    for (const rgKey of allRgKeys) {
      const subId = rgKey.split('::')[0];
      if (!subToRgKeys.has(subId)) subToRgKeys.set(subId, []);
      subToRgKeys.get(subId)!.push(rgKey);
    }

    const canvasMaxW = (NODE_W + H_GAP) * GRID_COLS + GROUP_PAD * 2 + GROUP_GAP_X;
    let subOffsetX = GROUP_PAD;

    for (const [, rgKeys] of subToRgKeys) {
      let groupX = 0;
      let groupY = GROUP_PAD;
      let rowMaxH = 0;
      let subBlockW = 0;

      for (const rgKey of rgKeys) {
        const standaloneNodes = rgMap.get(rgKey) ?? [];
        const vmGroupsInRg = vmGroupsByRg.get(rgKey) ?? new Map();

        let col = 0;
        let row = 0;

        for (const [, members] of vmGroupsInRg) {
          const vm = members[0];
          const children = members.slice(1);

          result.set(vm.id, {
            x: subOffsetX + groupX + GROUP_PAD + col * (NODE_W + H_GAP),
            y: groupY + GROUP_LABEL_H + GROUP_PAD + row * (NODE_H + V_GAP),
          });

          children.forEach((child: DiagramNode, ci: number) => {
            result.set(child.id, {
              x: subOffsetX + groupX + GROUP_PAD + (col + ci + 1) * (NODE_W + H_GAP),
              y: groupY + GROUP_LABEL_H + GROUP_PAD + row * (NODE_H + V_GAP),
            });
          });

          row++;
        }

        for (const node of standaloneNodes) {
          result.set(node.id, {
            x: subOffsetX + groupX + GROUP_PAD + col * (NODE_W + H_GAP),
            y: groupY + GROUP_LABEL_H + GROUP_PAD + row * (NODE_H + V_GAP),
          });

          if (this.shouldUseElkChildren(node) && node.children?.length) {
            node.children.forEach((childId, ci) => {
              result.set(childId, {
                x: subOffsetX + groupX + GROUP_PAD + ci * (NODE_W + H_GAP),
                y: groupY + GROUP_LABEL_H + GROUP_PAD + (row + 1) * (NODE_H + V_GAP) + 24,
              });
            });
          }

          col++;
          if (col >= GRID_COLS) { col = 0; row++; }
        }

        const totalRows = row + (col > 0 ? 1 : 0);
        const standaloneW = standaloneNodes.length > 0
          ? Math.min(standaloneNodes.length, GRID_COLS) * (NODE_W + H_GAP) - H_GAP + GROUP_PAD * 2
          : GROUP_PAD * 2 + NODE_W;
        const vmMaxCols = vmGroupsByRg.get(rgKey)?.size
          ? Math.max(...Array.from(vmGroupsByRg.get(rgKey)!.values()).map(m => m.length))
          : 0;
        const vmW = vmMaxCols > 0 ? vmMaxCols * (NODE_W + H_GAP) - H_GAP + GROUP_PAD * 2 : 0;
        const groupW = Math.max(standaloneW, vmW);
        const groupH = GROUP_LABEL_H + GROUP_PAD + totalRows * (NODE_H + V_GAP) + GROUP_PAD;

        rowMaxH = Math.max(rowMaxH, groupH);
        subBlockW = Math.max(subBlockW, groupX + groupW);
        groupX += groupW + GROUP_GAP_X;

        if (groupX + groupW > canvasMaxW) {
          groupX = 0;
          groupY += rowMaxH + GROUP_GAP_Y;
          rowMaxH = 0;
        }
      }

      subOffsetX += subBlockW + SUB_GAP;
    }

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

  // After ELK lays out each RG's internals, re-arrange the RG bounding boxes
  // into a grid — keeping each subscription's RGs in their own contiguous block.
  // RGs with cross-connections between them are placed adjacent using a greedy
  // affinity sort so their edges span shorter distances.
  private gridPackRgGroups(
    nodes: DiagramNode[],
    allNodes: DiagramNode[],
    rgMap: Map<string, DiagramNode[]>,
    vmGroupsByRg: Map<string, Map<string, DiagramNode[]>>,
    crossRgEdges: DiagramEdge[] = [],
  ): DiagramNode[] {
    const nodeToRg = new Map<string, string>();
    for (const [rgKey, rgNodes] of rgMap) {
      for (const n of rgNodes) nodeToRg.set(n.id, rgKey);
    }
    for (const [rgKey, vmGroupsInRg] of vmGroupsByRg) {
      for (const members of vmGroupsInRg.values()) {
        for (const m of members) nodeToRg.set(m.id, rgKey);
      }
    }
    // Propagate rgKey to VNet children so they move with their parent
    for (const n of allNodes) {
      if (n.children?.length) {
        const rgKey = nodeToRg.get(n.id);
        if (rgKey) {
          for (const childId of n.children) nodeToRg.set(childId, rgKey);
        }
      }
    }

    // Compute bounding box per RG
    const rgBounds = new Map<string, { minX: number; minY: number; maxX: number; maxY: number }>();
    for (const node of nodes) {
      const rgKey = nodeToRg.get(node.id);
      if (!rgKey) continue;
      const b = rgBounds.get(rgKey) ?? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      b.minX = Math.min(b.minX, node.position.x);
      b.minY = Math.min(b.minY, node.position.y);
      b.maxX = Math.max(b.maxX, node.position.x + node.size.width);
      b.maxY = Math.max(b.maxY, node.position.y + node.size.height);
      rgBounds.set(rgKey, b);
    }

    if (rgBounds.size === 0) return this.applyCanvasMargin(nodes);

    // Build cross-RG affinity matrix: count edges between each pair of RG keys.
    // Used to sort connected RG containers adjacent to each other in the grid.
    const rgAffinity = new Map<string, Map<string, number>>();
    for (const edge of crossRgEdges) {
      const rgA = nodeToRg.get(edge.sourceId);
      const rgB = nodeToRg.get(edge.targetId);
      if (!rgA || !rgB || rgA === rgB) continue;
      if (!rgBounds.has(rgA) || !rgBounds.has(rgB)) continue;
      if (!rgAffinity.has(rgA)) rgAffinity.set(rgA, new Map());
      if (!rgAffinity.has(rgB)) rgAffinity.set(rgB, new Map());
      rgAffinity.get(rgA)!.set(rgB, (rgAffinity.get(rgA)!.get(rgB) ?? 0) + 1);
      rgAffinity.get(rgB)!.set(rgA, (rgAffinity.get(rgB)!.get(rgA) ?? 0) + 1);
    }

    // Group RG keys by subscription
    const subToRgKeys = new Map<string, string[]>();
    for (const rgKey of rgBounds.keys()) {
      const subId = rgKey.split('::')[0];
      if (!subToRgKeys.has(subId)) subToRgKeys.set(subId, []);
      subToRgKeys.get(subId)!.push(rgKey);
    }

    // Sort each sub's RGs using greedy affinity-first insertion, tiebreak by area.
    // When crossRgEdges is empty, all affinity scores are 0 and this degrades to
    // pure area-descending — identical to the pre-change behavior.
    for (const [, keys] of subToRgKeys) {
      if (keys.length <= 1) continue;

      const area = (k: string) => {
        const b = rgBounds.get(k)!;
        return (b.maxX - b.minX) * (b.maxY - b.minY);
      };

      const remaining = new Set(keys);
      const ordered: string[] = [];
      // Seed: largest-area RG
      ordered.push(keys.reduce((best, k) => area(k) > area(best) ? k : best, keys[0]));
      remaining.delete(ordered[0]);

      while (remaining.size > 0) {
        let bestKey = '', bestAffinity = -1, bestArea = -1;
        for (const candidate of remaining) {
          let score = 0;
          for (const placed of ordered) score += rgAffinity.get(candidate)?.get(placed) ?? 0;
          const a = area(candidate);
          if (score > bestAffinity || (score === bestAffinity && a > bestArea)) {
            bestKey = candidate; bestAffinity = score; bestArea = a;
          }
        }
        ordered.push(bestKey);
        remaining.delete(bestKey);
      }

      keys.splice(0, keys.length, ...ordered);
    }

    // Layout each subscription's RG block and accumulate their widths
    const newRgOrigins = new Map<string, { x: number; y: number }>();
    let subBlockX = CANVAS_MARGIN_X;

    for (const [, rgKeys] of subToRgKeys) {
      const count = rgKeys.length;
      const cols = Math.max(1, Math.round(Math.sqrt(count * 1.4)));

      const colWidths = new Array<number>(cols).fill(0);
      const rowHeights: number[] = [];
      for (let i = 0; i < rgKeys.length; i++) {
        const b = rgBounds.get(rgKeys[i])!;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const w = b.maxX - b.minX + GROUP_PAD * 2;
        const h = b.maxY - b.minY + GROUP_LABEL_H + GROUP_PAD * 2;
        colWidths[col] = Math.max(colWidths[col], w);
        rowHeights[row] = Math.max(rowHeights[row] ?? 0, h);
      }

      const colX: number[] = [];
      let cx = subBlockX;
      for (let c = 0; c < cols; c++) { colX[c] = cx; cx += colWidths[c] + GROUP_GAP_X; }

      const rowY: number[] = [];
      let ry = CANVAS_MARGIN_Y;
      for (let r = 0; r < rowHeights.length; r++) { rowY[r] = ry; ry += rowHeights[r] + GROUP_GAP_Y; }

      for (let i = 0; i < rgKeys.length; i++) {
        newRgOrigins.set(rgKeys[i], {
          x: colX[i % cols] + GROUP_PAD,
          y: rowY[Math.floor(i / cols)] + GROUP_LABEL_H + GROUP_PAD,
        });
      }

      const blockWidth = colWidths.reduce((sum, w) => sum + w, 0) + (cols - 1) * GROUP_GAP_X;
      subBlockX += blockWidth + SUB_GAP;
    }

    return nodes.map(node => {
      const rgKey = nodeToRg.get(node.id);
      if (!rgKey) return node;
      const bounds = rgBounds.get(rgKey)!;
      const newOrigin = newRgOrigins.get(rgKey);
      if (!newOrigin) return node;
      return {
        ...node,
        position: {
          x: newOrigin.x + (node.position.x - bounds.minX),
          y: newOrigin.y + (node.position.y - bounds.minY),
        },
      };
    });
  }

  private applyCanvasMargin(nodes: DiagramNode[]): DiagramNode[] {
    if (!nodes.length) return nodes;

    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const dx = Math.max(0, CANVAS_MARGIN_X - minX);
    const dy = Math.max(0, CANVAS_MARGIN_Y - minY);
    if (dx === 0 && dy === 0) return nodes;

    return nodes.map(n => ({
      ...n,
      position: { x: n.position.x + dx, y: n.position.y + dy }
    }));
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
