import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AzAuthService } from '../../core/services/az-auth.service';
import { ResourceGraphService } from '../../core/services/resource-graph.service';
import { ResourceMapperService } from '../../core/services/resource-mapper.service';
import { ConnectionResolverService } from '../../core/services/connection-resolver.service';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { DiagramStore } from '../../core/store/diagram.store';
import { AzureResource, AzureSubscription } from '../../core/models/azure-resource.model';
import { SubscriptionSelectorComponent } from './subscription-selector/subscription-selector.component';

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [CommonModule, SubscriptionSelectorComponent],
  template: `
    <div class="min-h-screen bg-azure-neutral flex items-center justify-center p-8">
      <div class="bg-white rounded-xl shadow-lg w-full max-w-xl p-8">

        <div class="flex items-center gap-3 mb-8">
          <img src="assets/zuremap-logo.svg" alt="ZureMap" class="w-10 h-10" onerror="this.style.display='none'" />
          <div>
            <h1 class="text-2xl font-bold text-gray-900">ZureMap</h1>
            <p class="text-sm text-gray-500">Azure Architecture Diagram Generator</p>
          </div>
        </div>

        @switch (store.scanPhase()) {
          @case ('idle') {
            <div class="text-center py-4">
              <p class="text-gray-600 mb-6">Checking Azure CLI login status...</p>
            </div>
          }
          @case ('authenticating') {
            <div class="text-center py-4">
              <div class="w-12 h-12 border-4 border-azure-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-gray-600">Opening Azure login in your browser...</p>
              <p class="text-sm text-gray-400 mt-2">Complete the sign-in then return here.</p>
            </div>
          }
          @case ('selecting-subscription') {
            <app-subscription-selector
              [subscriptions]="store.availableSubscriptions()"
              (confirmed)="onSubscriptionsSelected($event)"
            />
          }
          @case ('scanning') {
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-gray-600">{{ store.scanProgress().label }}</span>
                <span class="text-sm font-medium text-azure-blue">
                  {{ store.scanProgress().current }}/{{ store.scanProgress().total }}
                </span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-2">
                <div
                  class="bg-azure-blue h-2 rounded-full transition-all duration-300"
                  [style.width.%]="progressPercent"
                ></div>
              </div>
              <p class="text-xs text-gray-400 mt-2">
                {{ store.nodeCount() }} resource{{ store.nodeCount() !== 1 ? 's' : '' }} discovered
              </p>
            </div>
          }
          @case ('laying-out') {
            <div class="text-center py-4">
              <div class="w-12 h-12 border-4 border-azure-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-gray-600">Computing layout...</p>
            </div>
          }
          @case ('error') {
            <div class="text-center py-4">
              <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-red-600 text-xl">✕</span>
              </div>
              <p class="text-red-600 font-medium mb-2">Scan failed</p>
              <p class="text-sm text-gray-500 mb-4">{{ store.errorMessage() }}</p>
              <button (click)="startScan()" class="text-azure-blue hover:underline text-sm">Try again</button>
            </div>
          }
        }

        @if (needsLogin) {
          <div class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p class="text-sm text-gray-700 mb-3">
              Azure CLI login required. Click below to authenticate.
            </p>
            <button
              (click)="login()"
              class="w-full py-2.5 px-4 bg-azure-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <span>Login with Azure CLI</span>
            </button>
            <p class="text-xs text-gray-400 mt-2 text-center">
              Requires Azure CLI installed and <code>az login</code> access
            </p>
          </div>
        }

      </div>
    </div>
  `,
})
export class ScanComponent implements OnInit {
  store = inject(DiagramStore);
  private auth = inject(AzAuthService);
  private resourceGraph = inject(ResourceGraphService);
  private mapper = inject(ResourceMapperService);
  private connectionResolver = inject(ConnectionResolverService);
  private elkLayout = inject(ELKLayoutService);
  private router = inject(Router);

  needsLogin = false;

  get progressPercent(): number {
    const p = this.store.scanProgress();
    return p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
  }

  ngOnInit(): void {
    this.startScan();
  }

  startScan(): void {
    this.needsLogin = false;
    this.store.scanPhase.set('idle');
    this.store.errorMessage.set(null);

    this.auth.checkLoginStatus().subscribe({
      next: (status) => {
        if (status.loggedIn) {
          this.loadSubscriptions();
        } else {
          this.needsLogin = true;
        }
      },
      error: () => {
        this.needsLogin = true;
      },
    });
  }

  login(): void {
    this.store.scanPhase.set('authenticating');
    this.auth.login().subscribe({
      next: () => this.loadSubscriptions(),
      error: (err) => {
        this.store.scanPhase.set('error');
        this.store.errorMessage.set(err.message ?? 'Login failed');
      },
    });
  }

  private loadSubscriptions(): void {
    this.auth.listSubscriptions().subscribe({
      next: (subs) => {
        this.store.availableSubscriptions.set(subs);
        this.store.scanPhase.set('selecting-subscription');
      },
      error: (err) => {
        this.store.scanPhase.set('error');
        this.store.errorMessage.set(err.message ?? 'Failed to list subscriptions');
      },
    });
  }

  onSubscriptionsSelected(subs: AzureSubscription[]): void {
    this.store.activeSubscriptions.set(subs);
    this.runScan(subs.map(s => s.subscriptionId));
  }

  private async runScan(subscriptionIds: string[]): Promise<void> {
    this.store.scanPhase.set('scanning');
    this.store.clearDiagram();

    try {
      const total = 4;
      const setProgress = (current: number, label: string) =>
        this.store.scanProgress.set({ current, total, label });

      setProgress(1, 'Querying all resources...');
      const allResources = await this.resourceGraph.queryAllResources(subscriptionIds).toPromise() ?? [];

      setProgress(2, 'Fetching VNet topology...');
      const vnetResources = await this.resourceGraph.queryVNetTopology(subscriptionIds).toPromise() ?? [];

      setProgress(3, 'Resolving private endpoints...');
      const peResources = await this.resourceGraph.queryPrivateEndpoints(subscriptionIds).toPromise() ?? [];

      const merged = this.mergeDedup([...allResources, ...vnetResources, ...peResources]);

      setProgress(4, 'Mapping resources to diagram...');
      const nodes = this.mapper.mapResources(merged);
      const edges = this.connectionResolver.resolveAll(merged, nodes);

      this.store.setNodes(nodes);
      this.store.setEdges(edges);

      this.store.scanPhase.set('laying-out');
      const positioned = await this.elkLayout.layout(nodes, edges);
      this.store.setNodes(positioned);

      this.store.scanPhase.set('ready');
      this.router.navigate(['/canvas']);
    } catch (err: unknown) {
      this.store.scanPhase.set('error');
      this.store.errorMessage.set(err instanceof Error ? err.message : 'Scan failed');
    }
  }

  private mergeDedup(resources: AzureResource[]): AzureResource[] {
    const seen = new Map<string, AzureResource>();
    for (const r of resources) {
      if (!seen.has(r.id)) seen.set(r.id, r);
    }
    return Array.from(seen.values());
  }
}
