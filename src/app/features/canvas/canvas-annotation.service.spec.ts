import { CanvasAnnotationService } from './canvas-annotation.service';
import { Annotation } from '../../core/models/annotation.model';

describe('CanvasAnnotationService reorder', () => {
  let service: CanvasAnnotationService;

  beforeEach(() => {
    service = new CanvasAnnotationService();
  });

  function makeAnn(id: string): Annotation {
    return {
      id,
      type: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 60,
      color: '#000000',
      strokeWidth: 2,
      fill: '#ffffff',
    };
  }

  it('bringToFront moves annotation to end of render list', () => {
    const list = [makeAnn('a'), makeAnn('b'), makeAnn('c')];

    const result = service.bringToFront(list, 'b');

    expect(result.map(ann => ann.id)).toEqual(['a', 'c', 'b']);
  });

  it('sendToBack moves annotation to start of render list', () => {
    const list = [makeAnn('a'), makeAnn('b'), makeAnn('c')];

    const result = service.sendToBack(list, 'b');

    expect(result.map(ann => ann.id)).toEqual(['b', 'a', 'c']);
  });

  it('bringToFront is a no-op for missing id or already-front item', () => {
    const list = [makeAnn('a'), makeAnn('b'), makeAnn('c')];

    expect(service.bringToFront(list, 'missing')).toBe(list);
    expect(service.bringToFront(list, 'c')).toBe(list);
  });

  it('sendToBack is a no-op for missing id or already-back item', () => {
    const list = [makeAnn('a'), makeAnn('b'), makeAnn('c')];

    expect(service.sendToBack(list, 'missing')).toBe(list);
    expect(service.sendToBack(list, 'a')).toBe(list);
  });
});
