import { inject, Injectable } from '@angular/core';
import { DiagramStore } from '../../core/store/diagram.store';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { CanvasTagVisualizationService } from './canvas-tag-visualization.service';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { RgBound, SubscriptionBound } from './canvas.types';
import { ContextMenuRequest } from './diagram-node/diagram-node.contracts';

@Injectable({ providedIn: 'root' })
export class CanvasContextMenuService {
  private store = inject(DiagramStore);
  private elkLayout = inject(ELKLayoutService);
  private tagVisualization = inject(CanvasTagVisualizationService);

  contextMenu: (ContextMenuRequest & { node: DiagramNode }) | null = null;
  rgContextMenu: { x: number; y: number; id: string; name: string } | null = null;
  subscriptionContextMenu: { x: number; y: number; id: string; name: string } | null = null;
  annotationContextMenu: { x: number; y: number; annotationId: string } | null = null;
  multiSelectContextMenu: { x: number; y: number } | null = null;
  relayoutBusy = false;

  closeContextMenu(): void {
    this.contextMenu = null;
    this.rgContextMenu = null;
    this.subscriptionContextMenu = null;
    this.annotationContextMenu = null;
    this.multiSelectContextMenu = null;
  }

  onContextMenuRequested(req: ContextMenuRequest): void {
    const node = this.store.nodes().find(n => n.id === req.nodeId);
    if (!node) return;
    this.rgContextMenu = null;
    this.subscriptionContextMenu = null;
    this.annotationContextMenu = null;
    if (this.store.selectedNodeIds().length > 1 && this.store.selectedNodeIds().includes(req.nodeId)) {
      this.contextMenu = null;
      this.multiSelectContextMenu = { x: req.x, y: req.y };
      return;
    }
    this.multiSelectContextMenu = null;
    this.contextMenu = { ...req, node };
  }

  onRgContextMenu(event: MouseEvent, rg: RgBound, activeTool: string): void {
    if (activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu = null;
    this.annotationContextMenu = null;
    this.subscriptionContextMenu = null;
    this.rgContextMenu = { x: event.clientX, y: event.clientY, id: rg.id, name: rg.name };
  }

  onSubscriptionContextMenu(event: MouseEvent, sub: SubscriptionBound, activeTool: string): void {
    if (activeTool !== 'pointer') return;
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu = null;
    this.annotationContextMenu = null;
    this.rgContextMenu = null;
    this.subscriptionContextMenu = { x: event.clientX, y: event.clientY, id: sub.subscriptionId, name: sub.name };
  }

  private childToParentMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of this.store.nodes()) {
      for (const childId of node.children ?? []) {
        map.set(childId, node.id);
      }
    }
    return map;
  }

  private parentLabelById(): Map<string, string> {
    return new Map(this.store.nodes().map(n => [n.id, n.label]));
  }

  private inferredImmediateParentId(resourceId: string): string | null {
    const parts = resourceId.split('/').filter(Boolean);
    const providersIdx = parts.findIndex(p => p.toLowerCase() === 'providers');
    if (providersIdx < 0) return null;
    const providerTailLen = parts.length - (providersIdx + 1);
    if (providerTailLen <= 3 || providerTailLen % 2 === 0) return null;
    return `/${parts.slice(0, parts.length - 2).join('/')}`;
  }

  resetParentIdForNode(node: DiagramNode): string | null {
    const parentMap = this.childToParentMap();
    if (parentMap.has(node.id)) return null;
    const byId = new Set(this.store.nodes().map(n => n.id.toLowerCase()));
    const preferred = [node.parentId, this.inferredImmediateParentId(node.id)];
    for (const candidate of preferred) {
      if (!candidate) continue;
      if (byId.has(candidate.toLowerCase())) return candidate;
    }
    return null;
  }

  canResetBreakout(node: DiagramNode): boolean {
    if (this.resetParentIdForNode(node)) return true;
    return node.group === 'standalone' && !!(node.metadata?.resourceGroup || '').trim();
  }

  resetBreakoutLabel(node: DiagramNode): string {
    const parentId = this.resetParentIdForNode(node);
    if (parentId) return `Add back to ${this.parentLabelById().get(parentId) ?? 'container'}`;
    const rg = node.metadata?.resourceGroup || 'resource group';
    return `Add back to RG ${rg}`;
  }

  breakOutNode(nodeId: string, parentId: string | null): void {
    this.store.pushUndo();
    if (parentId) {
      this.store.detachNodeFromParent(nodeId, parentId);
      return;
    }
    this.store.detachNodeFromResourceGroup(nodeId);
  }

  detachFromParent(childId: string, parentId: string): void {
    this.store.pushUndo();
    this.store.detachNodeFromParent(childId, parentId);
  }

  resetBreakout(node: DiagramNode): void {
    this.store.pushUndo();
    const parentId = this.resetParentIdForNode(node);
    if (parentId) this.store.reattachNodeToParent(node.id, parentId);
    if (node.group === 'standalone') this.store.reattachNodeToResourceGroup(node.id);
  }

  private isNodeInsideRgContainer(node: DiagramNode, subscriptionId: string, rgName: string): boolean {
    if (node.group !== 'resourceGroup') return false;
    const nodeSub = node.metadata?.subscriptionId || '';
    const nodeRg = node.groupId || node.metadata?.resourceGroup || '';
    return nodeSub === subscriptionId && nodeRg === rgName;
  }

  private parseRgBoundId(id: string): { subscriptionId: string; rgName: string } | null {
    const idx = id.indexOf('::');
    if (idx < 0) return null;
    return { subscriptionId: id.slice(0, idx), rgName: id.slice(idx + 2) };
  }

  async autoLayoutRgContainer(rgBoundId: string): Promise<void> {
    if (this.relayoutBusy) return;
    const parsed = this.parseRgBoundId(rgBoundId);
    if (!parsed) return;

    const allNodes = this.store.nodes();
    const targetNodes = allNodes.filter(n => this.isNodeInsideRgContainer(n, parsed.subscriptionId, parsed.rgName));
    if (targetNodes.length < 2) return;

    const targetIds = new Set(targetNodes.map(n => n.id));
    const targetEdges = this.store.edges().filter(e => targetIds.has(e.sourceId) && targetIds.has(e.targetId));

    const oldMinX = Math.min(...targetNodes.map(n => n.position.x));
    const oldMinY = Math.min(...targetNodes.map(n => n.position.y));

    this.relayoutBusy = true;
    try {
      const laidOut = await this.elkLayout.layout(targetNodes, targetEdges);
      const newMinX = Math.min(...laidOut.map(n => n.position.x));
      const newMinY = Math.min(...laidOut.map(n => n.position.y));
      const dx = oldMinX - newMinX;
      const dy = oldMinY - newMinY;

      const nextPos = new Map(laidOut.map(n => [n.id, { x: n.position.x + dx, y: n.position.y + dy }]));
      this.store.pushUndo();
      this.store.setNodes(
        allNodes.map(n => nextPos.has(n.id) ? { ...n, position: nextPos.get(n.id)! } : n)
      );
    } finally {
      this.relayoutBusy = false;
    }
  }

  async ctxRgAutoLayout(): Promise<void> {
    if (!this.rgContextMenu) return;
    await this.autoLayoutRgContainer(this.rgContextMenu.id);
    this.closeContextMenu();
  }

  async autoLayoutSubscriptionContainer(subscriptionId: string): Promise<void> {
    if (this.relayoutBusy) return;
    const allNodes = this.store.nodes();
    const targetNodes = allNodes.filter(n => (n.metadata?.subscriptionId || '') === subscriptionId);
    if (targetNodes.length < 2) return;

    const targetIds = new Set(targetNodes.map(n => n.id));
    const targetEdges = this.store.edges().filter(e => targetIds.has(e.sourceId) && targetIds.has(e.targetId));

    const oldMinX = Math.min(...targetNodes.map(n => n.position.x));
    const oldMinY = Math.min(...targetNodes.map(n => n.position.y));

    this.relayoutBusy = true;
    try {
      const laidOut = await this.elkLayout.layout(targetNodes, targetEdges);
      const newMinX = Math.min(...laidOut.map(n => n.position.x));
      const newMinY = Math.min(...laidOut.map(n => n.position.y));
      const dx = oldMinX - newMinX;
      const dy = oldMinY - newMinY;

      const nextPos = new Map(laidOut.map(n => [n.id, { x: n.position.x + dx, y: n.position.y + dy }]));
      this.store.pushUndo();
      this.store.setNodes(
        allNodes.map(n => nextPos.has(n.id) ? { ...n, position: nextPos.get(n.id)! } : n)
      );
    } finally {
      this.relayoutBusy = false;
    }
  }

  async ctxSubscriptionAutoLayout(): Promise<void> {
    if (!this.subscriptionContextMenu) return;
    await this.autoLayoutSubscriptionContainer(this.subscriptionContextMenu.id);
    this.closeContextMenu();
  }

  ctxDelete(): void {
    if (!this.contextMenu) return;
    this.store.pushUndo();
    this.store.deleteNode(this.contextMenu.nodeId);
    this.closeContextMenu();
  }

  ctxMultiDelete(): void {
    this.store.pushUndo();
    this.store.deleteSelectedNodes();
    this.closeContextMenu();
  }

  ctxMultiCopyNames(): void {
    const nodes = this.store.nodes().filter(n => this.store.selectedNodeIds().includes(n.id));
    navigator.clipboard.writeText(nodes.map(n => n.label).join('\n'));
    this.closeContextMenu();
  }

  ctxMultiDetachAll(): void {
    this.store.pushUndo();
    const parentMap = this.childToParentMap();
    for (const id of this.store.selectedNodeIds()) {
      const node = this.store.nodes().find(n => n.id === id);
      if (!node) continue;
      const parentId = parentMap.get(id);
      if (parentId) {
        this.store.detachNodeFromParent(id, parentId);
      } else if (node.group === 'resourceGroup') {
        this.store.detachNodeFromResourceGroup(id);
      }
    }
    this.closeContextMenu();
  }

  ctxCopyName(): void {
    if (!this.contextMenu) return;
    navigator.clipboard.writeText(this.contextMenu.node.label);
    this.closeContextMenu();
  }

  ctxCopyResourceId(): void {
    if (!this.contextMenu) return;
    navigator.clipboard.writeText(this.contextMenu.node.metadata?.id ?? '');
    this.closeContextMenu();
  }

  ctxFocus(): void {
    if (!this.contextMenu) return;
    this.store.selectNode(this.contextMenu.nodeId, true);
    this.closeContextMenu();
  }

  ctxVisualizeTags(): void {
    if (!this.contextMenu) return;
    const nodeId = this.contextMenu.nodeId;
    const nextNodes = this.tagVisualization.apply(this.store.nodes(), nodeId);
    if (nextNodes) {
      this.store.pushUndo();
      this.store.setNodes(nextNodes);
      this.store.selectNode(nodeId);
    }
    this.closeContextMenu();
  }

  ctxDetachFromParent(): void {
    if (!this.contextMenu) return;
    const parentId = this.childToParentMap().get(this.contextMenu.nodeId) ?? null;
    this.breakOutNode(this.contextMenu.nodeId, parentId);
    this.closeContextMenu();
  }

  ctxResetBreakout(): void {
    if (!this.contextMenu) return;
    this.resetBreakout(this.contextMenu.node);
    this.closeContextMenu();
  }
}
