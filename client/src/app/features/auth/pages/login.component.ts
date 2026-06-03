import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-screen">
      <section class="login-panel">
        <p class="eyebrow">Welcome</p>
        <h1>Manage projects in one polished workspace</h1>
        <p class="subtitle">Sign in or create an account to continue to your boards, tasks, and team activity.</p>
        <div class="actions">
          <button type="button" class="primary" (click)="signIn()">Sign in</button>
          <button type="button" class="secondary" (click)="signUp()">Create account</button>
        </div>
      </section>
    </main>
  `,
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);

  signIn(): void {
    this.auth.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'login',
      },
    });
  }

  signUp(): void {
    this.auth.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup',
      },
    });
  }
}
