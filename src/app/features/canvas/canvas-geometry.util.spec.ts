import {
  anchorTowardPoint,
  annotationBoundingBox,
  annotationBounds,
  annotationPortPosition,
  annotationTransform,
  CONNECTABLE_ANNOTATION_TYPES,
  defaultNodePorts,
  diamondPointsFromRect,
  edgeAnchorBetween,
  edgePolylinePoints,
  linePointsFromAnnotation,
  linePointsFromCoords,
  pathMax,
  polylinePointsString,
  portPosition,
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

  describe('port geometry', () => {
    it('defaultNodePorts returns exactly 4 ports for each cardinal side', () => {
      const ports = defaultNodePorts();
      expect(ports.length).toBe(4);
      expect(ports.map(p => p.id)).toEqual(['port-top', 'port-right', 'port-bottom', 'port-left']);
      expect(ports.map(p => p.side)).toEqual(['top', 'right', 'bottom', 'left']);
    });

    it('portPosition returns correct absolute coordinates for each side', () => {
      const node = makeDiagramNode({ position: { x: 100, y: 200 }, size: { width: 80, height: 60 } });

      expect(portPosition(node, 'port-top')).toEqual({ x: 140, y: 200 });
      expect(portPosition(node, 'port-right')).toEqual({ x: 180, y: 230 });
      expect(portPosition(node, 'port-bottom')).toEqual({ x: 140, y: 260 });
      expect(portPosition(node, 'port-left')).toEqual({ x: 100, y: 230 });
    });

    it('portPosition returns null for unknown port id', () => {
      const node = makeDiagramNode({ position: { x: 0, y: 0 }, size: { width: 100, height: 100 } });
      expect(portPosition(node, 'port-unknown')).toBeNull();
    });

    it('portPosition respects custom offset on a port', () => {
      const node = makeDiagramNode({
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        ports: [{ id: 'port-top', side: 'top', offset: 0.25 }],
      });
      expect(portPosition(node, 'port-top')).toEqual({ x: 25, y: 0 });
    });
  });

  describe('annotation bounding box and ports', () => {
    it('annotationBoundingBox uses explicit dimensions when provided', () => {
      const ann = makeAnnotation({ type: 'rect', x: 50, y: 60, width: 120, height: 80 });
      expect(annotationBoundingBox(ann)).toEqual({ x: 50, y: 60, width: 120, height: 80 });
    });

    it('annotationBoundingBox applies sticky defaults when dimensions are absent', () => {
      const ann = makeAnnotation({ type: 'sticky', x: 0, y: 0, width: undefined, height: undefined });
      expect(annotationBoundingBox(ann)).toEqual({ x: 0, y: 0, width: 180, height: 120 });
    });

    it('annotationBoundingBox applies image defaults when dimensions are absent', () => {
      const ann = makeAnnotation({ type: 'image', x: 0, y: 0, width: undefined, height: undefined });
      expect(annotationBoundingBox(ann)).toEqual({ x: 0, y: 0, width: 240, height: 180 });
    });

    it('annotationBoundingBox applies generic defaults for other connectable types', () => {
      const ann = makeAnnotation({ type: 'rect', x: 0, y: 0, width: undefined, height: undefined });
      expect(annotationBoundingBox(ann)).toEqual({ x: 0, y: 0, width: 200, height: 48 });
    });

    it('annotationPortPosition returns correct midpoints for each port', () => {
      const ann = makeAnnotation({ type: 'rect', x: 100, y: 200, width: 80, height: 60 });

      expect(annotationPortPosition(ann, 'port-top')).toEqual({ x: 140, y: 200 });
      expect(annotationPortPosition(ann, 'port-right')).toEqual({ x: 180, y: 230 });
      expect(annotationPortPosition(ann, 'port-bottom')).toEqual({ x: 140, y: 260 });
      expect(annotationPortPosition(ann, 'port-left')).toEqual({ x: 100, y: 230 });
    });

    it('annotationPortPosition returns null for unknown port id', () => {
      const ann = makeAnnotation({ type: 'rect', x: 0, y: 0, width: 100, height: 100 });
      expect(annotationPortPosition(ann, 'port-unknown')).toBeNull();
    });

    it('CONNECTABLE_ANNOTATION_TYPES contains connectable types and excludes draw/arrow/line', () => {
      expect(CONNECTABLE_ANNOTATION_TYPES.has('rect')).toBeTrue();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('ellipse')).toBeTrue();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('diamond')).toBeTrue();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('image')).toBeTrue();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('text')).toBeTrue();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('sticky')).toBeTrue();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('draw')).toBeFalse();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('arrow')).toBeFalse();
      expect(CONNECTABLE_ANNOTATION_TYPES.has('line')).toBeFalse();
    });
  });

  describe('edgePolylinePoints with ports and annotations', () => {
    it('snaps to named port when sourcePort and targetPort are set', () => {
      const n1 = makeDiagramNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const n2 = makeDiagramNode({ id: 'b', position: { x: 200, y: 0 }, size: { width: 100, height: 60 } });

      const pts = edgePolylinePoints([n1, n2], { sourceId: 'a', targetId: 'b', sourcePort: 'port-right', targetPort: 'port-left' });

      expect(pts.length).toBe(2);
      expect(pts[0]).toEqual({ x: 100, y: 30 }); // right-center of n1
      expect(pts[1]).toEqual({ x: 200, y: 30 }); // left-center of n2
    });

    it('falls back to anchorTowardPoint when no port is specified', () => {
      const n1 = makeDiagramNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const n2 = makeDiagramNode({ id: 'b', position: { x: 200, y: 0 }, size: { width: 100, height: 60 } });

      const pts = edgePolylinePoints([n1, n2], { sourceId: 'a', targetId: 'b' });

      expect(pts.length).toBe(2);
      expect(pts[0].x).toBe(100); // right edge of n1 toward n2
    });

    it('resolves annotation-to-node edge using annotationMap', () => {
      const ann = makeAnnotation({ id: 'ann-1', type: 'rect', x: 0, y: 0, width: 80, height: 60 });
      const n2 = makeDiagramNode({ id: 'b', position: { x: 200, y: 0 }, size: { width: 100, height: 60 } });
      const annotationMap = new Map([['ann-1', ann]]);

      const pts = edgePolylinePoints(
        [n2],
        { sourceId: '', targetId: 'b', sourceAnnotationId: 'ann-1', sourcePort: 'port-right' },
        new Map([['b', n2]]),
        annotationMap,
      );

      expect(pts.length).toBe(2);
      expect(pts[0]).toEqual({ x: 80, y: 30 }); // right-center of annotation
    });

    it('resolves node-to-annotation edge using annotationMap', () => {
      const n1 = makeDiagramNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const ann = makeAnnotation({ id: 'ann-2', type: 'rect', x: 200, y: 0, width: 80, height: 60 });
      const annotationMap = new Map([['ann-2', ann]]);

      const pts = edgePolylinePoints(
        [n1],
        { sourceId: 'a', targetId: '', targetAnnotationId: 'ann-2', targetPort: 'port-left' },
        new Map([['a', n1]]),
        annotationMap,
      );

      expect(pts.length).toBe(2);
      expect(pts[1]).toEqual({ x: 200, y: 30 }); // left-center of annotation
    });

    it('returns empty array when source cannot be resolved', () => {
      const n2 = makeDiagramNode({ id: 'b', position: { x: 200, y: 0 }, size: { width: 100, height: 60 } });
      const pts = edgePolylinePoints([n2], { sourceId: 'missing', targetId: 'b' });
      expect(pts).toEqual([]);
    });

    it('includes waypoints between anchors', () => {
      const n1 = makeDiagramNode({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 60 } });
      const n2 = makeDiagramNode({ id: 'b', position: { x: 200, y: 0 }, size: { width: 100, height: 60 } });

      const pts = edgePolylinePoints([n1, n2], {
        sourceId: 'a', targetId: 'b',
        sourcePort: 'port-right', targetPort: 'port-left',
        waypoints: [{ x: 150, y: 80 }],
      });

      expect(pts.length).toBe(3);
      expect(pts[1]).toEqual({ x: 150, y: 80 });
    });
  });
});
