import { Injectable, ElementRef } from '@angular/core';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import { DiagramNode } from '../models/diagram-node.model';
import { DiagramEdge } from '../models/diagram-edge.model';
import { AzureSubscription } from '../models/azure-resource.model';
import { Annotation } from '../models/annotation.model';

export interface DiagramStateFile {
  version: '1.0';
  exportedAt: string;
  subscriptions: AzureSubscription[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  annotations: Annotation[];
}

export interface ExportImageOptions {
  background: 'white' | 'black' | 'transparent';
  embed: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => typeof value[key] === 'string');
}

function hasNumbers(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
}

function hasOptionalStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every(key => value[key] === undefined || typeof value[key] === 'string');
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && hasNumbers(value, ['x', 'y']);
}

function hasValidWaypoints(value: Record<string, unknown>): boolean {
  return value['waypoints'] === undefined ||
    (Array.isArray(value['waypoints']) && value['waypoints'].every(isPoint));
}

function isDiagramNode(value: Record<string, unknown>): boolean {
  const metadata = value['metadata'];
  const size = value['size'];
  const custom = value['custom'];
  const cost = value['costData'];
  const ports = value['ports'];
  return hasStrings(value, ['id', 'label', 'resourceType', 'group', 'groupId']) &&
    isPoint(value['position']) && isRecord(size) && hasNumbers(size, ['width', 'height']) &&
    isRecord(metadata) && hasStrings(metadata, ['id', 'name', 'type', 'location', 'resourceGroup', 'subscriptionId']) &&
    (metadata['tags'] == null || (isRecord(metadata['tags']) && Object.values(metadata['tags']).every(tag => typeof tag === 'string'))) &&
    isRecord(metadata['properties']) && hasOptionalStrings(value, ['parentId', 'status']) &&
    (value['children'] === undefined || (Array.isArray(value['children']) && value['children'].every(id => typeof id === 'string'))) &&
    (custom === undefined || (isRecord(custom) && hasOptionalStrings(custom, ['description', 'boundShapeAnnotationId']) &&
      (custom['panelState'] === undefined || (isRecord(custom['panelState']) &&
        Object.values(custom['panelState']).every(open => typeof open === 'boolean'))) &&
      (custom['internalItems'] === undefined || (Array.isArray(custom['internalItems']) &&
        custom['internalItems'].every(item => isRecord(item) && hasStrings(item, ['id', 'text']) && isPoint(item)))))) &&
    (ports === undefined || (Array.isArray(ports) && ports.every(port => isRecord(port) &&
      hasStrings(port, ['id', 'side']) && (port['offset'] === undefined || hasNumbers(port, ['offset']))))) &&
    (cost === undefined || (isRecord(cost) && hasNumbers(cost, ['monthlyCostUsd']) && hasStrings(cost, ['currency', 'period'])));
}

function isDiagramEdge(value: Record<string, unknown>): boolean {
  const style = value['style'];
  return hasStrings(value, ['id', 'sourceId', 'targetId', 'edgeType']) &&
    isRecord(style) && hasStrings(style, ['strokeColor', 'markerEnd']) &&
    hasNumbers(style, ['strokeWidth']) && hasOptionalStrings(style, ['dashArray']) &&
    hasOptionalStrings(value, ['sourcePort', 'targetPort', 'sourceAnnotationId', 'targetAnnotationId', 'label']) &&
    hasValidWaypoints(value);
}

function isAnnotation(value: Record<string, unknown>): boolean {
  const image = value['imageDataUrl'];
  const container = value['container'];
  const types = ['draw', 'line', 'arrow', 'text', 'rect', 'ellipse', 'diamond', 'sticky', 'image'];
  return hasStrings(value, ['id', 'type', 'color', 'fill']) && types.includes(value['type'] as string) &&
    hasNumbers(value, ['x', 'y', 'strokeWidth']) && hasValidWaypoints(value) &&
    ['width', 'height', 'x2', 'y2', 'fontSize', 'rotation', 'fillOpacity', 'sloppiness'].every(key =>
      value[key] === undefined || hasNumbers(value, [key])) &&
    hasOptionalStrings(value, ['text', 'fontFamily', 'pathData']) &&
    ['sourceBinding', 'targetBinding'].every(key => value[key] === undefined ||
      (isRecord(value[key]) && hasStrings(value[key], ['portId']) && hasOptionalStrings(value[key], ['nodeId', 'annotationId']))) &&
    (container === undefined || (isRecord(container) && ['rg', 'sub'].includes(container['kind'] as string) &&
      hasStrings(container, ['name']) && typeof container['collapsed'] === 'boolean')) &&
    (image === undefined || (typeof image === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)));
}

function parseDiagramState(value: unknown): DiagramStateFile {
  if (!isRecord(value)) {
    throw new Error('Invalid diagram state');
  }
  const state = value;
  if (state['version'] !== '1.0') throw new Error('Unsupported version');
  const collections: Record<string, unknown[]> = {};
  for (const key of ['nodes', 'edges', 'subscriptions', 'annotations']) {
    const entries = state[key] ?? [];
    if (!Array.isArray(entries) || !entries.every(isRecord)) {
      throw new Error(`Invalid diagram ${key}`);
    }
    collections[key] = entries;
  }
  const validators: Record<string, (entry: Record<string, unknown>) => boolean> = {
    nodes: isDiagramNode,
    edges: isDiagramEdge,
    subscriptions: entry => hasStrings(entry, ['id', 'subscriptionId', 'name', 'state', 'tenantId']),
    annotations: isAnnotation,
  };
  for (const [key, validate] of Object.entries(validators)) {
    if (!(collections[key] as Record<string, unknown>[]).every(validate)) {
      throw new Error(`Invalid diagram ${key}`);
    }
  }
  return { ...state, ...collections } as unknown as DiagramStateFile;
}

export function buildDiagramState(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  subscriptions: AzureSubscription[],
  annotations: Annotation[],
): DiagramStateFile {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    subscriptions,
    nodes,
    edges,
    annotations,
  };
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  async exportImage(
    exportRoot: ElementRef,
    options: ExportImageOptions,
    diagramState: DiagramStateFile,
  ): Promise<void> {
    const el = exportRoot.nativeElement as HTMLElement;
    const { background, embed, canvasWidth, canvasHeight } = options;
    const backgroundColor = background === 'transparent' ? undefined : background;

    const dataUrl = await toPng(el, {
      backgroundColor,
      width: canvasWidth,
      height: canvasHeight,
      style: { transform: 'none', transformOrigin: 'top left' },
      filter: (node: HTMLElement) => !node.hasAttribute?.('data-export-hide'),
    });

    const png = this.dataUrlToBytes(dataUrl);

    if (embed) {
      const json = JSON.stringify(diagramState);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const modified = this.injectTextChunk(png, 'zuremap', b64);
      saveAs(new Blob([this.toArrayBuffer(modified)], { type: 'image/png' }), `zuremap-${this.timestamp()}.png`);
    } else {
      saveAs(new Blob([this.toArrayBuffer(png)], { type: 'image/png' }), `zuremap-${this.timestamp()}.png`);
    }
  }

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

  exportJSON(nodes: DiagramNode[], edges: DiagramEdge[], subscriptions: AzureSubscription[], annotations: Annotation[]): void {
    const state = buildDiagramState(nodes, edges, subscriptions, annotations);
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    saveAs(blob, `zuremap-${this.timestamp()}.json`);
  }

  async importFile(file: File): Promise<DiagramStateFile> {
    if (file.name.endsWith('.png') || file.type === 'image/png') {
      const embedded = await this.readEmbeddedDiagram(file);
      if (embedded) return embedded;
      throw new Error('No embedded diagram data found in this PNG');
    }
    return this.importJSON(file);
  }

  private importJSON(file: File): Promise<DiagramStateFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          resolve(parseDiagramState(JSON.parse(e.target!.result as string)));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private async readEmbeddedDiagram(file: File): Promise<DiagramStateFile | null> {
    const buffer = await file.arrayBuffer();
    const png = new Uint8Array(buffer);

    // Verify PNG signature
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (png[i] !== sig[i]) return null;
    }

    let pos = 8;
    while (pos + 12 <= png.length) {
      const view = new DataView(png.buffer, pos);
      const length = view.getUint32(0, false);
      const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);

      if (type === 'tEXt' && pos + 8 + length <= png.length) {
        const data = png.slice(pos + 8, pos + 8 + length);
        const nullIdx = data.indexOf(0);
        if (nullIdx > 0) {
          const keyword = new TextDecoder('latin1').decode(data.slice(0, nullIdx));
          if (keyword === 'zuremap') {
            try {
              const b64 = new TextDecoder('latin1').decode(data.slice(nullIdx + 1));
              const json = decodeURIComponent(escape(atob(b64)));
              return parseDiagramState(JSON.parse(json));
            } catch {
              return null;
            }
          }
        }
      }

      if (type === 'IEND') break;
      pos += 12 + length;
    }

    return null;
  }

  private dataUrlToBytes(dataUrl: string): Uint8Array {
    const b64 = dataUrl.split(',')[1];
    const bstr = atob(b64);
    const arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
    return arr;
  }

  private toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer as ArrayBuffer;
  }

  private injectTextChunk(png: Uint8Array, keyword: string, text: string): Uint8Array {
    const enc = new TextEncoder();
    const keyBytes = enc.encode(keyword);
    const textBytes = enc.encode(text);

    // tEXt data = keyword + null byte + text
    const data = new Uint8Array(keyBytes.length + 1 + textBytes.length);
    data.set(keyBytes, 0);
    data[keyBytes.length] = 0;
    data.set(textBytes, keyBytes.length + 1);

    // CRC covers chunk type + chunk data
    const typeBytes = enc.encode('tEXt');
    const crcInput = new Uint8Array(4 + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, 4);
    const checksum = this.crc32(crcInput);

    // Assemble chunk: length(4) + type(4) + data + crc(4)
    const chunk = new Uint8Array(12 + data.length);
    const chunkView = new DataView(chunk.buffer);
    chunkView.setUint32(0, data.length, false);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    chunkView.setUint32(8 + data.length, checksum, false);

    // IEND is always the last 12 bytes of a valid PNG
    const iendPos = png.length - 12;
    const result = new Uint8Array(png.length + chunk.length);
    result.set(png.slice(0, iendPos), 0);
    result.set(chunk, iendPos);
    result.set(png.slice(iendPos), iendPos + chunk.length);
    return result;
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let k = 0; k < 8; k++) {
        crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }
}
