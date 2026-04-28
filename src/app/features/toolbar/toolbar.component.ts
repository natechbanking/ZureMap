import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="h-12 bg-azure-dark text-white flex items-center justify-between px-4 gap-4 flex-shrink-0">

      <div class="flex items-center gap-3">
        <img src="logo.png" alt="ZureMap" class="h-7 w-auto" />
        <span class="font-bold text-lg tracking-tight">ZureMap</span>
        <div class="h-4 w-px bg-white/20"></div>
        <span class="text-xs text-white/60">
          {{ nodeCount }} resources · {{ edgeCount }} connections
        </span>
        @if (totalCost > 0) {
          <span class="text-xs text-white/60">·</span>
          <span class="text-xs text-white/80 font-medium">{{ formatCost(totalCost, totalCostCurrency) }}</span>
        }
        @if (comparisonMode && driftSummary) {
          <div class="flex items-center gap-1.5 ml-2">
            <span class="px-2 py-0.5 bg-green-600 rounded-full text-xs">{{ driftSummary.matched }} matched</span>
            @if (driftSummary.missing > 0) {
              <span class="px-2 py-0.5 bg-red-500 rounded-full text-xs">{{ driftSummary.missing }} missing</span>
            }
            @if (driftSummary.unplanned > 0) {
              <span class="px-2 py-0.5 bg-blue-500 rounded-full text-xs">{{ driftSummary.unplanned }} new</span>
            }
          </div>
        }
      </div>

      <div class="flex items-center gap-1">

        <button
          (click)="toggleFinOps.emit()"
          [class]="finOpsActive ? 'px-3 py-1 rounded text-xs transition-colors bg-amber-500 text-white' : 'px-3 py-1 rounded text-xs transition-colors text-white/70 hover:bg-white/10'"
          title="Open/close FinOps drawer"
        >💰 FinOps</button>

        <button
          (click)="toggleDrift.emit()"
          [class]="comparisonMode ? 'px-3 py-1 rounded text-xs transition-colors bg-blue-600 text-white' : 'px-3 py-1 rounded text-xs transition-colors text-white/70 hover:bg-white/10'"
          title="Compare with baseline"
        >⇄ Drift</button>

        <div class="h-4 w-px bg-white/20 mx-1"></div>

        <label
          class="px-3 py-1 rounded text-xs text-white/70 hover:bg-white/10 cursor-pointer"
          title="Import ZureMap JSON or embedded PNG"
        >
          ↑ Import
          <input type="file" accept=".json,.png" class="sr-only" (change)="onFileChange($event)" />
        </label>

        <button (click)="exportJson.emit()" class="px-3 py-1 rounded text-xs text-white/70 hover:bg-white/10" title="Export JSON">↓ JSON</button>
        <button (click)="openExportDialog.emit()" class="px-3 py-1 rounded text-xs text-white/70 hover:bg-white/10" title="Export image">↓ Export</button>

        <div class="h-4 w-px bg-white/20 mx-1"></div>

        <button
          (click)="rescan.emit()"
          class="px-3 py-1 rounded text-xs text-white/70 hover:bg-white/10"
          title="Re-scan Azure"
        >↺ Rescan</button>

        <button
          (click)="relayout.emit()"
          [disabled]="relayoutBusy"
          class="px-3 py-1 rounded text-xs transition-colors"
          [ngClass]="relayoutBusy ? 'text-white bg-blue-600' : 'text-white/70 hover:bg-white/10'"
          title="Re-run ELK auto-layout (undoable with Ctrl+Z)"
        >{{ relayoutBusy ? '⟳ Arranging…' : '⊞ Auto-layout' }}</button>

      </div>
    </header>
  `,
})
export class ToolbarComponent {
  @Input() nodeCount = 0;
  @Input() edgeCount = 0;
  @Input() totalCost = 0;
  @Input() totalCostCurrency = 'EUR';
  @Input() finOpsActive = false;
  @Input() comparisonMode = false;
  @Input() driftSummary: { matched: number; missing: number; unplanned: number } | null = null;

  @Input() relayoutBusy = false;

  @Output() openExportDialog = new EventEmitter<void>();
  @Output() exportJson = new EventEmitter<void>();
  @Output() importJson = new EventEmitter<File>();
  @Output() toggleFinOps = new EventEmitter<void>();
  @Output() toggleDrift = new EventEmitter<void>();
  @Output() rescan = new EventEmitter<void>();
  @Output() relayout = new EventEmitter<void>();

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.importJson.emit(file);
  }

  formatCost(value: number, currency: string): string {
    return `${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)}/period`;
  }
}
