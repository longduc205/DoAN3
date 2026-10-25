import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth/auth.service';

interface NavGroup {
  labelKey: string;
  items: { path: string; labelKey: string }[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  template: `
    <div class="min-h-screen flex gap-6 p-3 md:p-4">
      <aside class="glass rounded-[22px] w-60 shrink-0 hidden md:flex flex-col p-4 sticky top-4 h-[calc(100vh-2rem)]">
        <div class="flex items-center gap-2 px-2 mb-6">
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26">
            <path d="M3 6.5l5 14 5-10 5 10 5-14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="13" cy="4" r="2.2" class="fill-accent" />
          </svg>
          <div>
            <div class="font-semibold leading-tight">WebSec AI</div>
            <div class="text-xs text-ink-muted">{{ 'app.workspace' | transloco }}</div>
          </div>
        </div>
        <nav class="flex-1 flex flex-col gap-4 overflow-y-auto" [attr.aria-label]="'nav.main' | transloco">
          @for (group of nav; track group.labelKey) {
            <div>
              <div class="px-2 mb-1 text-xs text-ink-muted">{{ group.labelKey | transloco }}</div>
              @for (item of group.items; track item.path) {
                <a [routerLink]="item.path" routerLinkActive="bg-black/5 font-medium"
                   class="block px-2 py-1.5 rounded-lg text-sm hover:bg-black/5">{{ item.labelKey | transloco }}</a>
              }
            </div>
          }
        </nav>
        <div class="border-t border-line pt-3 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ auth.user()?.fullName }}</div>
            <div class="text-xs text-ink-muted truncate">{{ auth.user()?.roles?.join(', ') }}</div>
          </div>
          <button type="button" class="btn h-8 px-2" (click)="auth.logout()">{{ 'auth.logout' | transloco }}</button>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col gap-4">
        <header class="flex items-center justify-between gap-4 px-1">
          <nav class="flex md:hidden gap-3 text-sm overflow-x-auto">
            <a routerLink="/dashboard">{{ 'nav.dashboard' | transloco }}</a>
            <a routerLink="/projects">{{ 'nav.projects' | transloco }}</a>
            <a routerLink="/scans">{{ 'nav.scans' | transloco }}</a>
            <button type="button" (click)="auth.logout()">{{ 'auth.logout' | transloco }}</button>
          </nav>
          <span class="flex-1"></span>
          <button type="button" class="mono hover:text-ink" (click)="toggleLang()" [attr.aria-label]="'app.switchLanguage' | transloco">
            {{ transloco.getActiveLang() === 'vi' ? 'EN' : 'VI' }}
          </button>
        </header>
        <main class="flex-1 min-w-0"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly transloco = inject(TranslocoService);

  protected readonly nav: NavGroup[] = [
    { labelKey: 'nav.groupWorkspace', items: [{ path: '/dashboard', labelKey: 'nav.dashboard' }, { path: '/projects', labelKey: 'nav.projects' }, { path: '/targets', labelKey: 'nav.targets' }] },
    { labelKey: 'nav.groupScan', items: [{ path: '/scans', labelKey: 'nav.scans' }] },
    { labelKey: 'nav.groupSecurity', items: [{ path: '/vulnerabilities', labelKey: 'nav.vulnerabilities' }, { path: '/reports', labelKey: 'nav.reports' }, { path: '/ai-assistant', labelKey: 'nav.aiAssistant' }] },
    { labelKey: 'nav.groupAdmin', items: [{ path: '/users', labelKey: 'nav.users' }, { path: '/roles', labelKey: 'nav.roles' }] },
  ];

  protected toggleLang(): void {
    this.transloco.setActiveLang(this.transloco.getActiveLang() === 'vi' ? 'en' : 'vi');
  }
}
