import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { ShellComponent } from './core/layout/shell.component';

const placeholder = (titleKey: string) => ({
  loadComponent: () => import('./shared/components/coming-later.page').then((m) => m.ComingLaterPage),
  data: { titleKey },
});

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'projects', loadComponent: () => import('./features/projects/project-list.page').then((m) => m.ProjectListPage) },
      { path: 'projects/new', loadComponent: () => import('./features/projects/project-list.page').then((m) => m.ProjectListPage), data: { openCreate: true } },
      { path: 'projects/:id', loadComponent: () => import('./features/projects/project-detail.page').then((m) => m.ProjectDetailPage) },
      { path: 'targets', loadComponent: () => import('./features/targets/target-list.page').then((m) => m.TargetListPage) },
      { path: 'scans', loadComponent: () => import('./features/scans/scan-list.page').then((m) => m.ScanListPage) },
      { path: 'scans/:id', loadComponent: () => import('./features/scans/scan-detail.page').then((m) => m.ScanDetailPage) },
      { path: 'vulnerabilities', ...placeholder('nav.vulnerabilities') },
      { path: 'vulnerabilities/:id', ...placeholder('nav.vulnerabilities') },
      { path: 'reports', ...placeholder('nav.reports') },
      { path: 'users', ...placeholder('nav.users') },
      { path: 'roles', ...placeholder('nav.roles') },
      { path: 'ai-assistant', ...placeholder('nav.aiAssistant') },
    ],
  },
  { path: '**', redirectTo: '' },
];
