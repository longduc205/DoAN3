import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';

interface NavItem { path: string; labelKey: string; permission: string; exact?: boolean }
interface NavGroup { labelKey: string; items: NavItem[] }

// Sidebar groups from the canvas sitemap (01 · Sitemap / IA). Items the user has no permission for are hidden.
const NAV: NavGroup[] = [
  { labelKey: 'nav.groupWorkspace', items: [
    { path: '/dashboard', labelKey: 'nav.dashboard', permission: 'Project.View' },
    { path: '/projects', labelKey: 'nav.projects', permission: 'Project.View' },
  ] },
  { labelKey: 'nav.groupScan', items: [
    { path: '/scans', labelKey: 'nav.scans', permission: 'Scan.View', exact: true },
    { path: '/scans/new', labelKey: 'nav.newScan', permission: 'Scan.Create' },
  ] },
  { labelKey: 'nav.groupSecurity', items: [
    { path: '/vulnerabilities', labelKey: 'nav.vulnerabilities', permission: 'Vulnerability.View' },
    { path: '/my-items', labelKey: 'nav.myItems', permission: 'Vulnerability.Update' },
  ] },
  { labelKey: 'nav.groupInsights', items: [
    { path: '/reports', labelKey: 'nav.reports', permission: 'Report.Generate' },
    { path: '/ai-assistant', labelKey: 'nav.aiAssistant', permission: 'AI.Ask' },
  ] },
  { labelKey: 'nav.groupAdmin', items: [
    { path: '/users', labelKey: 'nav.users', permission: 'User.Manage' },
  ] },
];

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
          @for (group of nav(); track group.labelKey) {
            <div>
              <div class="px-2 mb-1 text-xs text-ink-muted">{{ group.labelKey | transloco }}</div>
              @for (item of group.items; track item.path) {
                <a [routerLink]="item.path" routerLinkActive="bg-black/5 font-medium" [routerLinkActiveOptions]="{ exact: !!item.exact }"
                   ariaCurrentWhenActive="page" class="block px-2 py-1.5 rounded-lg text-sm hover:bg-black/5">{{ item.labelKey | transloco }}</a>
              }
            </div>
          }
        </nav>
        <div class="border-t border-line pt-3 flex items-center justify-between gap-2">
          <span class="grid place-items-center size-8 shrink-0 rounded-full bg-ink text-white text-xs font-semibold" aria-hidden="true">{{ initials() }}</span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium truncate">{{ auth.user()?.fullName }}</div>
            <div class="text-xs text-ink-muted truncate">{{ auth.user()?.roles?.join(', ') }}</div>
          </div>
          <button type="button" class="btn h-8 px-2" (click)="auth.logout()">{{ 'auth.logout' | transloco }}</button>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col gap-4">
        <header class="flex items-center justify-between gap-4 px-1">
          <nav class="flex md:hidden gap-3 text-sm overflow-x-auto" [attr.aria-label]="'nav.main' | transloco">
            @for (group of nav(); track group.labelKey) {
              @for (item of group.items; track item.path) { <a [routerLink]="item.path" class="whitespace-nowrap">{{ item.labelKey | transloco }}</a> }
            }
            <button type="button" (click)="auth.logout()">{{ 'auth.logout' | transloco }}</button>
          </nav>
          @if (crumb(); as c) {
            <nav class="hidden md:flex items-center gap-1.5 text-sm text-ink-muted" [attr.aria-label]="'nav.breadcrumb' | transloco">
              <span>{{ c.group | transloco }}</span><span aria-hidden="true">/</span>
              <a [routerLink]="c.path" class="text-ink hover:underline">{{ c.label | transloco }}</a>
            </nav>
          }
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
  private readonly router = inject(Router);

  protected readonly nav = computed(() =>
    NAV.map((g) => ({ ...g, items: g.items.filter((i) => this.auth.hasPermission(i.permission)) })).filter((g) => g.items.length > 0),
  );
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '').split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase(),
  );

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  /** Group / page of the longest nav path that prefixes the current URL. */
  protected readonly crumb = computed(() => {
    const url = this.url().split('?')[0];
    let best: { group: string; label: string; path: string } | null = null;
    for (const g of NAV) for (const i of g.items)
      if ((url === i.path || url.startsWith(i.path + '/')) && i.path.length > (best?.path.length ?? 0))
        best = { group: g.labelKey, label: i.labelKey, path: i.path };
    return best;
  });

  protected toggleLang(): void {
    this.transloco.setActiveLang(this.transloco.getActiveLang() === 'vi' ? 'en' : 'vi');
  }
}
