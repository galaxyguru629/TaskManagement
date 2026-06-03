import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ProfileService } from './profile.service';

export const profileGuard: CanActivateFn = (_route, state) => {
  const profile = inject(ProfileService);
  const router = inject(Router);

  const cached = profile.me();
  if (cached?.isOnboarded) {
    return true;
  }
  if (cached && !cached.isOnboarded) {
    return router.createUrlTree(['/onboarding/profile'], {
      queryParams: state.url === '/onboarding/profile' ? undefined : { returnUrl: state.url },
    });
  }

  return profile.ensureMe().pipe(
    map((me) => {
      if (me?.isOnboarded) {
        return true;
      }

      return router.createUrlTree(['/onboarding/profile'], {
        queryParams: state.url === '/onboarding/profile' ? undefined : { returnUrl: state.url },
      });
    }),
    catchError((error: unknown) => {
      if (hasGraphqlCode(error, 'UNAUTHENTICATED')) {
        return of(router.createUrlTree(['/login']));
      }
      return of(router.createUrlTree(['/login']));
    }),
  );
};

export function hasGraphqlCode(error: unknown, code: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    graphQLErrors?: Array<{ extensions?: { code?: string } }>;
    networkError?: { result?: { errors?: Array<{ extensions?: { code?: string } }> } };
  };
  return (
    candidate.graphQLErrors?.some((item) => item.extensions?.code === code) === true ||
    candidate.networkError?.result?.errors?.some((item) => item.extensions?.code === code) === true
  );
}
