import { ComponentFixture, TestBed } from '@angular/core/testing';
import { makeDiagramNode } from '../../testing/test-helpers';
import { MinimapComponent } from './minimap.component';

describe('MinimapComponent', () => {
  let fixture: ComponentFixture<MinimapComponent>;
  let component: MinimapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinimapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MinimapComponent);
    component = fixture.componentInstance;
    component.visible = true;
    component.canvasWidth = 1000;
    component.canvasHeight = 500;
    component.scrollLeft = 100;
    component.scrollTop = 50;
    component.zoomLevel = 2;
    component.viewportWidth = 400;
    component.viewportHeight = 300;
    component.right = 10;
    component.nodes = [
      makeDiagramNode({
        id: 'n1',
        group: 'resourceGroup',
        groupId: 'rg1',
        position: { x: 100, y: 120 },
        size: { width: 120, height: 80 },
      }),
      makeDiagramNode({
        id: 'n2',
        group: 'resourceGroup',
        groupId: 'rg1',
        position: { x: 280, y: 180 },
        size: { width: 100, height: 60 },
      }),
    ];
    fixture.detectChanges();
  });

  it('computes group rects, node rects, and viewport', () => {
    expect(component.groupRects.length).toBe(1);
    expect(component.nodeRects.length).toBe(2);
    expect(component.viewport).not.toBeNull();
    expect(component.viewport?.w).toBeGreaterThan(0);
    expect(component.viewport?.h).toBeGreaterThan(0);
  });

  it('emits pan target from minimap mouse interaction', () => {
    const panSpy = jasmine.createSpy('panTo');
    component.panTo.subscribe(panSpy);
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    spyOn(svg, 'getBoundingClientRect').and.returnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 130,
      right: 200,
      bottom: 130,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    component.onMinimapMouseDown(new MouseEvent('mousedown', { clientX: 100, clientY: 65 }));

    expect(panSpy).toHaveBeenCalledTimes(1);
    const value = panSpy.calls.mostRecent().args[0] as { scrollLeft: number; scrollTop: number };
    expect(value.scrollLeft).toBeGreaterThanOrEqual(0);
    expect(value.scrollTop).toBeGreaterThanOrEqual(0);
  });
});
