import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DiagramStore } from '../store/diagram.store';

export const azAuthGuard: CanActivateFn = () => {
  const store = inject(DiagramStore);
  const router = inject(Router);

  if (store.hasData()) return true;
  return router.createUrlTree(['/scan']);
};
