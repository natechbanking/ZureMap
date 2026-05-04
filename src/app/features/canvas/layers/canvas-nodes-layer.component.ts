import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramNodeComponent } from '../diagram-node/diagram-node.component';
import { DiagramNode } from '../../../core/models/diagram-node.model';
import { DrawingTool } from '../../../core/models/annotation.model';
import { NodeDragState } from '../canvas.types';
import {
  ContextMenuRequest,
  InternalItemMoveRequest,
  NodeResizeRequest,
  NodeRotateRequest,
  RouteTableExpansionRequest,
  VirtualNetworkExpansionRequest,
  NsgExpansionRequest,
  StorageAccountExpansionRequest,
  AksExpansionRequest,
  VmExpansionRequest,
  UaiExpansionRequest,
  HostingEnvironmentExpansionRequest,
  ServerFarmExpansionRequest,
  PublicIpExpansionRequest,
  ScheduleExpansionRequest,
  DiskExpansionRequest,
  AzureFirewallExpansionRequest,
  ApplicationGatewayExpansionRequest,
  ConnectionExpansionRequest,
  DnsZoneExpansionRequest,
} from '../diagram-node/diagram-node.contracts';

@Component({
  selector: 'app-canvas-nodes-layer',
  standalone: true,
  imports: [CommonModule, DiagramNodeComponent],
  templateUrl: './canvas-nodes-layer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasNodesLayerComponent {
  @Input() visibleNodes: DiagramNode[] = [];
  @Input() activeTool: DrawingTool = 'pointer';
  @Input() nodeDragState: NodeDragState | null = null;
  @Input() nodeTagHighlights: Map<string, string> = new Map<string, string>();
  @Input() childToParentMap: Map<string, string> = new Map<string, string>();
  @Input() parentLabelById: Map<string, string> = new Map<string, string>();
  @Input() finOpsActive = false;
  @Input() zoomLevel = 1;
  @Input() isLinking = false;

  @Output() nodeMouseDown = new EventEmitter<{ event: MouseEvent; node: DiagramNode }>();
  @Output() portMouseDown = new EventEmitter<{ event: MouseEvent; node: DiagramNode; portId: string }>();
  @Output() nodeClicked = new EventEmitter<string>();
  @Output() editRequested = new EventEmitter<string>();
  @Output() internalItemMoved = new EventEmitter<InternalItemMoveRequest>();
  @Output() nodeResized = new EventEmitter<NodeResizeRequest>();
  @Output() nodeRotateStarted = new EventEmitter<void>();
  @Output() nodeRotated = new EventEmitter<NodeRotateRequest>();
  @Output() contextMenuRequested = new EventEmitter<ContextMenuRequest>();
  @Output() breakOut = new EventEmitter<{ nodeId: string; parentId: string | null }>();

  @Output() routeTableExpansionChanged = new EventEmitter<RouteTableExpansionRequest>();
  @Output() virtualNetworkExpansionChanged = new EventEmitter<VirtualNetworkExpansionRequest>();
  @Output() nsgExpansionChanged = new EventEmitter<NsgExpansionRequest>();
  @Output() storageAccountExpansionChanged = new EventEmitter<StorageAccountExpansionRequest>();
  @Output() aksExpansionChanged = new EventEmitter<AksExpansionRequest>();
  @Output() vmExpansionChanged = new EventEmitter<VmExpansionRequest>();
  @Output() uaiExpansionChanged = new EventEmitter<UaiExpansionRequest>();
  @Output() hostingEnvironmentExpansionChanged = new EventEmitter<HostingEnvironmentExpansionRequest>();
  @Output() serverFarmExpansionChanged = new EventEmitter<ServerFarmExpansionRequest>();
  @Output() publicIpExpansionChanged = new EventEmitter<PublicIpExpansionRequest>();
  @Output() scheduleExpansionChanged = new EventEmitter<ScheduleExpansionRequest>();
  @Output() diskExpansionChanged = new EventEmitter<DiskExpansionRequest>();
  @Output() azureFirewallExpansionChanged = new EventEmitter<AzureFirewallExpansionRequest>();
  @Output() applicationGatewayExpansionChanged = new EventEmitter<ApplicationGatewayExpansionRequest>();
  @Output() connectionExpansionChanged = new EventEmitter<ConnectionExpansionRequest>();
  @Output() dnsZoneExpansionChanged = new EventEmitter<DnsZoneExpansionRequest>();

  canDetachFromResourceGroup(node: DiagramNode): boolean {
    return node.group === 'resourceGroup';
  }

  breakOutTitle(node: DiagramNode, parentId: string | null): string {
    if (parentId) return `Break out of ${this.parentLabelById.get(parentId) ?? 'container'}`;
    if (this.canDetachFromResourceGroup(node)) {
      return `Break out of ${node.metadata?.['resourceGroup'] || node.groupId || 'resource group'}`;
    }
    return 'Break out of resource group';
  }
}
