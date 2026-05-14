import { Injectable, signal } from '@angular/core';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import { ResourceCreationData } from '../create-resource-modal.component';

const AZURE_RESOURCE_DND_TYPE = 'application/x-zuremap-azure-resource';

@Injectable({ providedIn: 'root' })
export class CanvasResourcePlacementController {
  readonly activeResourceType = signal('');
  readonly showCreateResourceModal = signal(false);
  readonly resourcePlacementPosition = signal<{ x: number; y: number } | null>(null);

  onResourceTypeChange(type: string): void {
    this.activeResourceType.set(type);
  }

  onCanvasDragOver(event: DragEvent): void {
    if (!event.dataTransfer) return;
    if (!event.dataTransfer.types.includes(AZURE_RESOURCE_DND_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  onCanvasDrop(
    event: DragEvent,
    canvasPointFromClient: (x: number, y: number) => { x: number; y: number },
  ): void {
    if (!event.dataTransfer) return;
    const raw = event.dataTransfer.getData(AZURE_RESOURCE_DND_TYPE);
    if (!raw) return;
    let payload: { type?: string; label?: string } | null = null;
    try {
      payload = JSON.parse(raw) as { type?: string; label?: string };
    } catch {
      return;
    }
    if (!payload?.type) return;
    event.preventDefault();
    const pos = canvasPointFromClient(event.clientX, event.clientY);
    this.startResourcePlacement(payload.type, pos);
  }

  startResourcePlacement(type: string, position: { x: number; y: number }): void {
    if (!type) return;
    this.activeResourceType.set(type);
    this.resourcePlacementPosition.set(position);
    this.showCreateResourceModal.set(true);
  }

  onCreateResourceConfirm(
    data: ResourceCreationData,
    iconUrlForType: (type: string) => string,
    applyInternalItemRules: (nodes: DiagramNode[]) => DiagramNode[],
    currentNodes: DiagramNode[],
  ): DiagramNode[] | null {
    const position = this.resourcePlacementPosition();
    const activeType = this.activeResourceType();
    if (!position || !activeType) return null;

    const iconUrl = iconUrlForType(activeType);
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const tags: Record<string, string> = {};
    for (const t of data.tags) {
      if (t.key.trim()) tags[t.key.trim()] = t.value;
    }
    const isK8sWorkload = activeType.startsWith('kubernetes/');
    const node: DiagramNode = {
      id,
      label: data.name,
      resourceType: activeType,
      iconUrl,
      group: isK8sWorkload ? 'k8sNamespace' : 'standalone',
      groupId: data.resourceGroup || 'custom',
      position,
      size: { width: 160, height: 80 },
      status: data.status,
      selected: false,
      highlighted: false,
      metadata: {
        id: `/custom/${data.resourceGroup || 'custom'}/${activeType}/${data.name}`,
        name: data.name,
        type: activeType,
        location: data.location,
        resourceGroup: data.resourceGroup,
        subscriptionId: 'custom',
        tags,
        properties: {},
      },
      custom: {
        description: data.description,
        internalItems: data.internalItems
          .filter(i => i.text.trim())
          .map((item, i) => ({
            id: `ii-${i}`,
            text: item.text,
            x: 4,
            y: 20 + i * 16,
            baseColor: '#1d4ed8',
            color: '#1d4ed8',
            baseBackgroundColor: '#eff6ff',
            backgroundColor: '#eff6ff',
          })),
      },
    };

    this.showCreateResourceModal.set(false);
    this.resourcePlacementPosition.set(null);
    return applyInternalItemRules([...currentNodes, node]);
  }

  onCreateResourceCancel(): void {
    this.showCreateResourceModal.set(false);
    this.resourcePlacementPosition.set(null);
  }
}
