import { Routes } from '@angular/router';
import { authGuard } from '../../../core/auth/auth.guard';
import { profileGuard } from '../../profile/data-access/profile.guard';

export const boardRoutes: Routes = [
  {
    path: 'home',
    canActivate: [authGuard, profileGuard],
    loadComponent: () => import('../pages/home-page/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'boards/create',
    canActivate: [authGuard, profileGuard],
    loadComponent: () => import('../pages/create-board-page/create-board-page.component').then((m) => m.CreateBoardPageComponent),
  },
  {
    path: 'board/:boardId',
    canActivate: [authGuard, profileGuard],
    loadComponent: () => import('../pages/board-page/board-page.component').then((m) => m.BoardPageComponent),
  },
];
