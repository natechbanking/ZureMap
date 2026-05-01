import { dataUrlByteLength, pasteTargetPosition } from './canvas-image-paste.util';

describe('canvas-image-paste.util', () => {
  it('returns fallback target position when host missing', () => {
    expect(pasteTargetPosition(undefined, 1, 100, 100)).toEqual({ x: 48, y: 48 });
  });

  it('computes centered target position and clamps to non-negative', () => {
    const host = {
      scrollLeft: 200,
      scrollTop: 100,
      clientWidth: 400,
      clientHeight: 200,
    } as HTMLElement;

    expect(pasteTargetPosition(host, 2, 120, 80)).toEqual({ x: 140, y: 60 });
    expect(pasteTargetPosition(host, 10, 500, 500)).toEqual({ x: 0, y: 0 });
  });

  it('calculates base64 byte length with padding', () => {
    expect(dataUrlByteLength('data:image/png;base64,SGVsbG8=')).toBe(5);
    expect(dataUrlByteLength('data:image/png;base64,SGVsbG8')).toBe(5);
  });
});
