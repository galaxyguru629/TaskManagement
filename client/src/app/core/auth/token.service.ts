import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

const REFRESH_BUFFER_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly auth = inject(AuthService, { optional: true });
  private readonly expiresAt = signal<number | null>(null);
  private refreshPromise: Promise<string | null> | null = null;

  async getAccessToken(): Promise<string | null> {
    if (!this.auth) {
      return null;
    }
    const now = Date.now();
    const expiry = this.expiresAt();
    if (expiry && expiry - now > REFRESH_BUFFER_MS) {
      return this.cachedToken;
    }
    return this.refreshAccessToken();
  }

  private cachedToken: string | null = null;

  async refreshAccessToken(): Promise<string | null> {
    if (!this.auth) {
      return null;
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string | null> {
    if (!this.auth) {
      return null;
    }
    try {
      const token = await firstValueFrom(
        this.auth.getAccessTokenSilently({
          authorizationParams: {
            audience: environment.auth0.audience,
            scope: 'openid profile email',
          },
        }),
      );
      this.cachedToken = token;
      this.expiresAt.set(Date.now() + 3_300_000);
      return token;
    } catch {
      this.cachedToken = null;
      this.expiresAt.set(null);
      return null;
    }
  }

  clear(): void {
    this.cachedToken = null;
    this.expiresAt.set(null);
  }
}
