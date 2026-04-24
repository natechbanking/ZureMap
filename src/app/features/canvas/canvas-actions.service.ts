import { ElementRef, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { DriftService } from '../../core/services/drift.service';
import { ExportService, ExportImageOptions } from '../../core/services/export.service';
import { DiagramStore } from '../../core/store/diagram.store';
import { CanvasFinopsService } from './canvas-finops.service';

@Injectable({ providedIn: 'root' })
export class CanvasActionsService {
  finOpsLoading = false;
  finOpsError: string | null = null;
  finOpsLoadedSubscriptions = 0;

  constructor(
    private store: DiagramStore,
    private driftSvc: DriftService,
    private exportSvc: ExportService,
    private finops: CanvasFinopsService,
    private router: Router,
  ) {}

  async toggleFinOps(): Promise<void> {
    const active = !this.store.finOpsLayerActive();
    this.store.finOpsLayerActive.set(active);
    if (!active) return;

    const subIds = [...new Set(this.store.activeSubscriptions().map(s => s.subscriptionId))];
    if (subIds.length === 0) {
      this.finOpsLoadedSubscriptions = 0;
      this.finOpsError = 'No active subscriptions selected. Re-scan and select at least one subscription.';
      return;
    }

    this.finOpsLoading = true;
    this.finOpsError = null;

    try {
      const { nodes: nextNodes, loadedSubscriptions } = await this.finops.loadCostsForSubscriptions(this.store.nodes(), subIds);
      this.finOpsLoadedSubscriptions = loadedSubscriptions;
      this.store.setNodes(nextNodes);

      if (!nextNodes.some(n => n.costData)) {
        this.finOpsError = 'Cost query succeeded but no scanned resources matched cost rows for this period.';
      }
    } catch {
      this.finOpsLoadedSubscriptions = 0;
      this.finOpsError = 'Failed to load cost data. Ensure the proxy is running and you have Cost Management Reader access.';
    } finally {
      this.finOpsLoading = false;
    }
  }

  get finOpsCostedNodeCount(): number {
    return this.store.nodes().filter(n => (n.costData?.monthlyCostUsd ?? 0) > 0).length;
  }

  get finOpsTopNodes(): Array<{ id: string; label: string; cost: number }> {
    return this.store.nodes()
      .filter(n => (n.costData?.monthlyCostUsd ?? 0) > 0)
      .sort((a, b) => (b.costData?.monthlyCostUsd ?? 0) - (a.costData?.monthlyCostUsd ?? 0))
      .slice(0, 5)
      .map(n => ({ id: n.id, label: n.label, cost: n.costData!.monthlyCostUsd }));
  }

  formatUsd(value: number): string {
    return `$${value.toFixed(2)}`;
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
    };
    await this.exportSvc.exportImage(exportRootRef, options, state);
  }

  exportJson(): void {
    this.exportSvc.exportJSON(this.store.nodes(), this.store.edges(), this.store.activeSubscriptions());
  }

  async onImportFile(file: File): Promise<void> {
    try {
      const state = await this.exportSvc.importFile(file);
      this.store.loadBaseline(state.nodes);
    } catch {
      console.error('Failed to import file');
    }
  }

  rescan(): void {
    this.store.clearDiagram();
    this.router.navigate(['/scan']);
  }
}
