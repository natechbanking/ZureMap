import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="pointer-events-none absolute top-0 left-0 right-0 z-[180] flex items-start justify-between p-3">
      <div class="pointer-events-auto relative flex items-center gap-2 rounded-lg bg-white/90 px-3 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <button
          type="button"
          class="cursor-pointer rounded-lg bg-white/90 p-2 text-slate-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
          title="Open menu"
          (click)="toggleMenu()"
          aria-label="Open menu"
        >
          ☰
        </button>
        <img src="logo.png" alt="ZureMap" class="h-6 w-auto" />
        <span class="text-sm font-semibold tracking-tight text-slate-800">ZureMap</span>
          <div
            class="absolute left-0 mt-2 w-60 rounded-lg bg-white p-2 shadow-lg ring-1 ring-black/10 origin-top-left transition-all duration-150"
            style="top: calc(100% + 8px);"
            [class.opacity-100]="menuOpen"
            [class.scale-100]="menuOpen"
            [class.translate-y-0]="menuOpen"
            [class.pointer-events-auto]="menuOpen"
            [class.opacity-0]="!menuOpen"
            [class.scale-95]="!menuOpen"
            [class.-translate-y-1]="!menuOpen"
            [class.pointer-events-none]="!menuOpen"
          >
            <div class="px-2 py-1 text-[11px] text-slate-500">
              {{ nodeCount }} resources · {{ edgeCount }} connections
              @if (totalCost > 0) {
                <span> · {{ formatCost(totalCost, totalCostCurrency) }}</span>
              }
            </div>

            <button
              type="button"
              (click)="toggleFinOps.emit(); closeMenu()"
              [class]="finOpsActive ? 'mt-1 w-full rounded px-2 py-1.5 text-left text-xs bg-amber-500 text-white' : 'mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100'"
              title="Open/close FinOps drawer"
            >💰 FinOps</button>

            <label
              class="mt-1 block w-full cursor-pointer rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              title="Import ZureMap JSON or embedded PNG"
            >
              ↑ Import
              <input type="file" accept=".json,application/json,.png,image/png" class="sr-only" (change)="onFileChange($event); closeMenu()" />
            </label>

            <button type="button" (click)="exportJson.emit(); closeMenu()" class="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100" title="Export JSON">↓ JSON</button>
            <button type="button" (click)="openExportDialog.emit(); closeMenu()" class="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100" title="Export image">↓ Export</button>
            <button type="button" (click)="rescan.emit(); closeMenu()" class="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100" title="Re-scan Azure">↺ Rescan</button>
            <button
              type="button"
              (click)="relayout.emit(); closeMenu()"
              [disabled]="relayoutBusy"
              class="mt-1 w-full rounded px-2 py-1.5 text-left text-xs transition-colors"
              [ngClass]="relayoutBusy ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'"
              title="Re-run ELK auto-layout (undoable with Ctrl+Z)"
            >{{ relayoutBusy ? '⟳ Arranging…' : '⊞ Auto-layout' }}</button>
          </div>
      </div>
      <div></div>
    </header>
  `,
})
export class ToolbarComponent {
  @Input() nodeCount = 0;
  @Input() edgeCount = 0;
  @Input() totalCost = 0;
  @Input() totalCostCurrency = 'EUR';
  @Input() finOpsActive = false;
  @Input() relayoutBusy = false;
  menuOpen = false;

  @Output() openExportDialog = new EventEmitter<void>();
  @Output() exportJson = new EventEmitter<void>();
  @Output() importJson = new EventEmitter<File>();
  @Output() toggleFinOps = new EventEmitter<void>();
  @Output() rescan = new EventEmitter<void>();
  @Output() relayout = new EventEmitter<void>();

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.importJson.emit(file);
    input.value = '';
  }

  formatCost(value: number, currency: string): string {
    return `${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)}/period`;
  }
}
