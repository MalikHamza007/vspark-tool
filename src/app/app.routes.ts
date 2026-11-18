import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], data: { mode: 'login' }, loadComponent: () => import('./pages/auth.page').then((m) => m.AuthPage) },
  { path: 'register', canActivate: [guestGuard], data: { mode: 'register' }, loadComponent: () => import('./pages/auth.page').then((m) => m.AuthPage) },
  {
    path: '', canActivate: [authGuard], loadComponent: () => import('./shared/shell').then((m) => m.Shell),
    children: [
      { path: '', title: 'Dashboard · VSpark', loadComponent: () => import('./pages/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'studio', title: 'Caption Studio · VSpark', loadComponent: () => import('./pages/studio.page').then((m) => m.StudioPage) },
      { path: 'posts', title: 'Scheduled Feed · VSpark', loadComponent: () => import('./pages/posts.page').then((m) => m.PostsPage) },
      { path: 'settings', title: 'Notifications · VSpark', loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage) },
      { path: 'admin', title: 'Admin · VSpark', canActivate: [roleGuard], data: { roles: ['admin'] }, loadComponent: () => import('./pages/admin.page').then((m) => m.AdminPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
