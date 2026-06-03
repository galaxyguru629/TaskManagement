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
  styles: `
    .login-screen {
      min-height: calc(100vh - 58px);
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 15% 15%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 35%),
        var(--surface-canvas);
      padding: 28px;
    }
    .login-panel {
      width: min(460px, 100%);
      border: 1px solid var(--border);
      border-radius: var(--radius-4);
      background: var(--surface-panel);
      color: var(--text);
      box-shadow: var(--shadow-modal);
      padding: 30px;
      display: grid;
      gap: 14px;
    }
    .eyebrow,
    h1,
    .subtitle {
      margin: 0;
    }
    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    h1 {
      font-size: 30px;
      line-height: 1.2;
    }
    .subtitle {
      color: var(--text-subtle);
      line-height: 1.5;
    }
    button {
      border-radius: var(--radius-2);
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .actions {
      display: grid;
      gap: 8px;
      margin-top: 4px;
    }
    .primary {
      border: 0;
      background: var(--accent);
      color: var(--text-on-accent);
    }
    .primary:hover {
      background: var(--accent-hover);
    }
    .secondary {
      border: 1px solid var(--border-strong);
      background: var(--surface-interactive);
      color: var(--text);
    }
    .secondary:hover {
      background: color-mix(in srgb, var(--surface-interactive) 75%, var(--accent-soft));
    }
  `,
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
