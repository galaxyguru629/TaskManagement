import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { APP_BASE_HREF } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0 } from '@auth0/auth0-angular';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { inject } from '@angular/core';
import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { createApolloOptions } from './core/apollo/create-apollo';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: APP_BASE_HREF, useValue: '/' },
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};

appConfig.providers.push(
  provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    authorizationParams: {
      redirect_uri: environment.auth0.redirectUri,
      audience: environment.auth0.audience,
      scope: 'openid profile email',
    },
    httpInterceptor: {
      allowedList: [`${environment.graphqlHttpUri}/*`],
    },
  }),
);

appConfig.providers.push(
  provideApollo(() => {
    const httpLink = inject(HttpLink);
    return createApolloOptions(httpLink);
  }),
);
