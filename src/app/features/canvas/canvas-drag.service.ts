import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';
import {
  NodeDragState,
  RgDragState,
  SubscriptionDragState,
  ToolbarDragState,
  VmDragState,
} from './canvas.types';

export interface CanvasDragMoveContext {
  event: MouseEvent;
  zoomLevel: number;
  toolbarPos: { x: number; y: number };
  toolbarDragState: ToolbarDragState | null;
  nodeDragState: NodeDragState | null;
  subscriptionDragState: SubscriptionDragState | null;
  vmDragState: VmDragState | null;
  rgDragState: RgDragState | null;
  annDragId: string | null;
  annDragMouse: { x: number; y: number };
  annDragOrigin: { x: number; y: number; x2?: number; y2?: number };
  nodes: DiagramNode[];
  svgPoint: (event: MouseEvent) => { x: number; y: number };
  pinNode: (id: string) => void;
  moveNode: (id: string, position: { x: number; y: number }) => void;
  moveSubscriptionGroup: (subscriptionId: string, delta: { dx: number; dy: number }) => void;
  moveVmGroup: (vmId: string, delta: { dx: number; dy: number }) => void;
  moveResourceGroup: (id: string, delta: { dx: number; dy: number }) => void;
  updateAnnotation: (id: string, changes: { x: number; y: number; x2?: number; y2?: number }) => void;
}

export interface CanvasDragMoveResult {
  handled: boolean;
  toolbarPos: { x: number; y: number };
  toolbarDragState: ToolbarDragState | null;
  nodeDragState: NodeDragState | null;
  subscriptionDragState: SubscriptionDragState | null;
  vmDragState: VmDragState | null;
  rgDragState: RgDragState | null;
}

@Injectable({ providedIn: 'root' })
export class CanvasDragService {
  onDocumentMouseMove(ctx: CanvasDragMoveContext): CanvasDragMoveResult {
    if (ctx.toolbarDragState) {
      const dx = ctx.event.clientX - ctx.toolbarDragState.lastX;
      const dy = ctx.event.clientY - ctx.toolbarDragState.lastY;
      return {
        handled: true,
        toolbarPos: { x: Math.max(0, ctx.toolbarPos.x + dx), y: Math.max(0, ctx.toolbarPos.y + dy) },
        toolbarDragState: { lastX: ctx.event.clientX, lastY: ctx.event.clientY },
        nodeDragState: ctx.nodeDragState,
        subscriptionDragState: ctx.subscriptionDragState,
        vmDragState: ctx.vmDragState,
        rgDragState: ctx.rgDragState,
      };
    }

    if (ctx.nodeDragState) {
      const dx = (ctx.event.clientX - ctx.nodeDragState.lastX) / ctx.zoomLevel;
      const dy = (ctx.event.clientY - ctx.nodeDragState.lastY) / ctx.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        let nextNodeDragState = ctx.nodeDragState;
        if (!ctx.nodeDragState.hasMoved) {
          ctx.pinNode(ctx.nodeDragState.id);
          nextNodeDragState = { ...nextNodeDragState, hasMoved: true };
        }
        const node = ctx.nodes.find(n => n.id === ctx.nodeDragState!.id);
        if (node) {
          ctx.moveNode(node.id, {
            x: Math.max(0, node.position.x + dx),
            y: Math.max(0, node.position.y + dy),
          });
        }
        nextNodeDragState = { ...nextNodeDragState, lastX: ctx.event.clientX, lastY: ctx.event.clientY };
        return {
          handled: true,
          toolbarPos: ctx.toolbarPos,
          toolbarDragState: ctx.toolbarDragState,
          nodeDragState: nextNodeDragState,
          subscriptionDragState: ctx.subscriptionDragState,
          vmDragState: ctx.vmDragState,
          rgDragState: ctx.rgDragState,
        };
      }
      return {
        handled: true,
        toolbarPos: ctx.toolbarPos,
        toolbarDragState: ctx.toolbarDragState,
        nodeDragState: ctx.nodeDragState,
        subscriptionDragState: ctx.subscriptionDragState,
        vmDragState: ctx.vmDragState,
        rgDragState: ctx.rgDragState,
      };
    }

    if (ctx.subscriptionDragState) {
      const dx = (ctx.event.clientX - ctx.subscriptionDragState.lastX) / ctx.zoomLevel;
      const dy = (ctx.event.clientY - ctx.subscriptionDragState.lastY) / ctx.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        ctx.moveSubscriptionGroup(ctx.subscriptionDragState.subscriptionId, { dx, dy });
        return {
          handled: true,
          toolbarPos: ctx.toolbarPos,
          toolbarDragState: ctx.toolbarDragState,
          nodeDragState: ctx.nodeDragState,
          subscriptionDragState: { subscriptionId: ctx.subscriptionDragState.subscriptionId, lastX: ctx.event.clientX, lastY: ctx.event.clientY },
          vmDragState: ctx.vmDragState,
          rgDragState: ctx.rgDragState,
        };
      }
      return {
        handled: true,
        toolbarPos: ctx.toolbarPos,
        toolbarDragState: ctx.toolbarDragState,
        nodeDragState: ctx.nodeDragState,
        subscriptionDragState: ctx.subscriptionDragState,
        vmDragState: ctx.vmDragState,
        rgDragState: ctx.rgDragState,
      };
    }

    if (ctx.vmDragState) {
      const dx = (ctx.event.clientX - ctx.vmDragState.lastX) / ctx.zoomLevel;
      const dy = (ctx.event.clientY - ctx.vmDragState.lastY) / ctx.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        ctx.moveVmGroup(ctx.vmDragState.vmId, { dx, dy });
        return {
          handled: true,
          toolbarPos: ctx.toolbarPos,
          toolbarDragState: ctx.toolbarDragState,
          nodeDragState: ctx.nodeDragState,
          subscriptionDragState: ctx.subscriptionDragState,
          vmDragState: { vmId: ctx.vmDragState.vmId, lastX: ctx.event.clientX, lastY: ctx.event.clientY },
          rgDragState: ctx.rgDragState,
        };
      }
      return {
        handled: true,
        toolbarPos: ctx.toolbarPos,
        toolbarDragState: ctx.toolbarDragState,
        nodeDragState: ctx.nodeDragState,
        subscriptionDragState: ctx.subscriptionDragState,
        vmDragState: ctx.vmDragState,
        rgDragState: ctx.rgDragState,
      };
    }

    if (ctx.rgDragState) {
      const dx = (ctx.event.clientX - ctx.rgDragState.lastX) / ctx.zoomLevel;
      const dy = (ctx.event.clientY - ctx.rgDragState.lastY) / ctx.zoomLevel;
      if (dx !== 0 || dy !== 0) {
        ctx.moveResourceGroup(ctx.rgDragState.id, { dx, dy });
        return {
          handled: true,
          toolbarPos: ctx.toolbarPos,
          toolbarDragState: ctx.toolbarDragState,
          nodeDragState: ctx.nodeDragState,
          subscriptionDragState: ctx.subscriptionDragState,
          vmDragState: ctx.vmDragState,
          rgDragState: { id: ctx.rgDragState.id, lastX: ctx.event.clientX, lastY: ctx.event.clientY },
        };
      }
      return {
        handled: true,
        toolbarPos: ctx.toolbarPos,
        toolbarDragState: ctx.toolbarDragState,
        nodeDragState: ctx.nodeDragState,
        subscriptionDragState: ctx.subscriptionDragState,
        vmDragState: ctx.vmDragState,
        rgDragState: ctx.rgDragState,
      };
    }

    if (ctx.annDragId) {
      const pt = ctx.svgPoint(ctx.event);
      const dx = pt.x - ctx.annDragMouse.x;
      const dy = pt.y - ctx.annDragMouse.y;
      const { x2, y2 } = ctx.annDragOrigin;
      ctx.updateAnnotation(ctx.annDragId, {
        x: ctx.annDragOrigin.x + dx,
        y: ctx.annDragOrigin.y + dy,
        x2: typeof x2 === 'number' ? x2 + dx : undefined,
        y2: typeof y2 === 'number' ? y2 + dy : undefined,
      });
      return {
        handled: true,
        toolbarPos: ctx.toolbarPos,
        toolbarDragState: ctx.toolbarDragState,
        nodeDragState: ctx.nodeDragState,
        subscriptionDragState: ctx.subscriptionDragState,
        vmDragState: ctx.vmDragState,
        rgDragState: ctx.rgDragState,
      };
    }

    return {
      handled: false,
      toolbarPos: ctx.toolbarPos,
      toolbarDragState: ctx.toolbarDragState,
      nodeDragState: ctx.nodeDragState,
      subscriptionDragState: ctx.subscriptionDragState,
      vmDragState: ctx.vmDragState,
      rgDragState: ctx.rgDragState,
    };
  }
}
