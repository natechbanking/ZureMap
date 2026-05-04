import { Injectable } from '@angular/core';
import { DiagramNode } from '../../core/models/diagram-node.model';
import { InternalItemMoveRequest } from './diagram-node/diagram-node.contracts';
import { ResourceEditorDraft } from './canvas.types';

@Injectable({ providedIn: 'root' })
export class CanvasResourceEditorService {
  private readonly defaultInternalItemColor = '#1d4ed8';
  private readonly defaultInternalItemBackgroundColor = '#eff6ff';

  toDraft(node: DiagramNode): ResourceEditorDraft {
    return {
      label: node.label,
      location: node.metadata.location ?? '',
      resourceGroup: node.metadata.resourceGroup ?? '',
      status: node.status,
      description: node.custom?.description ?? '',
      internalItems: (node.custom?.internalItems ?? []).map(i => ({
        ...i,
        // Show the user's original base colors in the editor, not rule-applied colors
        color: i.baseColor ?? i.color ?? this.defaultInternalItemColor,
        backgroundColor: i.baseBackgroundColor ?? i.backgroundColor ?? this.defaultInternalItemBackgroundColor,
      })),
    };
  }

  applyDraft(nodes: DiagramNode[], nodeId: string, draft: ResourceEditorDraft): DiagramNode[] {
    return nodes.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        label: draft.label,
        status: draft.status,
        metadata: {
          ...n.metadata,
          location: draft.location,
          resourceGroup: draft.resourceGroup,
        },
        custom: {
          description: draft.description,
          // Treat draft colors as the user's base intent so that rules can
          // override them and rule removal reverts correctly.
          internalItems: draft.internalItems.map(i => ({
            ...i,
            baseColor: i.color ?? this.defaultInternalItemColor,
            baseBackgroundColor: i.backgroundColor ?? this.defaultInternalItemBackgroundColor,
          })),
        },
      };
    });
  }

  addInternalItem(draft: ResourceEditorDraft): ResourceEditorDraft {
    const item = {
      id: `ni-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: 'New item',
      x: 8,
      y: 56 + draft.internalItems.length * 16,
      color: this.defaultInternalItemColor,
      backgroundColor: this.defaultInternalItemBackgroundColor,
    };
    return { ...draft, internalItems: [...draft.internalItems, item] };
  }

  removeInternalItem(draft: ResourceEditorDraft, itemId: string): ResourceEditorDraft {
    return { ...draft, internalItems: draft.internalItems.filter(i => i.id !== itemId) };
  }

  updateInternalItemText(draft: ResourceEditorDraft, itemId: string, text: string): ResourceEditorDraft {
    return {
      ...draft,
      internalItems: draft.internalItems.map(i => (i.id === itemId ? { ...i, text } : i)),
    };
  }

  updateInternalItemColor(draft: ResourceEditorDraft, itemId: string, color: string): ResourceEditorDraft {
    return {
      ...draft,
      internalItems: draft.internalItems.map(i => (i.id === itemId ? { ...i, color: color || this.defaultInternalItemColor } : i)),
    };
  }

  updateInternalItemBackgroundColor(draft: ResourceEditorDraft, itemId: string, backgroundColor: string): ResourceEditorDraft {
    return {
      ...draft,
      internalItems: draft.internalItems.map(i =>
        (i.id === itemId ? { ...i, backgroundColor: backgroundColor || this.defaultInternalItemBackgroundColor } : i),
      ),
    };
  }

  applyInternalItemMove(nodes: DiagramNode[], req: InternalItemMoveRequest): DiagramNode[] {
    return nodes.map(n => {
      if (n.id !== req.nodeId) return n;
      const custom = n.custom ?? {};
      const items = (custom.internalItems ?? []).map(i =>
        i.id === req.itemId ? { ...i, x: req.x, y: req.y } : i
      );
      return { ...n, custom: { ...custom, internalItems: items } };
    });
  }
}
