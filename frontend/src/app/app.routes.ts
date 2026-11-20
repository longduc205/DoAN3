import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guard';
import { ShellComponent } from './core/layout/shell.component';

const placeholder = (titleKey: string, permission: string) => ({
  loadComponent: () => import('./shared/components/coming-later.page').then((m) => m.ComingLaterPage),
  canActivate: [permissionGuard],
  data: { titleKey, permission },
});

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: '403', loadComponent: () => import('./shared/components/forbidden.page').then((m) => m.ForbiddenPage) },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'projects', loadComponent: () => import('./features/projects/project-list.page').then((m) => m.ProjectListPage) },
      {
        path: 'projects/new', canActivate: [permissionGuard], data: { openCreate: true, permission: 'Project.Create' },
        loadComponent: () => import('./features/projects/project-list.page').then((m) => m.ProjectListPage),
      },
      { path: 'projects/:id', loadComponent: () => import('./features/projects/project-detail.page').then((m) => m.ProjectDetailPage) },
      { path: 'targets', loadComponent: () => import('./features/targets/target-list.page').then((m) => m.TargetListPage) },
      { path: 'scans', canActivate: [permissionGuard], data: { permission: 'Scan.View' }, loadComponent: () => import('./features/scans/scan-list.page').then((m) => m.ScanListPage) },
      {
        path: 'scans/new', canActivate: [permissionGuard], data: { permission: 'Scan.Create' },
        loadComponent: () => import('./features/scans/scan-wizard.page').then((m) => m.ScanWizardPage),
      },
      { path: 'scans/:id', canActivate: [permissionGuard], data: { permission: 'Scan.View' }, loadComponent: () => import('./features/scans/scan-detail.page').then((m) => m.ScanDetailPage) },
      { path: 'vulnerabilities', ...placeholder('nav.vulnerabilities', 'Vulnerability.View') },
      { path: 'vulnerabilities/:id', ...placeholder('nav.vulnerabilities', 'Vulnerability.View') },
      { path: 'reports', ...placeholder('nav.reports', 'Report.Generate') },
      { path: 'users', ...placeholder('nav.users', 'User.Manage') },
      { path: 'roles', ...placeholder('nav.roles', 'Role.Manage') },
      { path: 'ai-assistant', ...placeholder('nav.aiAssistant', 'AI.Ask') },
    ],
  },
  { path: '**', redirectTo: '' },
];
