import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="callback-screen">
      <section class="callback-panel">
        <p class="eyebrow">Authentication</p>
        <h1>Completing sign-in</h1>
        <p class="loading">Preparing your dashboard...</p>
      </section>
    </main>
  `,
  styles: `
    .callback-screen {
      min-height: calc(100vh - 58px);
      display: grid;
      place-items: center;
      background: var(--surface-canvas);
      padding: 24px;
    }

    .callback-panel {
      width: min(420px, 100%);
      border-radius: var(--radius-4);
      border: 1px solid var(--border);
      background: var(--surface-panel);
      color: var(--text);
      box-shadow: var(--shadow-card);
      padding: 26px;
      display: grid;
      gap: 10px;
    }

    .eyebrow,
    h1,
    .loading {
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
      font-size: 26px;
      line-height: 1.2;
    }

    .loading {
      color: var(--text-subtle);
    }
  `,
})
export class CallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.auth.isAuthenticated$.subscribe((ok) => {
      if (ok) {
        void this.router.navigate(['/home']);
      }
    });
  }
}
