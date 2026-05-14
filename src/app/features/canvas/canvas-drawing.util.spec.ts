import { DrawingRuntimeState, DrawingStyleState, onDrawEnd, onDrawMove, onDrawStart, resetDrawingRuntime } from './canvas-drawing.util';

describe('canvas-drawing.util', () => {
  const runtime: DrawingRuntimeState = {
    isDrawing: false,
    drawPoints: [],
    shapeStart: null,
    previewPath: '',
    previewArrow: null,
    previewLine: null,
    previewRect: null,
    previewDiamond: null,
    previewEllipse: null,
  };

  const style: DrawingStyleState = {
    activeTool: 'draw',
    activeColor: '#111111',
    activeFontFamily: 'Arial',
    activeFontSize: 14,
    activeStrokeWidth: 2,
    activeStrokeStyle: 'solid',
    activeSloppiness: 0,
    activeEdgeRouting: 'straight',
    activeEdgeMode: 'none',
    activeFill: 'none',
    activeFillOpacity: 1,
  };

  it('creates editable sticky annotation on sticky tool start', () => {
    const stickyStyle = { ...style, activeTool: 'sticky' as const };
    const result = onDrawStart(runtime, stickyStyle, { x: 5, y: 10 });

    expect(result.createdAnnotation?.type).toBe('sticky');
    expect(result.createdAnnotation?.width).toBe(180);
    expect(result.shouldStartEdit).toBeTrue();
  });

  it('builds freehand path and creates draw annotation on end', () => {
    const started = onDrawStart(runtime, style, { x: 0, y: 0 }).next;
    const moved = onDrawMove(started, style, { x: 10, y: 10 });
    const ended = onDrawEnd(moved, style, { x: 20, y: 5 });

    expect(moved.previewPath).toContain('M 0 0');
    expect(ended.createdAnnotation?.type).toBe('draw');
    expect(ended.createdAnnotation?.pathData).toContain('L 10 10');
    expect(ended.next.isDrawing).toBeFalse();
  });

  it('does not create tiny rectangle annotation', () => {
    const rectStyle = { ...style, activeTool: 'rect' as const };
    const started = onDrawStart(runtime, rectStyle, { x: 10, y: 10 }).next;
    const ended = onDrawEnd(started, rectStyle, { x: 12, y: 13 });

    expect(ended.createdAnnotation).toBeUndefined();
  });

  it('creates RG container annotation with container metadata', () => {
    const containerStyle = { ...style, activeTool: 'rgContainer' as const };
    const started = onDrawStart(runtime, containerStyle, { x: 10, y: 10 }).next;
    const ended = onDrawEnd(started, containerStyle, { x: 260, y: 190 });

    expect(ended.createdAnnotation?.type).toBe('rect');
    expect(ended.createdAnnotation?.container?.kind).toBe('rg');
    expect(ended.createdAnnotation?.container?.name).toBe('Resource Group');
    expect(ended.createdAnnotation?.container?.collapsed).toBeFalse();
  });

  it('does not create tiny subscription container annotation', () => {
    const containerStyle = { ...style, activeTool: 'subscriptionContainer' as const };
    const started = onDrawStart(runtime, containerStyle, { x: 10, y: 10 }).next;
    const ended = onDrawEnd(started, containerStyle, { x: 12, y: 13 });

    expect(ended.createdAnnotation).toBeUndefined();
  });

  it('resetDrawingRuntime clears runtime previews', () => {
    const next = resetDrawingRuntime({
      ...runtime,
      isDrawing: true,
      drawPoints: [[1, 1]],
      previewPath: 'M 1 1',
      shapeStart: { x: 1, y: 1 },
      previewRect: { x: 1, y: 1, w: 2, h: 2 },
    });

    expect(next.isDrawing).toBeFalse();
    expect(next.drawPoints).toEqual([]);
    expect(next.previewRect).toBeNull();
  });
});
