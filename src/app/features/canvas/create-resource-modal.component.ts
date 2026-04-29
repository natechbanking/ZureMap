import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NodeStatus } from '../../core/models/diagram-node.model';

export interface ResourceCreationData {
  name: string;
  location: string;
  resourceGroup: string;
  status: NodeStatus;
  description: string;
  tags: { key: string; value: string }[];
  internalItems: { text: string }[];
}

const AZURE_REGIONS = [
  'eastus', 'eastus2', 'westus', 'westus2', 'westus3', 'centralus', 'northcentralus', 'southcentralus',
  'westcentralus', 'canadacentral', 'canadaeast', 'brazilsouth', 'northeurope', 'westeurope',
  'uksouth', 'ukwest', 'francecentral', 'francesouth', 'germanywestcentral', 'switzerlandnorth',
  'norwayeast', 'swedencentral', 'polandcentral', 'italynorth', 'spaincentral',
  'eastasia', 'southeastasia', 'australiaeast', 'australiasoutheast', 'australiacentral',
  'japaneast', 'japanwest', 'koreacentral', 'koreasouth', 'centralindia', 'southindia', 'westindia',
  'uaenorth', 'uaecentral', 'southafricanorth', 'qatarcentral', 'israelcentral',
  'global', 'global (non-regional)',
];

@Component({
  selector: 'app-create-resource-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" (click)="onBackdropClick($event)"></div>

      <!-- Modal -->
      <div
        class="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            @if (iconUrl) {
              <img [src]="iconUrl" class="w-6 h-6 object-contain" alt="" />
            } @else {
              <svg viewBox="0 0 20 20" class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <path d="M7 10 L13 10 M10 7 L10 13" />
              </svg>
            }
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">Add Azure Resource</p>
            <p class="text-xs text-gray-400 truncate">{{ resourceLabel }}</p>
          </div>
          <button
            class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex items-center justify-center"
            (click)="cancel.emit()"
          >
            <svg viewBox="0 0 20 20" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 4 L16 16 M16 4 L4 16" />
            </svg>
          </button>
        </div>

        <!-- Scrollable body -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          <!-- Name -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Name <span class="text-red-400">*</span></label>
            <input
              type="text"
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              placeholder="my-keyvault-01"
              [(ngModel)]="form.name"
            />
          </div>

          <!-- Location + Resource Group -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Location</label>
              <input
                type="text"
                list="azure-regions-list"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="eastus"
                [(ngModel)]="form.location"
              />
              <datalist id="azure-regions-list">
                @for (r of regions; track r) {
                  <option [value]="r"></option>
                }
              </datalist>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Resource Group</label>
              <input
                type="text"
                class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
                placeholder="my-rg"
                [(ngModel)]="form.resourceGroup"
              />
            </div>
          </div>

          <!-- Status -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
            <div class="flex gap-2">
              @for (s of statuses; track s.value) {
                <button
                  class="flex-1 h-9 rounded-lg border-2 text-xs font-medium transition-all"
                  [class.border-blue-400]="form.status === s.value"
                  [class.bg-blue-50]="form.status === s.value"
                  [class.text-blue-700]="form.status === s.value"
                  [class.border-gray-100]="form.status !== s.value"
                  [class.text-gray-500]="form.status !== s.value"
                  [class.hover:border-gray-200]="form.status !== s.value"
                  (click)="form.status = s.value"
                >{{ s.label }}</button>
              }
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
            <textarea
              class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
              rows="2"
              placeholder="Optional notes about this resource..."
              [(ngModel)]="form.description"
            ></textarea>
          </div>

          <!-- Tags -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</label>
              <button
                class="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                (click)="addTag()"
              >+ Add Tag</button>
            </div>
            @if (form.tags.length === 0) {
              <p class="text-xs text-gray-400 py-1">No tags. Click "+ Add Tag" to add one.</p>
            } @else {
              <div class="space-y-2">
                @for (tag of form.tags; track $index; let i = $index) {
                  <div class="flex gap-2 items-center">
                    <input
                      type="text"
                      class="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 transition"
                      placeholder="key"
                      [(ngModel)]="tag.key"
                    />
                    <span class="text-gray-300 text-xs">=</span>
                    <input
                      type="text"
                      class="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 transition"
                      placeholder="value"
                      [(ngModel)]="tag.value"
                    />
                    <button
                      class="w-6 h-6 flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center"
                      (click)="removeTag(i)"
                    >
                      <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M4 4 L16 16 M16 4 L4 16" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Internal Labels -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Internal Labels</label>
              <button
                class="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors"
                (click)="addLabel()"
              >+ Add Label</button>
            </div>
            <p class="text-[10px] text-gray-400 mb-2">Labels shown inside the node on the canvas.</p>
            @if (form.internalItems.length === 0) {
              <p class="text-xs text-gray-400 py-1">No labels yet.</p>
            } @else {
              <div class="space-y-2">
                @for (item of form.internalItems; track $index; let i = $index) {
                  <div class="flex gap-2 items-center">
                    <input
                      type="text"
                      class="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-blue-400 transition"
                      placeholder="e.g. Port: 443"
                      [(ngModel)]="item.text"
                    />
                    <button
                      class="w-6 h-6 flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center"
                      (click)="removeLabel(i)"
                    >
                      <svg viewBox="0 0 20 20" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M4 4 L16 16 M16 4 L4 16" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <p class="text-[10px] text-gray-400">
            Placing at ({{ position.x | number:'1.0-0' }}, {{ position.y | number:'1.0-0' }})
          </p>
          <div class="flex gap-2">
            <button
              class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              (click)="cancel.emit()"
            >Cancel</button>
            <button
              class="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              [class.bg-blue-500]="form.name.trim()"
              [class.text-white]="form.name.trim()"
              [class.hover:bg-blue-600]="form.name.trim()"
              [class.shadow-sm]="form.name.trim()"
              [class.bg-gray-100]="!form.name.trim()"
              [class.text-gray-400]="!form.name.trim()"
              [disabled]="!form.name.trim()"
              (click)="onConfirm()"
            >Add to Canvas</button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CreateResourceModalComponent implements OnInit {
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  @Input() resourceType = '';
  @Input() resourceLabel = '';
  @Input() iconUrl = '';

  @Output() confirm = new EventEmitter<ResourceCreationData>();
  @Output() cancel = new EventEmitter<void>();

  readonly regions = AZURE_REGIONS;

  readonly statuses: { value: NodeStatus; label: string }[] = [
    { value: 'running', label: 'Running' },
    { value: 'stopped', label: 'Stopped' },
    { value: 'failed', label: 'Failed' },
    { value: 'unknown', label: 'Unknown' },
  ];

  form: {
    name: string;
    location: string;
    resourceGroup: string;
    status: NodeStatus;
    description: string;
    tags: { key: string; value: string }[];
    internalItems: { text: string }[];
  } = {
    name: '',
    location: '',
    resourceGroup: '',
    status: 'unknown',
    description: '',
    tags: [],
    internalItems: [],
  };

  ngOnInit(): void {
    this.form.name = this.resourceLabel;
  }

  addTag(): void {
    this.form.tags.push({ key: '', value: '' });
  }

  removeTag(i: number): void {
    this.form.tags.splice(i, 1);
  }

  addLabel(): void {
    this.form.internalItems.push({ text: '' });
  }

  removeLabel(i: number): void {
    this.form.internalItems.splice(i, 1);
  }

  onConfirm(): void {
    if (!this.form.name.trim()) return;
    this.confirm.emit({ ...this.form });
  }

  onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) this.cancel.emit();
  }
}
