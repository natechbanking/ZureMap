import { Component, Input, Output, EventEmitter, HostListener, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramNode, NodeInternalItem } from '../../../core/models/diagram-node.model';
import { AzureIconComponent } from '../../../shared/components/azure-icon/azure-icon.component';
import { CostBadgeComponent } from '../../../shared/components/cost-badge/cost-badge.component';
import { CostService } from '../../../core/services/cost.service';
import { DiagramStore } from '../../../core/store/diagram.store';
import { StorageDetailsService, StorageDetails } from '../../../core/services/storage-details.service';
import { UaiRoleAssignmentsService, UaiRoleAssignment } from '../../../core/services/uai-role-assignments.service';
import { AzureFirewallDetailsService, AzureFirewallPolicyRuleCounts } from '../../../core/services/azure-firewall-details.service';
import { DnsRecordsService, DnsRecord } from '../../../core/services/dns-records.service';
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
} from './diagram-node.contracts';
import {
  isAks as isAksKind,
  isApplicationGateway as isApplicationGatewayKind,
  isAzureFirewall as isAzureFirewallKind,
  isConnectionResource as isConnectionResourceKind,
  isDisk as isDiskKind,
  isHostingEnvironment as isHostingEnvironmentKind,
  isNsg as isNsgKind,
  isPublicIpAddress as isPublicIpAddressKind,
  isRouteTable as isRouteTableKind,
  isSchedule as isScheduleKind,
  isServerFarm as isServerFarmKind,
  isStorageAccount as isStorageAccountKind,
  isUserAssignedIdentity as isUserAssignedIdentityKind,
  isVirtualNetwork as isVirtualNetworkKind,
  isVm as isVmKind,
  isDnsZoneKind,
} from './diagram-node-kind.util';
import { DetailKv, getPath, pickText, toDisplayText } from './diagram-node-format.util';
import {
  mapApplicationGatewayDetails,
  mapAzureFirewallDetails,
  mapConnectionDetails,
  mapDiskDetails,
  mapHostingEnvironmentStats,
  mapPublicIpDetails,
  mapScheduleDetails,
  mapServerFarmStats,
} from './diagram-node-simple-details.mapper';
import {
  AksInfoView,
  NsgRuleView,
  RouteEntryView,
  SubnetEntryView,
  VmInfoView,
  mapAksInfo,
  mapNsgRuleEntries,
  mapRouteEntries,
  mapSubnetEntries,
  mapVmInfo,
} from './diagram-node-list-details.mapper';
import { UaiAssignmentsPanelComponent, UaiRoleAssignmentView } from './panels/uai-assignments-panel.component';
import { StorageDetailsPanelComponent } from './panels/storage-details-panel.component';
import { AksDetailsPanelComponent } from './panels/aks-details-panel.component';
import { VmDetailsPanelComponent } from './panels/vm-details-panel.component';
import { NsgRulesPanelComponent } from './panels/nsg-rules-panel.component';
import { NodeDetailKvPanelComponent } from '../shared/node-detail-kv-panel.component';
import { NodeDetailListPanelComponent, NodeDetailListSection } from '../shared/node-detail-list-panel.component';
import { NodeToggleButtonComponent } from '../shared/node-toggle-button.component';

@Component({
  selector: 'app-diagram-node',
  standalone: true,
  imports: [
    CommonModule,
    AzureIconComponent,
    CostBadgeComponent,
    NodeToggleButtonComponent,
    NodeDetailKvPanelComponent,
    NodeDetailListPanelComponent,
    UaiAssignmentsPanelComponent,
    StorageDetailsPanelComponent,
    AksDetailsPanelComponent,
    VmDetailsPanelComponent,
    NsgRulesPanelComponent,
  ],
  templateUrl: './diagram-node.component.html',
  styleUrls: ['./diagram-node.component.scss'],
})
export class DiagramNodeComponent {
  @Input({ required: true }) node!: DiagramNode;
  @Input() finOpsActive = false;
  @Input() zoomLevel = 1;
  @Input() tagHighlightColor: string | null = null;
  @Input() isLinking = false;
  @Output() clicked = new EventEmitter<string>();
  @Output() detailsRequested = new EventEmitter<string>();
  @Output() portMouseDown = new EventEmitter<{ event: MouseEvent; portId: string }>();
  @Output() contextMenuRequested = new EventEmitter<ContextMenuRequest>();
  @Output() editRequested = new EventEmitter<string>();
  @Output() internalItemMoved = new EventEmitter<InternalItemMoveRequest>();
  @Output() nodeResized = new EventEmitter<NodeResizeRequest>();
  @Output() nodeRotateStarted = new EventEmitter<string>();
  @Output() nodeRotated = new EventEmitter<NodeRotateRequest>();
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

  private costSvc = inject(CostService);
  private store = inject(DiagramStore);
  private storageDetailsSvc = inject(StorageDetailsService);
  private uaiRoleAssignmentsSvc = inject(UaiRoleAssignmentsService);
  private azureFirewallDetailsSvc = inject(AzureFirewallDetailsService);
  private dnsRecordsSvc = inject(DnsRecordsService);
  private elRef = inject(ElementRef);
  private internalDrag: { itemId: string; startMouseX: number; startMouseY: number; startX: number; startY: number } | null = null;
  private resizeDrag: { startMouseX: number; startMouseY: number; startW: number; startH: number } | null = null;
  private rotateDrag: { cx: number; cy: number } | null = null;
  private _storageDetails: StorageDetails | null = null;
  routesExpanded = false;
  subnetsExpanded = false;
  nsgRulesExpanded = false;
  storageDetailsExpanded = false;
  storageDetailsLoading = false;
  storageDetailsLoaded = false;
  storageDetailsError: string | null = null;
  aksExpanded = false;
  vmExpanded = false;
  uaiAssignmentsExpanded = false;
  uaiAssignmentsLoading = false;
  uaiAssignmentsLoaded = false;
  uaiAssignmentsError: string | null = null;
  uaiRoleAssignments: UaiRoleAssignmentView[] = [];
  hostingEnvironmentStatsExpanded = false;
  serverFarmStatsExpanded = false;
  publicIpExpanded = false;
  scheduleExpanded = false;
  diskExpanded = false;
  azureFirewallExpanded = false;
  applicationGatewayExpanded = false;
  connectionExpanded = false;
  dnsRecordsExpanded = false;
  dnsRecordsLoading = false;
  dnsRecordsLoaded = false;
  dnsRecordsError: string | null = null;
  private _dnsRecords: DnsRecord[] = [];
  azureFirewallCountsLoading = false;
  azureFirewallCountsLoaded = false;
  azureFirewallCountsError: string | null = null;
  azureFirewallPolicyCounts: AzureFirewallPolicyRuleCounts | null = null;

  get typeLabel(): string {
    const parts = this.node.resourceType.split('/');
    return parts[parts.length - 1];
  }

  get borderStyle(): string {
    if (this.node.driftStatus === 'missing')   return '2px solid #d13438';
    if (this.node.driftStatus === 'unplanned') return '2px dashed #0078d4';
    if (this.node.selected)                    return '2px solid #0078d4';
    if (this.tagHighlightColor)                return `2px solid ${this.tagHighlightColor}`;
    if (this.finOpsActive && this.node.costData) {
      const s = this.costSvc.getCostBorderStyle(this.node.costData.monthlyCostUsd);
      return `${s.borderWidth} solid ${s.borderColor}`;
    }
    if (this.finOpsActive && !this.node.costData) {
      return '1px dashed #605e5c';
    }
    return '1px solid #d2d0ce';
  }

  get boxShadow(): string {
    if (!this.finOpsActive || !this.node.costData) return '';
    const maxCost = this.store.totalMonthlyCost();
    return this.costSvc.getCostHeatmapGlow(this.node.costData.monthlyCostUsd, maxCost);
  }

  get isRouteTable(): boolean {
    return isRouteTableKind(this.node.resourceType);
  }

  get isVirtualNetwork(): boolean {
    return isVirtualNetworkKind(this.node.resourceType);
  }

  get isNsg(): boolean {
    return isNsgKind(this.node.resourceType);
  }

  get isStorageAccount(): boolean {
    return isStorageAccountKind(this.node.resourceType);
  }

  get isAks(): boolean {
    return isAksKind(this.node.resourceType);
  }

  get aksInfo(): AksInfoView {
    return mapAksInfo(this.node.metadata?.properties ?? {});
  }

  get isVm(): boolean {
    return isVmKind(this.node.resourceType);
  }

  get isUserAssignedIdentity(): boolean {
    return isUserAssignedIdentityKind(this.node.resourceType);
  }

  get isHostingEnvironment(): boolean {
    return isHostingEnvironmentKind(this.node.resourceType);
  }

  get isServerFarm(): boolean {
    return isServerFarmKind(this.node.resourceType);
  }

  get isPublicIpAddress(): boolean {
    return isPublicIpAddressKind(this.node.resourceType);
  }

  get isSchedule(): boolean {
    return isScheduleKind(this.node.resourceType);
  }

  get isDisk(): boolean {
    return isDiskKind(this.node.resourceType);
  }

  get isAzureFirewall(): boolean {
    return isAzureFirewallKind(this.node.resourceType);
  }

  get isApplicationGateway(): boolean {
    return isApplicationGatewayKind(this.node.resourceType);
  }

  get isConnectionResource(): boolean {
    return isConnectionResourceKind(this.node.resourceType);
  }

  get hostingEnvironmentStats(): DetailKv[] {
    return mapHostingEnvironmentStats(this.node.metadata?.properties ?? {});
  }

  get serverFarmStats(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    const sku = this.node.metadata?.sku;
    return mapServerFarmStats(props, sku);
  }

  get publicIpDetails(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    const sku = this.node.metadata?.sku;
    return mapPublicIpDetails(props, sku);
  }

  get scheduleDetails(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    return mapScheduleDetails(this.node.metadata, props);
  }

  get diskDetails(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    const sku = this.node.metadata?.sku;
    return mapDiskDetails(props, sku);
  }

  get azureFirewallDetails(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    const sku = this.node.metadata?.sku;
    const applicationRuleCount = this.azureFirewallPolicyCounts?.applicationRules ?? this.countAzureFirewallRules('application', props);
    const networkRuleCount = this.azureFirewallPolicyCounts?.networkRules ?? this.countAzureFirewallRules('network', props);
    const natRuleCount = this.azureFirewallPolicyCounts?.natRules ?? this.countAzureFirewallRules('nat', props);
    return mapAzureFirewallDetails(props, sku, {
      applicationRules: applicationRuleCount,
      networkRules: networkRuleCount,
      natRules: natRuleCount,
    });
  }

  get applicationGatewayDetails(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    const sku = this.node.metadata?.sku;
    return mapApplicationGatewayDetails(props, sku);
  }

  get connectionDetails(): DetailKv[] {
    const props = this.node.metadata?.properties ?? {};
    return mapConnectionDetails(props);
  }

  get vmInfo(): VmInfoView {
    const props = this.node.metadata?.properties ?? {};
    return mapVmInfo(props);
  }

  get storageContainers(): string[] {
    return this._storageDetails?.containers ?? [];
  }

  get storageFileShares(): string[] {
    return this._storageDetails?.fileShares ?? [];
  }

  get storageTables(): string[] {
    return this._storageDetails?.tables ?? [];
  }

  get storageQueues(): string[] {
    return this._storageDetails?.queues ?? [];
  }

  get storageItemCount(): number {
    return this.storageContainers.length + this.storageFileShares.length +
           this.storageTables.length + this.storageQueues.length;
  }

  get routeEntries(): RouteEntryView[] {
    return mapRouteEntries(this.node.metadata?.properties ?? {});
  }

  get routeSections(): NodeDetailListSection[] {
    return [{
      title: '',
      items: this.routeEntries.map(route => ({
        id: `${route.name}|${route.addressPrefix}|${route.nextHopType}|${route.nextHopIpAddress ?? ''}`,
        title: route.name,
        subtitle: route.addressPrefix,
        meta: `${route.nextHopType}${route.nextHopIpAddress ? ` • ${route.nextHopIpAddress}` : ''}`,
      })),
    }];
  }

  get subnetEntries(): SubnetEntryView[] {
    return mapSubnetEntries(this.node.metadata?.properties ?? {});
  }

  get subnetSections(): NodeDetailListSection[] {
    return [{
      title: '',
      items: this.subnetEntries.map(subnet => ({
        id: `${subnet.name}|${subnet.addressPrefix}`,
        title: subnet.name,
        subtitle: subnet.addressPrefix,
      })),
    }];
  }

  onNodeClick(event: Event): void {
    const e = event as MouseEvent | KeyboardEvent;
    if (e.ctrlKey || e.metaKey) return;
    this.clicked.emit(this.node.id);
  }

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuRequested.emit({ nodeId: this.node.id, x: event.clientX, y: event.clientY });
  }

  onDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.editRequested.emit(this.node.id);
  }

  toggleRoutesPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.routesExpanded = !this.routesExpanded;
    this.routeTableExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.routesExpanded,
      routeCount: this.routeEntries.length,
    });
  }

  toggleSubnetsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.subnetsExpanded = !this.subnetsExpanded;
    this.virtualNetworkExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.subnetsExpanded,
      subnetCount: this.subnetEntries.length,
    });
  }

  get nsgRuleEntries(): NsgRuleView[] {
    return mapNsgRuleEntries(this.node.metadata?.properties ?? {});
  }

  toggleNsgRulesPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nsgRulesExpanded = !this.nsgRulesExpanded;
    this.nsgExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.nsgRulesExpanded,
      ruleCount: this.nsgRuleEntries.length,
    });
  }

  toggleStorageDetailsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.storageDetailsExpanded = !this.storageDetailsExpanded;

    if (this.storageDetailsExpanded && !this.storageDetailsLoaded && !this.storageDetailsLoading) {
      this.storageDetailsLoading = true;
      this.storageDetailsError = null;
      // Emit preliminary expand so canvas resizes the node while loading
      this.storageAccountExpansionChanged.emit({ nodeId: this.node.id, expanded: true, itemCount: 3 });

      const resourceId = (this.node.metadata?.id as string | undefined) ?? this.node.id;
      this.storageDetailsSvc.getDetails(resourceId)
        .then(details => {
          this._storageDetails = details;
          this.storageDetailsLoaded = true;
          this.storageDetailsLoading = false;
          this.storageAccountExpansionChanged.emit({
            nodeId: this.node.id, expanded: true, itemCount: this.storageItemCount,
          });
        })
        .catch(err => {
          this.storageDetailsLoading = false;
          this.storageDetailsError = 'Failed to load storage details';
          console.warn('[ZureMap] Storage details fetch failed:', err);
        });
    } else {
      this.storageAccountExpansionChanged.emit({
        nodeId: this.node.id,
        expanded: this.storageDetailsExpanded,
        itemCount: this.storageItemCount,
      });
    }
  }

  async toggleUaiRoleAssignmentsPanel(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.uaiAssignmentsExpanded = !this.uaiAssignmentsExpanded;

    if (this.uaiAssignmentsExpanded && !this.uaiAssignmentsLoaded && !this.uaiAssignmentsLoading) {
      const principalId = (this.node.metadata?.properties?.['principalId'] as string | undefined)?.trim();
      const subscriptionId = this.node.metadata?.subscriptionId?.trim();
      if (!principalId || !subscriptionId) {
        this.uaiAssignmentsError = 'Principal or subscription metadata is missing.';
        this.uaiExpansionChanged.emit({
          nodeId: this.node.id,
          expanded: true,
          assignmentCount: 0,
        });
        return;
      }

      this.uaiAssignmentsLoading = true;
      this.uaiAssignmentsError = null;
      this.uaiExpansionChanged.emit({ nodeId: this.node.id, expanded: true, assignmentCount: 2 });

      try {
        const assignments = await this.uaiRoleAssignmentsSvc.getAssignments(principalId, subscriptionId);
        this.uaiRoleAssignments = assignments.map(this.toUaiRoleAssignmentView);
        this.uaiAssignmentsLoaded = true;
        this.uaiAssignmentsLoading = false;
        this.uaiExpansionChanged.emit({
          nodeId: this.node.id,
          expanded: true,
          assignmentCount: this.uaiRoleAssignments.length,
        });
      } catch (err) {
        this.uaiAssignmentsLoading = false;
        this.uaiAssignmentsError = 'Failed to load role assignments';
        console.warn('[ZureMap] UAI role assignment fetch failed:', err);
      }
      return;
    }

    this.uaiExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.uaiAssignmentsExpanded,
      assignmentCount: this.uaiRoleAssignments.length,
    });
  }

  toggleHostingEnvironmentStatsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.hostingEnvironmentStatsExpanded = !this.hostingEnvironmentStatsExpanded;
    this.hostingEnvironmentExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.hostingEnvironmentStatsExpanded,
      statCount: this.hostingEnvironmentStats.length,
    });
  }

  toggleServerFarmStatsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.serverFarmStatsExpanded = !this.serverFarmStatsExpanded;
    this.serverFarmExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.serverFarmStatsExpanded,
      statCount: this.serverFarmStats.length,
    });
  }

  togglePublicIpPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.publicIpExpanded = !this.publicIpExpanded;
    this.publicIpExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.publicIpExpanded,
      detailCount: this.publicIpDetails.length,
    });
  }

  toggleSchedulePanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.scheduleExpanded = !this.scheduleExpanded;
    this.scheduleExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.scheduleExpanded,
      detailCount: this.scheduleDetails.length,
    });
  }

  toggleDiskPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.diskExpanded = !this.diskExpanded;
    this.diskExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.diskExpanded,
      detailCount: this.diskDetails.length,
    });
  }

  toggleAzureFirewallPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.azureFirewallExpanded = !this.azureFirewallExpanded;
    if (this.azureFirewallExpanded && !this.azureFirewallCountsLoaded && !this.azureFirewallCountsLoading) {
      this.azureFirewallCountsLoading = true;
      this.azureFirewallCountsError = null;
      const firewallId = (this.node.metadata?.id as string | undefined) ?? this.node.id;
      this.azureFirewallDetailsSvc.getPolicyRuleCounts(firewallId)
        .then(counts => {
          this.azureFirewallPolicyCounts = counts;
          this.azureFirewallCountsLoaded = true;
          this.azureFirewallCountsLoading = false;
          this.azureFirewallExpansionChanged.emit({
            nodeId: this.node.id,
            expanded: true,
            detailCount: this.azureFirewallDetails.length,
          });
        })
        .catch(err => {
          this.azureFirewallCountsLoading = false;
          this.azureFirewallCountsError = 'Failed to load policy rule counts';
          console.warn('[ZureMap] Azure Firewall policy rule count fetch failed:', err);
        });
    }
    this.azureFirewallExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.azureFirewallExpanded,
      detailCount: this.azureFirewallDetails.length,
    });
  }

  toggleApplicationGatewayPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.applicationGatewayExpanded = !this.applicationGatewayExpanded;
    this.applicationGatewayExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.applicationGatewayExpanded,
      detailCount: this.applicationGatewayDetails.length,
    });
  }

  toggleConnectionPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.connectionExpanded = !this.connectionExpanded;
    this.connectionExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.connectionExpanded,
      detailCount: this.connectionDetails.length,
    });
  }

  get isDnsZone(): boolean {
    return isDnsZoneKind(this.node.resourceType);
  }

  get dnsRecords(): DnsRecord[] {
    return this._dnsRecords;
  }

  toggleDnsRecordsPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dnsRecordsExpanded = !this.dnsRecordsExpanded;

    if (this.dnsRecordsExpanded && !this.dnsRecordsLoaded && !this.dnsRecordsLoading) {
      this.dnsRecordsLoading = true;
      this.dnsRecordsError = null;
      this.dnsZoneExpansionChanged.emit({ nodeId: this.node.id, expanded: true, recordCount: 2 });

      const zoneId = (this.node.metadata?.id as string | undefined) ?? this.node.id;
      this.dnsRecordsSvc.getRecords(zoneId)
        .then(details => {
          this._dnsRecords = details.records;
          this.dnsRecordsLoaded = true;
          this.dnsRecordsLoading = false;
          this.dnsZoneExpansionChanged.emit({
            nodeId: this.node.id,
            expanded: true,
            recordCount: this._dnsRecords.length,
          });
        })
        .catch(err => {
          this.dnsRecordsLoading = false;
          this.dnsRecordsError = 'Failed to load DNS records';
          console.warn('[ZureMap] DNS records fetch failed:', err);
        });
    } else {
      this.dnsZoneExpansionChanged.emit({
        nodeId: this.node.id,
        expanded: this.dnsRecordsExpanded,
        recordCount: this._dnsRecords.length,
      });
    }
  }

  toggleVmPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.vmExpanded = !this.vmExpanded;
    this.vmExpansionChanged.emit({ nodeId: this.node.id, expanded: this.vmExpanded });
  }

  toggleAksPanel(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.aksExpanded = !this.aksExpanded;
    this.aksExpansionChanged.emit({
      nodeId: this.node.id,
      expanded: this.aksExpanded,
      nodePoolCount: this.aksInfo.nodePools.length,
    });
  }

  private toUaiRoleAssignmentView(assignment: UaiRoleAssignment): UaiRoleAssignmentView {
    return {
      id: assignment.id,
      roleDefinitionName: assignment.roleDefinitionName || 'Unknown role',
      scope: assignment.scope || 'Unknown scope',
      principalType: assignment.principalType || 'Principal',
      description: assignment.description ?? null,
    };
  }

  private countAzureFirewallRules(kind: 'application' | 'network' | 'nat', props: Record<string, unknown>): number | null {
    const key = kind === 'application' ? 'application' : kind === 'network' ? 'network' : 'nat';
    const candidates = [
      `${key}RuleCollections`,
      `properties.${key}RuleCollections`,
      `additionalProperties.${key}RuleCollections`,
      `firewallPolicy.properties.ruleCollectionGroups`,
      `ruleCollectionGroups`,
      `ruleCollections`,
    ];

    let best: number | null = null;
    for (const path of candidates) {
      const value = getPath(props, path);
      const count = this.estimateRuleCount(value, key, path);
      if (count === null) continue;
      if (best === null || count > best) best = count;
    }

    const policyId = pickText(props, ['firewallPolicy.id']);
    const policyCount = this.countAzureFirewallPolicyRules(key, policyId);
    if (policyCount !== null && (best === null || policyCount > best)) {
      best = policyCount;
    }

    return best;
  }

  private countAzureFirewallPolicyRules(
    kind: 'application' | 'network' | 'nat',
    firewallPolicyId: string | null,
  ): number | null {
    if (!firewallPolicyId) return null;
    const policyId = firewallPolicyId.toLowerCase();
    const nodes = this.store.nodes();

    const policyNode = nodes.find(n =>
      n.resourceType.toLowerCase() === 'microsoft.network/firewallpolicies' &&
      n.id.toLowerCase() === policyId,
    );

    const groupNodes = nodes.filter(n =>
      n.resourceType.toLowerCase() === 'microsoft.network/firewallpolicies/rulecollectiongroups' &&
      n.id.toLowerCase().startsWith(`${policyId}/rulecollectiongroups/`),
    );

    const counts: number[] = [];

    if (policyNode) {
      const policyGroups = getPath(policyNode.metadata?.properties ?? {}, 'ruleCollectionGroups');
      const count = this.estimateRuleCount(policyGroups, kind, 'policy.ruleCollectionGroups');
      if (count !== null) counts.push(count);
    }

    for (const groupNode of groupNodes) {
      const ruleCollections = getPath(groupNode.metadata?.properties ?? {}, 'ruleCollections');
      const count = this.estimateRuleCount(ruleCollections, kind, 'ruleCollectionGroups.ruleCollections');
      if (count !== null) counts.push(count);
    }

    if (counts.length === 0) return null;
    return Math.max(...counts);
  }

  private estimateRuleCount(
    value: unknown,
    kind: 'application' | 'network' | 'nat',
    sourcePath: string,
  ): number | null {
    if (!Array.isArray(value)) return null;
    if (value.length === 0) return 0;

    let matchedCollections = 0;
    let matchedRules = 0;

    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const props = (item['properties'] as Record<string, unknown> | undefined) ?? item;

      const typeText = [
        toDisplayText(item['ruleCollectionType']),
        toDisplayText(props['ruleCollectionType']),
        toDisplayText(item['type']),
        toDisplayText(props['type']),
        toDisplayText(item['name']),
        toDisplayText(props['name']),
      ].filter((t): t is string => !!t).join(' ').toLowerCase();

      const matchesKind = typeText.includes(`${kind}rule`) || typeText.includes(kind);
      const rules = (props['rules'] as unknown[] | undefined) ?? (item['rules'] as unknown[] | undefined) ?? [];
      const ruleCount = Array.isArray(rules) ? rules.length : 0;
      let matchedRulesByType = 0;
      if (Array.isArray(rules)) {
        for (const rawRule of rules) {
          if (!rawRule || typeof rawRule !== 'object') continue;
          const rule = rawRule as Record<string, unknown>;
          const ruleTypeText = [
            toDisplayText(rule['ruleType']),
            toDisplayText(rule['type']),
            toDisplayText(rule['name']),
          ].filter((t): t is string => !!t).join(' ').toLowerCase();
          if (ruleTypeText.includes(`${kind}rule`) || ruleTypeText.includes(kind)) {
            matchedRulesByType += 1;
          }
        }
      }

      if (matchedRulesByType > 0) {
        matchedCollections += 1;
        matchedRules += matchedRulesByType;
      } else if (matchesKind) {
        matchedCollections += 1;
        matchedRules += ruleCount;
      } else if (sourcePath.toLowerCase().includes(`${kind}rule`)) {
        // Collection path itself encodes the rule type (e.g. networkRuleCollections).
        matchedCollections += 1;
        matchedRules += ruleCount;
      }
    }

    if (matchedCollections === 0) return null;
    return matchedRules > 0 ? matchedRules : matchedCollections;
  }

  stopEvent(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onPortMouseDown(event: MouseEvent, portId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.portMouseDown.emit({ event, portId });
  }

  onInternalItemMouseDown(event: MouseEvent, item: NodeInternalItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.internalDrag = {
      itemId: item.id,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startX: item.x,
      startY: item.y,
    };
  }

  onResizeMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeDrag = {
      startMouseX: event.clientX,
      startMouseY: event.clientY,
      startW: this.node.size.width,
      startH: this.node.size.height,
    };
  }

  onRotateHandleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.nodeRotateStarted.emit(this.node.id);
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    this.rotateDrag = {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent): void {
    if (this.resizeDrag) {
      const scale = Math.max(0.1, this.zoomLevel || 1);
      const dx = (event.clientX - this.resizeDrag.startMouseX) / scale;
      const dy = (event.clientY - this.resizeDrag.startMouseY) / scale;
      const width = Math.max(100, Math.min(1200, Math.round(this.resizeDrag.startW + dx)));
      const height = Math.max(70, Math.min(1200, Math.round(this.resizeDrag.startH + dy)));
      this.nodeResized.emit({ nodeId: this.node.id, width, height });
      return;
    }
    if (this.rotateDrag) {
      const dx = event.clientX - this.rotateDrag.cx;
      const dy = event.clientY - this.rotateDrag.cy;
      const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
      this.nodeRotated.emit({ nodeId: this.node.id, angle });
      return;
    }
    if (!this.internalDrag) return;
    const scale = Math.max(0.1, this.zoomLevel || 1);
    const dx = (event.clientX - this.internalDrag.startMouseX) / scale;
    const dy = (event.clientY - this.internalDrag.startMouseY) / scale;
    const x = Math.max(2, Math.min(this.node.size.width - 24, this.internalDrag.startX + dx));
    const y = Math.max(2, Math.min(this.node.size.height - 20, this.internalDrag.startY + dy));
    this.internalItemMoved.emit({ nodeId: this.node.id, itemId: this.internalDrag.itemId, x, y });
  }

  @HostListener('document:mouseup')
  onDocMouseUp(): void {
    this.internalDrag = null;
    this.resizeDrag = null;
    this.rotateDrag = null;
  }
}
