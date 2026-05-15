import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CanvasSvgLayerComponent } from './canvas-svg-layer.component';
import { makeAnnotation } from '../../../testing/test-helpers';

describe('CanvasSvgLayerComponent', () => {
  let fixture: ComponentFixture<CanvasSvgLayerComponent>;
  let component: CanvasSvgLayerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CanvasSvgLayerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CanvasSvgLayerComponent);
    component = fixture.componentInstance;
    component.activeTool = 'pointer';
  });

  it('renders resize handles for selected rect annotations used as drawn containers', () => {
    component.annotations = [
      makeAnnotation({
        id: 'container-rect',
        type: 'rect',
        x: 100,
        y: 100,
        width: 240,
        height: 180,
        container: { kind: 'sub', name: 'Custom Sub', collapsed: false },
      }),
    ];
    component.selectedAnnotationId = 'container-rect';

    fixture.detectChanges();

    const handles = fixture.nativeElement.querySelectorAll('rect[width="8"][height="8"]');
    expect(handles.length).toBe(8);
  });
});
