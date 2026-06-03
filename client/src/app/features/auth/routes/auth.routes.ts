import { Routes } from '@angular/router';
import { authGuard } from '../../../core/auth/auth.guard';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('../pages/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'callback',
    loadComponent: () => import('../pages/callback.component').then((m) => m.CallbackComponent),
  },
  {
    path: 'verify-email',
    canActivate: [authGuard],
    loadComponent: () => import('../pages/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
];
