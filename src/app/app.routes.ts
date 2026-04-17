import { Routes } from '@angular/router';
import { azAuthGuard } from './core/guards/az-auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'scan', pathMatch: 'full' },
  {
    path: 'scan',
    loadComponent: () =>
      import('./features/scan/scan.component').then(m => m.ScanComponent),
  },
  {
    path: 'canvas',
    loadComponent: () =>
      import('./features/canvas/canvas.component').then(m => m.CanvasComponent),
    canActivate: [azAuthGuard],
  },
  { path: '**', redirectTo: 'scan' },
];
