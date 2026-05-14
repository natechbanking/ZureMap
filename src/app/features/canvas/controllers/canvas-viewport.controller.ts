import { Injectable, inject, signal } from '@angular/core';
import { CanvasControllerContextService } from './canvas-controller-context.service';

@Injectable({ providedIn: 'root' })
export class CanvasViewportController {
  private static readonly ZOOM_MIN = 0.4;
  private static readonly ZOOM_MAX = 2.5;
  private static readonly ZOOM_STEP = 0.1;

  readonly minimapOpen = signal(false);
  readonly minimapScrollLeft = signal(0);
  readonly minimapScrollTop = signal(0);
  readonly minimapViewportWidth = signal(0);
  readonly minimapViewportHeight = signal(0);

  private readonly context = inject(CanvasControllerContextService);

  get zoomLevel(): number {
    return this.context.store.zoomLevel();
  }

  get zoomPercent(): number {
    return Math.round(this.zoomLevel * 100);
  }

  zoomIn(host?: HTMLElement): void {
    this.setZoom(this.zoomLevel + CanvasViewportController.ZOOM_STEP, host);
  }

  zoomOut(host?: HTMLElement): void {
    this.setZoom(this.zoomLevel - CanvasViewportController.ZOOM_STEP, host);
  }

  onCanvasScroll(host?: HTMLElement): void {
    if (!host) return;
    this.minimapScrollLeft.set(host.scrollLeft);
    this.minimapScrollTop.set(host.scrollTop);
    this.minimapViewportWidth.set(host.clientWidth);
    this.minimapViewportHeight.set(host.clientHeight);
  }

  onMinimapPan(event: { scrollLeft: number; scrollTop: number }, host?: HTMLElement): void {
    if (!host) return;
    host.scrollLeft = event.scrollLeft;
    host.scrollTop = event.scrollTop;
    this.minimapScrollLeft.set(host.scrollLeft);
    this.minimapScrollTop.set(host.scrollTop);
  }

  setInitialViewportSize(host?: HTMLElement): void {
    if (!host) return;
    this.minimapViewportWidth.set(host.clientWidth);
    this.minimapViewportHeight.set(host.clientHeight);
  }

  setZoom(nextZoom: number, host?: HTMLElement, anchor?: { x: number; y: number }): void {
    const prevZoom = this.zoomLevel;
    const zoom = Math.max(
      CanvasViewportController.ZOOM_MIN,
      Math.min(CanvasViewportController.ZOOM_MAX, Number(nextZoom.toFixed(2))),
    );
    if (zoom === prevZoom) return;

    if (!host || !anchor) {
      this.context.store.zoomLevel.set(zoom);
      return;
    }

    const rect = host.getBoundingClientRect();
    const localX = anchor.x - rect.left;
    const localY = anchor.y - rect.top;
    const worldX = (host.scrollLeft + localX) / prevZoom;
    const worldY = (host.scrollTop + localY) / prevZoom;

    this.context.store.zoomLevel.set(zoom);
    host.scrollLeft = Math.max(0, worldX * zoom - localX);
    host.scrollTop = Math.max(0, worldY * zoom - localY);
  }
}
