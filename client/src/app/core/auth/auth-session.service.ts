import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { Apollo } from 'apollo-angular';
import { disposeApolloWs } from '../apollo/create-apollo';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tokenService = inject(TokenService);
  private readonly apollo = inject(Apollo);

  logout(): void {
    this.tokenService.clear();
    disposeApolloWs();
    void this.apollo.client.clearStore();

    // Local logout avoids Auth0 "Allowed Logout URLs" requirement. The SDK clears
    // app tokens/cache; we then route to /login. For full Auth0 SSO logout (clears
    // Auth0 session cookie), add http://localhost:4200/login to Allowed Logout URLs
    // and switch to federated logout with returnTo.
    this.auth.logout({ openUrl: false }).subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
