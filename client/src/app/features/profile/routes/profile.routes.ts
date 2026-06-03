import { Routes } from '@angular/router';
import { authGuard } from '../../../core/auth/auth.guard';
import { profileGuard } from '../data-access/profile.guard';

export const profileRoutes: Routes = [
  {
    path: 'onboarding/profile',
    canActivate: [authGuard],
    loadComponent: () => import('../pages/onboarding-profile-page/onboarding-profile-page.component').then((m) => m.OnboardingProfilePageComponent),
  },
  {
    path: 'profile',
    canActivate: [authGuard, profileGuard],
    loadComponent: () => import('../pages/profile-page/profile-page.component').then((m) => m.ProfilePageComponent),
  },
];
