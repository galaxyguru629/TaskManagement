import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="verify-screen">
      <section class="verify-panel">
        <p class="eyebrow">Email verification</p>
        <h1>Verify your email to continue</h1>
        <p class="subtitle">
          We detected that your email is not verified yet. Please verify it from your inbox, then continue.
        </p>
        <div class="actions">
          <button type="button" class="primary" (click)="refresh()">I've verified my email</button>
          <button type="button" class="secondary" (click)="logout()">Sign out</button>
        </div>
      </section>
    </main>
  `,
  styles: `
    .verify-screen {
      min-height: calc(100vh - 58px);
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 15% 15%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 35%),
        var(--surface-canvas);
      padding: 24px;
    }
    .verify-panel {
      width: min(460px, 100%);
      border-radius: var(--radius-4);
      border: 1px solid var(--border);
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
      font-size: 28px;
      line-height: 1.2;
    }
    .subtitle {
      color: var(--text-subtle);
      line-height: 1.5;
    }
    .actions {
      display: grid;
      gap: 8px;
      margin-top: 4px;
    }
    button {
      border-radius: var(--radius-2);
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
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
export class VerifyEmailComponent {
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);

  refresh(): void {
    void this.router.navigateByUrl('/home');
  }

  logout(): void {
    this.authSession.logout();
  }
}
