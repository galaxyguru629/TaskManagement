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
  styleUrl: './verify-email.component.scss',
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
