import {
  anchorTowardPoint,
  annotationBounds,
  annotationTransform,
  diamondPointsFromRect,
  edgeAnchorBetween,
  edgePolylinePoints,
  linePointsFromAnnotation,
  linePointsFromCoords,
  pathMax,
  polylinePointsString,
  rotatedBounds,
  sloppyFilterForLevel,
  strokeDashArrayForStyle,
} from './canvas-geometry.util';
import { makeAnnotation, makeDiagramNode } from '../../testing/test-helpers';

describe('canvas-geometry.util', () => {
  it('builds expected geometry primitives', () => {
    expect(diamondPointsFromRect({ x: 0, y: 0, w: 10, h: 20 })).toBe('5,0 10,10 5,20 0,10');
    expect(linePointsFromCoords(0, 0, 10, 10, 'straight')).toBe('0,0 10,10');
    expect(linePointsFromCoords(0, 0, 10, 10, 'elbow')).toBe('0,0 5,0 5,10 10,10');
  });

  it('maps style/sloppiness to SVG presentation values', () => {
    expect(strokeDashArrayForStyle('solid')).toBeNull();
    expect(strokeDashArrayForStyle('dashed')).toBe('8 4');
    expect(strokeDashArrayForStyle('dotted')).toBe('2 5');

    expect(sloppyFilterForLevel(0)).toBeNull();
    expect(sloppyFilterForLevel(2)).toBe('url(#sloppy-2)');
    expect(sloppyFilterForLevel(99)).toBe('url(#sloppy-3)');
  });

  it('computes edge anchors and polyline points', () => {
    const n1 = makeDiagramNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 } });
    const n2 = makeDiagramNode({ id: 'b', position: { x: 200, y: 0 }, size: { width: 100, height: 50 } });

    const a = edgeAnchorBetween([n1, n2], 'a', 'b');
    expect(a.x).toBe(100);

    const points = edgePolylinePoints([n1, n2], { sourceId: 'a', targetId: 'b', waypoints: [{ x: 150, y: 25 }] });
    expect(points.length).toBe(3);
    expect(points[1]).toEqual({ x: 150, y: 25 });

    const anchor = anchorTowardPoint(n1, { x: 500, y: 25 });
    expect(anchor.x).toBe(100);
  });

  it('handles annotation path/bounds/rotation helpers', () => {
    const ann = makeAnnotation({
      type: 'line',
      x: 1,
      y: 2,
      x2: 11,
      y2: 12,
      waypoints: [{ x: 5, y: 6 }],
    });
    expect(linePointsFromAnnotation(ann)).toBe('1,2 5,6 11,12');
    expect(polylinePointsString([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('1,2 3,4');

    const max = pathMax('M 0 0 L 3 9 L 8 1');
    expect(max).toEqual({ x: 8, y: 9 });

    const box = rotatedBounds(0, 0, 10, 20, 45);
    expect(box.maxX).toBeGreaterThan(box.minX);

    const text = makeAnnotation({ type: 'text', width: 100, height: 20, rotation: 15 });
    expect(annotationTransform(text)).toBe('rotate(15deg)');
    const bounds = annotationBounds(text);
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });
});
