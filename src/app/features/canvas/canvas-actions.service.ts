import { ElementRef, Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DriftService } from '../../core/services/drift.service';
import { ExportService, ExportImageOptions } from '../../core/services/export.service';
import { DiagramStore } from '../../core/store/diagram.store';
import { CanvasFinopsService } from './canvas-finops.service';
import { FinOpsPeriodPreset, FinOpsRequestParams, FinOpsV2Response } from '../../core/models/cost-data.model';

export type FinOpsLoadState = 'idle' | 'loading' | 'success' | 'partial' | 'error';

@Injectable({ providedIn: 'root' })
export class CanvasActionsService {
  private store = inject(DiagramStore);
  private driftSvc = inject(DriftService);
  private exportSvc = inject(ExportService);
  private finops = inject(CanvasFinopsService);
  private router = inject(Router);

  finOpsDrawerOpen = false;
  finOpsState: FinOpsLoadState = 'idle';
  finOpsStale = false;
  finOpsError: string | null = null;
  finOpsPayload: FinOpsV2Response | null = null;

  private finOpsParams: FinOpsRequestParams = {
    periodPreset: 'mtd',
    filters: {
      subscriptionIds: [],
      resourceGroup: [],
      resourceType: [],
    },
    includeTrend: true,
    baseCurrency: 'EUR',
    resourceIds: [],
  };

  async toggleFinOpsDrawer(): Promise<void> {
    this.finOpsDrawerOpen = !this.finOpsDrawerOpen;
    if (!this.finOpsDrawerOpen) return;
    if (this.finOpsState === 'idle' || this.finOpsStale) {
      await this.refreshFinOps();
    }
  }

  get finOpsPeriodPreset(): FinOpsPeriodPreset {
    return this.finOpsParams.periodPreset;
  }

  get finOpsBaseCurrency(): string {
    return this.finOpsParams.baseCurrency;
  }

  get selectedSubscriptionIds(): string[] {
    const active = this.activeSubscriptionIds;
    if (this.finOpsParams.filters.subscriptionIds.length === 0) return active;
    return this.finOpsParams.filters.subscriptionIds;
  }

  get selectedResourceGroups(): string[] {
    return this.finOpsParams.filters.resourceGroup;
  }

  get selectedResourceTypes(): string[] {
    return this.finOpsParams.filters.resourceType;
  }

  setFinOpsPeriodPreset(periodPreset: FinOpsPeriodPreset): void {
    if (this.finOpsParams.periodPreset === periodPreset) return;
    this.finOpsParams = { ...this.finOpsParams, periodPreset };
    this.markFinOpsStale();
  }

  setSelectedSubscriptionIds(subscriptionIds: string[]): void {
    this.finOpsParams = {
      ...this.finOpsParams,
      filters: {
        ...this.finOpsParams.filters,
        subscriptionIds,
      },
    };
    this.markFinOpsStale();
  }

  setSelectedResourceGroups(resourceGroup: string[]): void {
    this.finOpsParams = {
      ...this.finOpsParams,
      filters: {
        ...this.finOpsParams.filters,
        resourceGroup,
      },
    };
    this.markFinOpsStale();
  }

  setSelectedResourceTypes(resourceType: string[]): void {
    this.finOpsParams = {
      ...this.finOpsParams,
      filters: {
        ...this.finOpsParams.filters,
        resourceType,
      },
    };
    this.markFinOpsStale();
  }

  async applyFinOpsFilters(): Promise<void> {
    await this.refreshFinOps();
  }

  async refreshFinOps(): Promise<void> {
    const subIds = this.activeSubscriptionIds;
    if (subIds.length === 0) {
      this.finOpsState = 'error';
      this.finOpsError = 'No active subscriptions selected. Re-scan and select at least one subscription.';
      this.store.finOpsLayerActive.set(false);
      return;
    }

    const requestedSubIds = this.selectedSubscriptionIds.filter(s => subIds.includes(s));
    const effectiveSubIds = requestedSubIds.length > 0 ? requestedSubIds : subIds;

    this.finOpsState = 'loading';
    this.finOpsError = null;

    const request: FinOpsRequestParams = {
      ...this.finOpsParams,
      filters: {
        ...this.finOpsParams.filters,
        subscriptionIds: effectiveSubIds,
      },
      resourceIds: this.store.nodes().map(n => n.id),
    };

    try {
      const { nodes: nextNodes, payload } = await this.finops.loadFinOps(this.store.nodes(), request);
      if (!payload) {
        this.finOpsState = 'error';
        this.finOpsError = 'Failed to load FinOps data. Ensure proxy is running and Cost Management Reader access is granted.';
        return;
      }

      this.finOpsPayload = payload;
      this.finOpsStale = false;
      this.store.finOpsLayerActive.set(true);
      this.store.setNodes(nextNodes);

      this.finOpsState = payload.failedSubscriptionCount > 0 ? 'partial' : 'success';
      if (!nextNodes.some(n => n.costData)) {
        this.finOpsError = 'Cost query returned no mapped resources for the selected period and filters.';
      }
    } catch {
      this.finOpsState = 'error';
      this.finOpsError = 'Failed to load FinOps data. Ensure proxy is running and Cost Management Reader access is granted.';
    }
  }

  private markFinOpsStale(): void {
    this.finOpsStale = true;
  }

  private get activeSubscriptionIds(): string[] {
    return [...new Set(this.store.activeSubscriptions().map(s => s.subscriptionId))];
  }

  get finOpsSubscriptionOptions(): { id: string; label: string }[] {
    return this.store.activeSubscriptions().map(s => ({ id: s.subscriptionId, label: s.name || s.subscriptionId }));
  }

  get finOpsResourceGroupOptions(): string[] {
    const fromNodes = new Set(this.store.nodes().map(n => n.metadata.resourceGroup).filter(Boolean));
    return [...fromNodes].sort((a, b) => a.localeCompare(b));
  }

  get finOpsResourceTypeOptions(): string[] {
    const fromNodes = new Set(this.store.nodes().map(n => n.resourceType).filter(Boolean));
    return [...fromNodes].sort((a, b) => a.localeCompare(b));
  }

  get finOpsCostedNodeCount(): number {
    return this.store.nodes().filter(n => n.costData !== undefined).length;
  }

  get finOpsTopNodes(): { id: string; label: string; cost: number }[] {
    return this.store.nodes()
      .filter(n => n.costData !== undefined)
      .sort((a, b) => (b.costData?.monthlyCostUsd ?? 0) - (a.costData?.monthlyCostUsd ?? 0))
      .slice(0, 8)
      .map(n => ({ id: n.id, label: n.label, cost: n.costData?.monthlyCostUsd ?? 0 }));
  }

  get finOpsLegend(): { label: string; color: string }[] {
    return [
      { label: 'Unknown / not mapped', color: '#605e5c' },
      { label: '< 10', color: '#107c10' },
      { label: '10 - 49', color: '#ffb900' },
      { label: '50 - 199', color: '#ca5010' },
      { label: '200+', color: '#d13438' },
    ];
  }

  formatCurrency(value: number, currency = 'EUR'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  toggleDrift(): void {
    if (!this.store.comparisonMode()) {
      this.store.setNodes(this.driftSvc.computeDrift(this.store.baselineNodes(), this.store.nodes()));
      this.store.comparisonMode.set(true);
      return;
    }

    this.store.comparisonMode.set(false);
    this.store.setNodes(this.store.nodes().map(n => ({ ...n, driftStatus: undefined })));
  }

  async exportImage(exportRootRef: ElementRef, options: ExportImageOptions): Promise<void> {
    const state = {
      version: '1.0' as const,
      exportedAt: new Date().toISOString(),
      subscriptions: this.store.activeSubscriptions(),
      nodes: this.store.nodes(),
      edges: this.store.edges(),
      annotations: this.store.annotations(),
    };
    await this.exportSvc.exportImage(exportRootRef, options, state);
  }

  exportJson(): void {
    this.exportSvc.exportJSON(this.store.nodes(), this.store.edges(), this.store.activeSubscriptions(), this.store.annotations());
  }

  async onImportFile(file: File): Promise<void> {
    try {
      const state = await this.exportSvc.importFile(file);
      this.store.clearDiagram();
      this.store.activeSubscriptions.set(state.subscriptions ?? []);
      this.store.setNodes(state.nodes ?? []);
      this.store.setEdges(state.edges ?? []);
      this.store.annotations.set(state.annotations ?? []);
      this.store.loadBaseline(state.nodes ?? []);
    } catch {
      console.error('Failed to import file');
    }
  }

  rescan(): void {
    this.store.clearDiagram();
    this.router.navigate(['/scan']);
  }
}
