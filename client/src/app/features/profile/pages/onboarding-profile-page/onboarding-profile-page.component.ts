import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProfileService } from '../../data-access/profile.service';

@Component({
  selector: 'app-onboarding-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './onboarding-profile-page.component.html',
  styleUrl: './onboarding-profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingProfilePageComponent {
  private readonly profile = inject(ProfileService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly displayName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly avatarDataUrl = signal<string | null>(null);
  readonly avatarFileName = signal('');

  submit(event?: SubmitEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.displayName.setValue(this.displayName.value.trim());
    this.displayName.markAsTouched();

    if (this.displayName.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.profile.updateProfile(this.displayName.value, this.avatarDataUrl()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/home';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: unknown) => {
        this.error.set(profileErrorMessage(error));
        this.saving.set(false);
      },
    });
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.error.set('Please choose an image file.');
      return;
    }
    if (file.size > 1_500_000) {
      this.error.set('Avatar must be 1.5 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      this.avatarDataUrl.set(dataUrl);
      this.avatarFileName.set(file.name);
      this.error.set(null);
    };
    reader.onerror = () => {
      this.error.set('Could not read image file.');
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.avatarDataUrl.set(null);
    this.avatarFileName.set('');
    this.error.set(null);
  }
}

function profileErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('user_profiles')) {
    return 'Profile storage is not ready. Run the server migrations, then try again.';
  }

  if (message.includes('Display name') || message.includes('Avatar')) {
    return message;
  }

  return 'Could not save your profile. Please try again.';
}
