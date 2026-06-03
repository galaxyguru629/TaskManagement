import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { HomePageComponent } from './features/board/pages/home-page/home-page.component';
import { CreateBoardPageComponent } from './features/board/pages/create-board-page/create-board-page.component';
import { BoardPageComponent } from './features/board/pages/board-page/board-page.component';
import { ProfilePageComponent } from './features/profile/pages/profile-page/profile-page.component';
import { profileGuard } from './features/profile/data-access/profile.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'callback',
    loadComponent: () =>
      import('./features/auth/pages/callback.component').then((m) => m.CallbackComponent),
  },
  {
    path: 'verify-email',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'home',
    canActivate: [authGuard, profileGuard],
    component: HomePageComponent,
  },
  {
    path: 'dashboard',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'boards/create',
    canActivate: [authGuard, profileGuard],
    component: CreateBoardPageComponent,
  },
  {
    path: 'board/:boardId',
    canActivate: [authGuard, profileGuard],
    component: BoardPageComponent,
  },
  {
    path: 'onboarding/profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/pages/onboarding-profile-page/onboarding-profile-page.component').then(
        (m) => m.OnboardingProfilePageComponent,
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard, profileGuard],
    component: ProfilePageComponent,
  },
  { path: '**', redirectTo: 'home' },
];
