import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { IconRegistryService } from './core/services/icon-registry.service';
import { NoPreloading, provideRouter, withComponentInputBinding, withHashLocation, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { demoInterceptor } from './core/interceptors/demo.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(NoPreloading),
      ...(environment.isDemo ? [withHashLocation()] : []),
    ),
    provideHttpClient(withFetch(), withInterceptors([demoInterceptor])),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [IconRegistryService],
      useFactory: (icons: IconRegistryService) => () => icons.loadManifest(),
    },
  ],
};
