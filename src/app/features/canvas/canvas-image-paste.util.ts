export function pasteTargetPosition(
  host: HTMLElement | undefined,
  zoomLevel: number,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!host) return { x: 48, y: 48 };
  const x = (host.scrollLeft + host.clientWidth / 2) / zoomLevel - width / 2;
  const y = (host.scrollTop + host.clientHeight / 2) / zoomLevel - height / 2;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

export function dataUrlByteLength(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unable to load pasted image.')); };
    img.src = url;
  });
}

export function imageHasTransparency(img: HTMLImageElement): boolean {
  const probeCanvas = document.createElement('canvas');
  const probeCtx = probeCanvas.getContext('2d', { willReadFrequently: true });
  if (!probeCtx) return false;

  const maxProbe = 256;
  const scale = Math.min(1, maxProbe / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

  probeCanvas.width = w;
  probeCanvas.height = h;
  probeCtx.clearRect(0, 0, w, h);
  probeCtx.drawImage(img, 0, 0, w, h);

  const data = probeCtx.getImageData(0, 0, w, h).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

export async function normalizePastedImage(blob: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
  const MAX_DIMENSION = 1920;
  const MAX_BYTES = 1_500_000;

  const source = await loadImageFromBlob(blob);
  const hasTransparency = imageHasTransparency(source);
  let width = source.naturalWidth;
  let height = source.naturalHeight;
  const firstScale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * firstScale));
  height = Math.max(1, Math.round(height * firstScale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable.');

  let scale = 1;
  let mime: 'image/png' | 'image/jpeg' = hasTransparency
    ? 'image/png'
    : (blob.type === 'image/png' ? 'image/png' : 'image/jpeg');
  let quality = 0.9;

  for (let i = 0; i < 8; i++) {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);

    const dataUrl = canvas.toDataURL(mime, mime === 'image/jpeg' ? quality : undefined);
    if (dataUrlByteLength(dataUrl) <= MAX_BYTES) {
      return { dataUrl, width: w, height: h };
    }

    if (mime === 'image/png' && !hasTransparency) {
      mime = 'image/jpeg';
      quality = 0.9;
    } else if (quality > 0.6) {
      quality -= 0.1;
    } else {
      scale *= 0.85;
    }
  }

  throw new Error('Pasted image is too large after compression.');
}
