import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { filter, take } from 'rxjs';
import { AuthSessionService } from './core/auth/auth-session.service';
import { disposeApolloWs } from './core/apollo/create-apollo';
import { ThemeService } from './core/theme/theme.service';
import { ToastContainerComponent } from './core/toast/toast-container.component';
import { ProfileService } from './features/profile/data-access/profile.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet, ToastContainerComponent, AsyncPipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly profileService = inject(ProfileService);
  private readonly authSession = inject(AuthSessionService);
  @ViewChild('profileMenuRoot') private profileMenuRoot?: ElementRef<HTMLElement>;
  readonly profileMenuOpen = signal(false);

  readonly profileLabel = computed(() => {
    const profile = this.profileService.me();
    return profile?.displayName?.trim() || profile?.email?.trim() || null;
  });

  readonly profileAvatar = computed(() => {
    const profile = this.profileService.me();
    if (profile?.pictureUrl) return profile.pictureUrl;
    const name = profile?.displayName || profile?.email || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`;
  });

  ngOnInit(): void {
    this.auth.isAuthenticated$
      .pipe(
        filter((authenticated) => authenticated),
        take(1),
      )
      .subscribe(() => {
        this.profileService.ensureMe().subscribe();
      });
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((open) => !open);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  logout(): void {
    this.closeProfileMenu();
    this.authSession.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.profileMenuOpen()) return;
    const target = event.target as Node | null;
    const menuRoot = this.profileMenuRoot?.nativeElement;
    if (!target || !menuRoot || !menuRoot.contains(target)) {
      this.closeProfileMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    this.closeProfileMenu();
  }

  ngOnDestroy(): void {
    disposeApolloWs();
  }
}
