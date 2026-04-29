import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { NoPreloading, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withPreloading(NoPreloading)),
    provideHttpClient(withFetch()),
  ],
};
