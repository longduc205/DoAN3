import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';
import { VulnerabilitiesApi } from '../../features/api.services';
import { AuthService } from '../auth/auth.service';

interface NavItem { path: string; labelKey: string; permission: string; icon: string; exact?: boolean; hideForRoles?: string[] }
interface NavGroup { labelKey: string; items: NavItem[] }

// Sidebar groups from the canvas sitemap (01 · Sitemap / IA). Items the user has no permission for are hidden.
const NAV: NavGroup[] = [
  { labelKey: 'nav.groupWorkspace', items: [
    { path: '/dashboard', labelKey: 'nav.dashboard', permission: 'Project.View', icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-3H4z' },
    { path: '/projects', labelKey: 'nav.projects', permission: 'Project.View', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', hideForRoles: ['Developer'] },
  ] },
  { labelKey: 'nav.groupScan', items: [
    { path: '/scans', labelKey: 'nav.scans', permission: 'Scan.View', icon: 'M3 12a9 9 0 1 0 9-9M12 12l6-6M12 7v5', hideForRoles: ['Developer'], exact: true },
    { path: '/scans/new', labelKey: 'nav.newScan', permission: 'Scan.Create', icon: 'M12 5v14M5 12h14', hideForRoles: ['Developer'] },
  ] },
  { labelKey: 'nav.groupSecurity', items: [
    { path: '/vulnerabilities', labelKey: 'nav.vulnerabilities', permission: 'Vulnerability.View', icon: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z', hideForRoles: ['Developer'] },
    { path: '/my-items', labelKey: 'nav.myItems', permission: 'Vulnerability.Update', icon: 'M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9' },
  ] },
  { labelKey: 'nav.groupInsights', items: [
    { path: '/reports', labelKey: 'nav.reports', permission: 'Report.View', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
    { path: '/ai-assistant', labelKey: 'nav.aiAssistant', permission: 'AI.Ask', icon: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z' },
  ] },
  { labelKey: 'nav.groupAdmin', items: [
    { path: '/users', labelKey: 'nav.users', permission: 'User.Manage', icon: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8' },
    { path: '/audit', labelKey: 'nav.audit', permission: 'AuditLog.View', icon: 'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5' },
  ] },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoPipe],
  template: `
    <div class="min-h-screen flex gap-6 p-3 md:p-4">
      <aside class="no-print glass rounded-[22px] w-60 shrink-0 hidden md:flex flex-col p-4 sticky top-4 h-[calc(100vh-2rem)]">
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
                   ariaCurrentWhenActive="page" class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm hover:bg-black/5">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-ink-muted"><path [attr.d]="item.icon" /></svg>
                  <span class="flex-1">{{ item.labelKey | transloco }}</span>
                  @if (item.path === '/my-items' && myItems()) {
                    <span class="min-w-5 h-5 px-1.5 grid place-items-center rounded-full bg-ink/10 text-ink text-[11px] font-semibold"
                      [attr.aria-label]="'nav.myItemsCount' | transloco: { count: myItems() }">{{ myItems() }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>
        <div class="border-t border-line pt-3 flex items-center justify-between gap-2">
          <span class="grid place-items-center size-8 shrink-0 rounded-full bg-ink/10 text-ink text-xs font-semibold" aria-hidden="true">{{ initials() }}</span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium truncate">{{ auth.user()?.fullName }}</div>
            <div class="text-xs text-ink-muted truncate">{{ auth.user()?.roles?.join(', ') }}</div>
          </div>
          <button type="button" class="grid place-items-center size-8 rounded-lg text-ink-muted hover:text-ink hover:bg-black/5 cursor-pointer"
            (click)="auth.logout()" [attr.aria-label]="'auth.logout' | transloco" [title]="'auth.logout' | transloco">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>
          </button>
        </div>
      </aside>

      <div class="flex-1 min-w-0 flex flex-col gap-4">
        <header class="no-print flex items-center justify-between gap-4 px-1">
          <nav class="flex md:hidden gap-3 text-sm overflow-x-auto" [attr.aria-label]="'nav.main' | transloco">
            @for (group of nav(); track group.labelKey) {
              @for (item of group.items; track item.path) { <a [routerLink]="item.path" class="whitespace-nowrap">{{ item.labelKey | transloco }}</a> }
            }
            <button type="button" (click)="auth.logout()">{{ 'auth.logout' | transloco }}</button>
          </nav>
          @if (crumb(); as c) {
            <nav class="hidden md:flex items-center gap-1.5 text-sm text-ink-muted" [attr.aria-label]="'nav.breadcrumb' | transloco">
              <span>{{ c.group | transloco }}</span>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
              <a [routerLink]="c.path" [class]="c.leaf ? 'hover:underline' : 'text-ink hover:underline'">{{ c.label | transloco }}</a>
              @if (c.leaf) {
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
                <span class="text-ink" aria-current="page">{{ c.leaf | transloco }}</span>
              }
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
  private readonly route = inject(ActivatedRoute);
  private readonly vulnApi = inject(VulnerabilitiesApi);

  // Sitemap: Developers work from My items, the dashboard and AI only.
  protected readonly nav = computed(() => {
    const roles = this.auth.user()?.roles ?? [];
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((i) => this.auth.hasPermission(i.permission) && !i.hideForRoles?.some((r) => roles.includes(r))),
    })).filter((g) => g.items.length > 0);
  });
  protected readonly initials = computed(() =>
    (this.auth.user()?.fullName ?? '').split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase(),
  );

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  /** Open items assigned to me, refreshed on every navigation (cheap: pageSize 1, only the total is read). */
  protected readonly myItems = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      startWith(null),
      filter(() => this.auth.hasPermission('Vulnerability.Update')),
      switchMap(() => this.vulnApi.getAll({ assignedToMe: true, isOpen: true, pageSize: 1 }).pipe(
        map((r) => r.paging?.totalItems ?? 0), catchError(() => of(0)))),
    ),
    { initialValue: 0 },
  );

  /** Group › page of the longest nav path that prefixes the current URL, plus the child route's `data.crumb` as a third level. */
  protected readonly crumb = computed(() => {
    const url = this.url().split('?')[0];
    let best: { group: string; label: string; path: string; leaf?: string } | null = null;
    for (const g of NAV) for (const i of g.items)
      if ((url === i.path || url.startsWith(i.path + '/')) && i.path.length > (best?.path.length ?? 0))
        best = { group: g.labelKey, label: i.labelKey, path: i.path };
    let r = this.route;
    while (r.firstChild) r = r.firstChild;
    const leaf = r.snapshot.data['crumb'] as string | undefined;
    return best && leaf && url !== best.path ? { ...best, leaf } : best;
  });

  protected toggleLang(): void {
    this.transloco.setActiveLang(this.transloco.getActiveLang() === 'vi' ? 'en' : 'vi');
  }
}
