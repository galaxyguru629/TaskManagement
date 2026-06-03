import { Routes } from '@angular/router';
import { authRoutes } from './features/auth/routes/auth.routes';
import { boardRoutes } from './features/board/routes/board.routes';
import { profileRoutes } from './features/profile/routes/profile.routes';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  ...authRoutes,
  {
    path: 'dashboard',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  ...boardRoutes,
  ...profileRoutes,
  { path: '**', redirectTo: 'home' },
];
