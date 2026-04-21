import { Component, inject, NgZone, OnInit, signal } from '@angular/core';
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

interface ConnectionType {
  color: string;
  name: string;
  description: string;
}

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
              <div class="w-6 h-6 border-2 border-azure-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-sm text-gray-600">Checking Azure CLI login status...</p>
            </div>
          }

          @case ('authenticating') {
            <div class="text-center py-4">
              <div class="w-12 h-12 border-4 border-azure-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-gray-700 font-medium">Opening Azure login in your browser...</p>
              <p class="text-sm text-gray-400 mt-2">Complete the sign-in then return here.</p>
            </div>
          }

          @case ('selecting-subscription') {
            <app-subscription-selector
              [subscriptions]="store.availableSubscriptions()"
              (confirmed)="onSubscriptionsSelected($event)"
            />
          }

          @case ('selecting-options') {
            <div>
              <h2 class="text-base font-semibold text-gray-900 mb-1">Configure Scan</h2>
              <p class="text-sm text-gray-500 mb-5">
                Ready to scan
                <span class="font-medium text-gray-700">{{ store.activeSubscriptions().length }} subscription{{ store.activeSubscriptions().length !== 1 ? 's' : '' }}</span>.
                Choose what to include in your diagram.
              </p>

              <div class="border border-gray-200 rounded-lg p-4 mb-5">
                <div class="flex items-start justify-between gap-4 mb-1">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-800">Generate Connections</h3>
                    <p class="text-xs text-gray-500 mt-0.5 max-w-xs">
                      Detect relationships between resources and draw arrows on your diagram.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="optionsGenerateConnections = !optionsGenerateConnections"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none"
                    [class.bg-azure-blue]="optionsGenerateConnections"
                    [class.bg-gray-300]="!optionsGenerateConnections"
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
                      [class.translate-x-6]="optionsGenerateConnections"
                      [class.translate-x-1]="!optionsGenerateConnections"
                    ></span>
                  </button>
                </div>

                @if (optionsGenerateConnections) {
                  <div class="mt-4 pt-3 border-t border-gray-100">
                    <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Connection types</p>
                    <div class="space-y-2.5">
                      @for (ct of connectionTypes; track ct.name) {
                        <div class="flex items-start gap-2.5">
                          <span
                            class="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-0.5"
                            [style.background-color]="ct.color"
                          ></span>
                          <p class="text-xs text-gray-600 leading-snug">
                            <span class="font-medium">{{ ct.name }}</span>
                            <span class="text-gray-400"> — {{ ct.description }}</span>
                          </p>
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <p class="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                    Your diagram will show resources and containers only, with no connection arrows.
                  </p>
                }
              </div>

              <button
                type="button"
                (click)="confirmOptions()"
                class="w-full py-2.5 px-4 bg-azure-blue text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Start Scan
              </button>
            </div>
          }

          @case ('scanning') {
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm font-semibold text-gray-800">Scanning Azure Resources</span>
                <span class="text-xs font-semibold text-azure-blue tabular-nums">{{ progressPercent }}%</span>
              </div>

              <div class="w-full bg-gray-100 rounded-full h-1 mb-5 overflow-hidden">
                <div
                  class="bg-azure-blue h-1 rounded-full transition-all duration-700 ease-out"
                  [style.width.%]="progressPercent"
                ></div>
              </div>

              <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                <div class="w-4 h-4 border-2 border-azure-blue border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <span class="text-sm text-gray-700">{{ store.scanProgress().label }}</span>
              </div>

              @if (scanSteps().length > 0) {
                <div class="mb-4 rounded-lg border border-gray-200 bg-white p-3">
                  <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Scan Plan</p>
                  <div class="space-y-1.5">
                    @for (step of scanSteps(); track $index) {
                      <div class="flex items-center gap-2 text-xs">
                        <span
                          class="inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] font-bold"
                          [class.bg-green-100]="step.status === 'done'"
                          [class.text-green-700]="step.status === 'done'"
                          [class.bg-blue-100]="step.status === 'active'"
                          [class.text-blue-700]="step.status === 'active'"
                          [class.bg-gray-100]="step.status === 'pending'"
                          [class.text-gray-500]="step.status === 'pending'"
                        >
                          @if (step.status === 'done') { &#10003; } @else { {{ $index + 1 }} }
                        </span>
                        <span
                          [class.text-gray-800]="step.status !== 'pending'"
                          [class.font-medium]="step.status === 'active'"
                          [class.text-gray-500]="step.status === 'pending'"
                        >
                          {{ step.name }}
                        </span>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (progressLog().length > 0) {
                <div class="space-y-2">
                  @for (entry of progressLog(); track $index) {
                    <div class="flex items-start gap-2 text-xs text-gray-500">
                      <span class="text-green-500 font-bold flex-shrink-0 leading-none mt-0.5">&#10003;</span>
                      <span>{{ entry }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @case ('laying-out') {
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-sm font-semibold text-gray-800">Computing Layout</span>
                <span class="text-xs text-gray-400">ELK engine</span>
              </div>

              <div class="w-full bg-gray-100 rounded-full h-1 mb-5 overflow-hidden">
                <div class="bg-azure-blue h-1 rounded-full animate-pulse" style="width: 85%"></div>
              </div>

              <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                <div class="w-4 h-4 border-2 border-azure-blue border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <span class="text-sm text-gray-700">{{ store.scanProgress().label }}</span>
              </div>

              @if (scanSteps().length > 0) {
                <div class="mb-4 rounded-lg border border-gray-200 bg-white p-3">
                  <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Scan Plan</p>
                  <div class="space-y-1.5">
                    @for (step of scanSteps(); track $index) {
                      <div class="flex items-center gap-2 text-xs">
                        <span
                          class="inline-flex w-4 h-4 items-center justify-center rounded-full text-[10px] font-bold"
                          [class.bg-green-100]="step.status === 'done'"
                          [class.text-green-700]="step.status === 'done'"
                          [class.bg-blue-100]="step.status === 'active'"
                          [class.text-blue-700]="step.status === 'active'"
                          [class.bg-gray-100]="step.status === 'pending'"
                          [class.text-gray-500]="step.status === 'pending'"
                        >
                          @if (step.status === 'done') { &#10003; } @else { {{ $index + 1 }} }
                        </span>
                        <span
                          [class.text-gray-800]="step.status !== 'pending'"
                          [class.font-medium]="step.status === 'active'"
                          [class.text-gray-500]="step.status === 'pending'"
                        >
                          {{ step.name }}
                        </span>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (progressLog().length > 0) {
                <div class="space-y-2">
                  @for (entry of progressLog(); track $index) {
                    <div class="flex items-start gap-2 text-xs text-gray-500">
                      <span class="text-green-500 font-bold flex-shrink-0 leading-none mt-0.5">&#10003;</span>
                      <span>{{ entry }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @case ('error') {
            <div class="text-center py-4">
              <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="text-red-600 text-xl font-bold">&#10005;</span>
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
  private zone = inject(NgZone);

  needsLogin = false;
  optionsGenerateConnections = true;
  progressLog = signal<string[]>([]);
  scanSteps = signal<Array<{ name: string; status: 'pending' | 'active' | 'done' }>>([]);

  readonly connectionTypes: ConnectionType[] = [
    {
      color: '#0078d4',
      name: 'Private Link',
      description: 'Private Endpoints connecting to PaaS services (Storage, Key Vault, SQL, etc.)',
    },
    {
      color: '#107c10',
      name: 'VNet Peering',
      description: 'Cross-VNet peering connections for network traffic routing',
    },
    {
      color: '#605e5c',
      name: 'VNet / Subnets',
      description: 'Virtual Networks linked to their subnet children',
    },
    {
      color: '#ca5010',
      name: 'NSG Associations',
      description: 'Network Security Groups attached to network interfaces and subnets',
    },
    {
      color: '#a19f9d',
      name: 'SQL Hierarchy',
      description: 'SQL Databases linked to their parent SQL Server resources',
    },
  ];

  get progressPercent(): number {
    const p = this.store.scanProgress();
    return p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
  }

  ngOnInit(): void {
    this.startScan();
  }

  startScan(): void {
    this.needsLogin = false;
    this.optionsGenerateConnections = true;
    this.progressLog.set([]);
    this.scanSteps.set([]);
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
    this.store.scanPhase.set('selecting-options');
  }

  confirmOptions(): void {
    const subIds = this.store.activeSubscriptions().map(s => s.subscriptionId);
    this.runScan(subIds);
  }

  private async runScan(subscriptionIds: string[]): Promise<void> {
    const addLog = (msg: string) => {
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      this.zone.run(() => this.progressLog.update(log => [...log, `[${stamp}] ${msg}`]));
    };
    const setProgress = (current: number, total: number, label: string) => {
      this.zone.run(() => {
        this.store.scanProgress.set({ current, total, label });
        this.scanSteps.update(steps =>
          steps.map((s, i) => ({
            ...s,
            status: i + 1 < current ? 'done' : i + 1 === current ? 'active' : 'pending',
          }))
        );
      });
    };

    this.zone.run(() => {
      this.store.clearDiagram();
      this.store.scanPhase.set('scanning');
      this.progressLog.set([]);
    });

    try {
      const subLabel = subscriptionIds.length === 1 ? '1 subscription' : `${subscriptionIds.length} subscriptions`;
      const totalSteps = this.optionsGenerateConnections ? 6 : 5;
      this.zone.run(() => {
        this.scanSteps.set([
          { name: `Query resources across ${subLabel}`, status: 'pending' },
          { name: 'Fetch virtual network topology', status: 'pending' },
          { name: 'Resolve private endpoints', status: 'pending' },
          { name: 'Map resources to diagram nodes', status: 'pending' },
          ...(this.optionsGenerateConnections ? [{ name: 'Build resource connections', status: 'pending' as const }] : []),
          { name: 'Compute automatic layout (ELK)', status: 'pending' },
        ]);
      });
      addLog(`Starting scan for ${subLabel}`);
      addLog(`Connection generation: ${this.optionsGenerateConnections ? 'enabled' : 'disabled'}`);

      setProgress(1, totalSteps, `Querying all resources across ${subLabel}...`);
      const allResources = await this.resourceGraph.queryAllResources(subscriptionIds).toPromise() ?? [];
      addLog(`Discovered ${allResources.length} resource${allResources.length !== 1 ? 's' : ''} across ${subLabel}`);

      setProgress(2, totalSteps, 'Fetching virtual network topology...');
      const vnetResources = await this.resourceGraph.queryVNetTopology(subscriptionIds).toPromise() ?? [];
      const vnetCount = vnetResources.filter(r => r.type.toLowerCase() === 'microsoft.network/virtualnetworks').length;
      addLog(`Fetched VNet topology — ${vnetCount} virtual network${vnetCount !== 1 ? 's' : ''}`);

      setProgress(3, totalSteps, 'Resolving private endpoints...');
      const peResources = await this.resourceGraph.queryPrivateEndpoints(subscriptionIds).toPromise() ?? [];
      addLog(`Resolved ${peResources.length} private endpoint${peResources.length !== 1 ? 's' : ''}`);

      const merged = this.mergeDedup([...allResources, ...vnetResources, ...peResources]);

      setProgress(4, totalSteps, `Mapping ${merged.length} resources to diagram nodes...`);
      const nodes = this.mapper.mapResources(merged);
      addLog(`Mapped ${nodes.length} diagram node${nodes.length !== 1 ? 's' : ''} with hierarchy`);

      let edges: ReturnType<ConnectionResolverService['resolveAll']> = [];
      if (this.optionsGenerateConnections) {
        setProgress(5, totalSteps, 'Building connections between resources...');
        edges = this.connectionResolver.resolveAll(merged, nodes);
        const byType = edges.reduce<Record<string, number>>((acc, e) => {
          acc[e.edgeType] = (acc[e.edgeType] ?? 0) + 1;
          return acc;
        }, {});
        const summary = Object.entries(byType)
          .map(([t, n]) => `${n} ${t}`)
          .join(', ');
        addLog(`Built ${edges.length} connection${edges.length !== 1 ? 's' : ''}${edges.length > 0 ? ` (${summary})` : ''}`);
      } else {
        addLog('Connection generation skipped');
      }

      this.zone.run(() => { this.store.setNodes(nodes); this.store.setEdges(edges); });

      const layoutLabel = `Arranging ${nodes.length} nodes${edges.length > 0 ? ` and ${edges.length} edges` : ''} with ELK...`;
      setProgress(totalSteps, totalSteps, layoutLabel);
      this.zone.run(() => this.store.scanPhase.set('laying-out'));

      const positioned = await this.elkLayout.layout(nodes, edges);
      this.zone.run(() => this.store.setNodes(positioned));

      this.zone.run(() => {
        this.scanSteps.update(steps => steps.map(s => ({ ...s, status: 'done' })));
        this.store.scanPhase.set('ready');
        this.router.navigate(['/canvas']);
      });
    } catch (err: unknown) {
      this.zone.run(() => {
        this.store.scanPhase.set('error');
        this.store.errorMessage.set(err instanceof Error ? err.message : 'Scan failed');
      });
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
