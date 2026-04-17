import { Injectable, ElementRef } from '@angular/core';
import { saveAs } from 'file-saver';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';
import { AzureSubscription } from '../models/azure-resource.model';

export interface DiagramStateFile {
  version: '1.0';
  exportedAt: string;
  subscriptions: AzureSubscription[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  exportSVG(canvasHost: ElementRef | HTMLElement): void {
    const el = canvasHost instanceof ElementRef ? canvasHost.nativeElement : canvasHost;
    const svg = el.querySelector('svg');
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    saveAs(blob, `zuremap-${this.timestamp()}.svg`);
  }

  async exportPNG(canvasHost: ElementRef | HTMLElement, scale = 2): Promise<void> {
    const el = canvasHost instanceof ElementRef ? canvasHost.nativeElement : canvasHost;
    const svg = el.querySelector('svg');
    if (!svg) return;

    const { width, height } = svg.getBoundingClientRect();
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.src = url;
    await new Promise<void>(resolve => { img.onload = () => resolve(); });

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob(pngBlob => {
      if (pngBlob) saveAs(pngBlob, `zuremap-${this.timestamp()}.png`);
    }, 'image/png');
  }

  exportJSON(nodes: DiagramNode[], edges: DiagramEdge[], subscriptions: AzureSubscription[]): void {
    const state: DiagramStateFile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      subscriptions,
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    saveAs(blob, `zuremap-${this.timestamp()}.json`);
  }

  importJSON(file: File): Promise<DiagramStateFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const state = JSON.parse(e.target!.result as string) as DiagramStateFile;
          if (state.version !== '1.0') throw new Error('Unsupported version');
          resolve(state);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }
}
