import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../data-access/profile.service';
import type { UserProfileFieldsFragment } from '../../../../graphql/generated/graphql';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private readonly profileService = inject(ProfileService);

  readonly profile = signal<UserProfileFieldsFragment | null>(null);
  readonly showSkeleton = signal(false);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);
  readonly avatarDataUrl = signal<string | null>(null);
  readonly avatarFileName = signal('');
  readonly displayName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(80)],
  });

  ngOnInit(): void {
    requestAnimationFrame(() => {
      this.showSkeleton.set(true);
      this.loading.set(true);
      this.profileService.loadMe().subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.displayName.setValue(profile?.displayName ?? '');
          this.avatarDataUrl.set(profile?.pictureUrl ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load your profile.');
          this.loading.set(false);
        },
      });
    });
  }

  save(event?: SubmitEvent): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.displayName.setValue(this.displayName.value.trim());
    this.displayName.markAsTouched();

    if (this.displayName.invalid || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    this.profileService.updateProfile(this.displayName.value, this.avatarDataUrl()).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.displayName.setValue(profile.displayName);
        this.avatarDataUrl.set(profile.pictureUrl ?? null);
        this.saved.set(true);
        this.saving.set(false);
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
      this.saved.set(false);
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
    this.saved.set(false);
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

  return 'Could not save your profile.';
}
