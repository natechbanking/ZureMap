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
            <div class="space-y-6">
              <div>
                <h2 class="text-base font-semibold text-gray-900 mb-1">Step 2: Configure Diagram</h2>
                <p class="text-sm text-gray-500">
                  Ready to scan
                  <span class="font-medium text-gray-700">{{ store.activeSubscriptions().length }} subscription{{ store.activeSubscriptions().length !== 1 ? 's' : '' }}</span>.
                </p>
              </div>

              <div class="bg-gray-50/50 border border-gray-200 rounded-xl p-4">
                <div class="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h3 class="text-sm font-semibold text-gray-800">Generate Connections</h3>
                    <p class="text-xs text-gray-500 mt-1 max-w-sm">
                      Detect relationships like Private Endpoints and VNet Peering to draw arrows on your diagram.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="optionsGenerateConnections = !optionsGenerateConnections"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-azure-blue"
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
              </div>

              <div>
                <button
                  type="button"
                  (click)="showAdvancedOptions = !showAdvancedOptions"
                  class="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors w-full py-2"
                >
                  <svg
                    class="w-4 h-4 transform transition-transform duration-200"
                    [class.rotate-90]="showAdvancedOptions"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced Options
                </button>

                @if (showAdvancedOptions) {
                  <div class="mt-3 space-y-3 pl-6 border-l-2 border-gray-100">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h4 class="text-xs font-semibold text-gray-700">App Service Slots</h4>
                        <p class="text-[11px] text-gray-500 mt-0.5">Show deployment slots for Web Apps.</p>
                      </div>
                      <button
                        type="button"
                        (click)="optionsIncludeAppSlots = !optionsIncludeAppSlots"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none"
                        [class.bg-azure-blue]="optionsIncludeAppSlots"
                        [class.bg-gray-300]="!optionsIncludeAppSlots"
                      >
                        <span
                          class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                          [class.translate-x-4.5]="optionsIncludeAppSlots"
                          [class.translate-x-0.5]="!optionsIncludeAppSlots"
                        ></span>
                      </button>
                    </div>

                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h4 class="text-xs font-semibold text-gray-700">Network Interfaces (NICs)</h4>
                        <p class="text-[11px] text-gray-500 mt-0.5">Show NIC resources (typically grouped under VMs).</p>
                      </div>
                      <button
                        type="button"
                        (click)="optionsIncludeNetworkInterfaces = !optionsIncludeNetworkInterfaces"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none"
                        [class.bg-azure-blue]="optionsIncludeNetworkInterfaces"
                        [class.bg-gray-300]="!optionsIncludeNetworkInterfaces"
                      >
                        <span
                          class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                          [ngClass]="optionsIncludeNetworkInterfaces ? 'translate-x-4' : 'translate-x-1'"
                        ></span>
                      </button>
                    </div>

                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h4 class="text-xs font-semibold text-gray-700">Managed Identity Edges</h4>
                        <p class="text-[11px] text-gray-500 mt-0.5">Draw connection arrows from UAIs to resources.</p>
                      </div>
                      <button
                        type="button"
                        (click)="optionsUserAssignedIdentityEdges = !optionsUserAssignedIdentityEdges"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none"
                        [class.bg-azure-blue]="optionsUserAssignedIdentityEdges"
                        [class.bg-gray-300]="!optionsUserAssignedIdentityEdges"
                      >
                        <span
                          class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                          [class.translate-x-4.5]="optionsUserAssignedIdentityEdges"
                          [class.translate-x-0.5]="!optionsUserAssignedIdentityEdges"
                        ></span>
                      </button>
                    </div>

                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <h4 class="text-xs font-semibold text-gray-700">Virtual Network Links</h4>
                        <p class="text-[11px] text-gray-500 mt-0.5">Render <code>virtualnetworklinks</code> resources in the diagram.</p>
                      </div>
                      <button
                        type="button"
                        (click)="optionsIncludeVirtualNetworkLinks = !optionsIncludeVirtualNetworkLinks"
                        class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none"
                        [class.bg-azure-blue]="optionsIncludeVirtualNetworkLinks"
                        [class.bg-gray-300]="!optionsIncludeVirtualNetworkLinks"
                      >
                        <span
                          class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
                          [class.translate-x-4.5]="optionsIncludeVirtualNetworkLinks"
                          [class.translate-x-0.5]="!optionsIncludeVirtualNetworkLinks"
                        ></span>
                      </button>
                    </div>
                  </div>
                }
              </div>

              <div class="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  (click)="store.scanPhase.set('selecting-subscription')"
                  class="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200"
                >
                  Back
                </button>
                <button
                  type="button"
                  (click)="confirmOptions()"
                  class="flex-1 py-2.5 px-4 bg-azure-blue text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <span>Start Scan</span>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
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
            <div class="py-2">
              <div class="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span class="text-red-600 text-sm font-bold">&#10005;</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-red-700 mb-1">{{ errorTitle() }}</p>
                  <p class="text-sm text-gray-600 leading-snug">{{ store.errorMessage() }}</p>
                  @if (errorDetail()) {
                    <details class="mt-2">
                      <summary class="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">Show technical detail</summary>
                      <pre class="mt-1.5 text-[10px] text-gray-500 bg-white border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{{ errorDetail() }}</pre>
                    </details>
                  }
                </div>
              </div>
              <button
                (click)="startScan()"
                class="w-full py-2.5 px-4 bg-azure-blue text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
              >
                Try again
              </button>
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
  showAdvancedOptions = false;
  optionsGenerateConnections = true;
  optionsIncludeAppSlots = false;
  optionsIncludeNetworkInterfaces = false;
  optionsUserAssignedIdentityEdges = false;
  optionsIncludeVirtualNetworkLinks = false;
  progressLog = signal<string[]>([]);
  scanSteps = signal<Array<{ name: string; status: 'pending' | 'active' | 'done' }>>([]);
  private scanError = signal<{ code: string; detail: string } | null>(null);

  private static readonly ERROR_TITLES: Record<string, string> = {
    NO_NETWORK: 'No network connectivity',
    AUTH_REQUIRED: 'Authentication required',
    TIMEOUT: 'Request timed out',
    PERMISSION_DENIED: 'Permission denied',
    QUOTA_EXCEEDED: 'Too many requests',
    SERVER_ERROR: 'Unexpected error',
  };

  errorTitle(): string {
    const code = this.scanError()?.code ?? 'SERVER_ERROR';
    return ScanComponent.ERROR_TITLES[code] ?? 'Scan failed';
  }

  errorDetail(): string | null {
    return this.scanError()?.detail ?? null;
  }

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
      color: '#8764b8',
      name: 'Managed Identity Assignments',
      description: 'User-assigned managed identities linked to the resources they are assigned to',
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
    this.optionsIncludeAppSlots = false;
    this.optionsIncludeNetworkInterfaces = false;
    this.optionsUserAssignedIdentityEdges = false;
    this.optionsIncludeVirtualNetworkLinks = false;
    this.progressLog.set([]);
    this.scanSteps.set([]);
    this.scanError.set(null);
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
        this.scanError.set({ code: err.azCode ?? 'SERVER_ERROR', detail: err.azDetail ?? err.message ?? '' });
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
        this.scanError.set({ code: err.azCode ?? 'SERVER_ERROR', detail: err.azDetail ?? err.message ?? '' });
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
      addLog(`Render virtual network links: ${this.optionsIncludeVirtualNetworkLinks ? 'enabled' : 'disabled'}`);

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

      const EXCLUDED_TYPES: string[] = [];
      if (!this.optionsIncludeAppSlots) EXCLUDED_TYPES.push('microsoft.web/sites/slots');
      if (!this.optionsIncludeNetworkInterfaces) EXCLUDED_TYPES.push('microsoft.network/networkinterfaces');
      if (!this.optionsIncludeVirtualNetworkLinks) {
        EXCLUDED_TYPES.push(
          'microsoft.network/dnszones/virtualnetworklinks',
          'microsoft.network/privatednszones/virtualnetworklinks',
          'microsoft.network/dnsforwardingrulesets/virtualnetworklinks',
        );
      }

      const merged = this.mergeDedup([...allResources, ...vnetResources, ...peResources])
        .filter(r => !EXCLUDED_TYPES.includes(r.type.toLowerCase()));

      setProgress(4, totalSteps, `Mapping ${merged.length} resources to diagram nodes...`);
      const nodes = this.mapper.mapResources(merged);
      addLog(`Mapped to ${nodes.length} diagram node${nodes.length !== 1 ? 's' : ''}`);

      let edges: ReturnType<ConnectionResolverService['resolveAll']> = [];
      if (this.optionsGenerateConnections) {
        setProgress(5, totalSteps, 'Building connections between resources...');
        edges = this.connectionResolver.resolveAll(merged, nodes, {
          userAssignedIdentities: this.optionsUserAssignedIdentityEdges,
        });
        const byType = edges.reduce((acc, e) => {
          acc[e.edgeType] = (acc[e.edgeType] ?? 0) + 1;
          return acc;
        }, {} as Record<string, number>);
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
        const e = err as Record<string, unknown>;
        const message = err instanceof Error ? err.message : 'Scan failed';
        const code = typeof e['azCode'] === 'string' ? e['azCode'] : 'SERVER_ERROR';
        const detail = typeof e['azDetail'] === 'string' ? e['azDetail'] : '';
        this.store.scanPhase.set('error');
        this.store.errorMessage.set(message);
        this.scanError.set({ code, detail: detail || message });
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
