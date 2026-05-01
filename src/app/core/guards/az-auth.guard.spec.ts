import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { azAuthGuard } from './az-auth.guard';
import { DiagramStore } from '../store/diagram.store';

describe('azAuthGuard', () => {
  function runGuard(): boolean | UrlTree {
    return TestBed.runInInjectionContext(() => azAuthGuard({} as never, {} as never) as boolean | UrlTree);
  }

  it('allows when store has diagram data', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DiagramStore, useValue: { hasData: () => true, canvasSessionMode: () => null } },
      ],
    });

    expect(runGuard()).toBeTrue();
  });

  it('allows when empty session mode is active', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DiagramStore, useValue: { hasData: () => false, canvasSessionMode: () => 'empty' } },
      ],
    });

    expect(runGuard()).toBeTrue();
  });

  it('redirects to /scan when no data and not empty session', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DiagramStore, useValue: { hasData: () => false, canvasSessionMode: () => null } },
      ],
    });

    const result = runGuard();
    expect(result instanceof UrlTree).toBeTrue();
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/scan');
  });
});
