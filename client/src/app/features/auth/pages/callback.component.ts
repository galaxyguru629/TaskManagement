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
  styleUrl: './callback.component.scss',
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
