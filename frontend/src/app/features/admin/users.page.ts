import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { RolePermissions, UserAdmin } from '../../shared/models/api.models';
import { UsersApi } from '../api.services';

// W12 Users & Roles. Permissions are fixed per role (A3); the editor only changes the user's single role.
// shortcut: no create user yet (needs a password / invite flow); add with account lifecycle.
@Component({
  selector: 'app-users',
  imports: [FormsModule, TranslocoPipe, PageState, DialogComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="page-title">{{ 'nav.users' | transloco }}</h1>
        <p class="mt-1 text-sm text-ink-muted">{{ 'users.subtitle' | transloco: { count: users().length } }}</p>
      </div>

      <dl class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="glass p-4"><dt class="text-[13px] text-ink-muted">{{ 'users.total' | transloco }}</dt><dd class="text-xl font-semibold">{{ users().length }}</dd></div>
        <div class="glass p-4"><dt class="text-[13px] text-ink-muted">{{ 'users.active' | transloco }}</dt><dd class="text-xl font-semibold">{{ activeCount() }}</dd></div>
        <div class="glass p-4"><dt class="text-[13px] text-ink-muted">{{ 'users.locked' | transloco }}</dt><dd class="text-xl font-semibold" [class.text-danger]="users().length - activeCount() > 0">{{ users().length - activeCount() }}</dd></div>
        <div class="glass p-4 flex flex-col gap-2"><dt class="text-[13px] text-ink-muted">{{ 'users.byRole' | transloco }}</dt>
          <dd class="flex gap-1 h-1.5" aria-hidden="true">
            @for (r of matrix(); track r.role) {
              @if (countByRole()[r.role]) { <span class="rounded-full" [class]="roleBar[r.role] ?? 'bg-ink/30'" [style.flex-grow]="countByRole()[r.role]"></span> }
            }
          </dd>
          <dd class="text-xs text-ink-muted">
            @for (r of matrix(); track r.role; let last = $last) {
              @if (countByRole()[r.role]) { {{ 'roles.' + r.role | transloco }} {{ countByRole()[r.role] }}@if (!last) { · } }
            }
          </dd></div>
      </dl>

      @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }
      @if (notice()) { <div role="status" class="px-4 py-3 rounded-xl bg-ok-bg text-ok text-sm">{{ notice()! | transloco }}</div> }

      <div class="grid lg:grid-cols-[1fr_420px] gap-4 items-start">
        <section class="glass overflow-hidden">
          <div class="flex flex-wrap items-center gap-2 p-3 border-b border-line">
            <label class="flex-[1_1_220px] min-w-0 flex items-center gap-2 h-10 px-3 rounded-xl bg-ink/[.04] text-ink-muted">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input type="search" class="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none" [placeholder]="'users.searchPh' | transloco"
                [attr.aria-label]="'users.searchPh' | transloco" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" />
            </label>
            <select class="h-10 px-2.5 rounded-xl border border-line bg-white text-sm" [attr.aria-label]="'users.role' | transloco"
              [ngModel]="roleFilter()" (ngModelChange)="roleFilter.set($event)">
              <option value="">{{ 'users.allRoles' | transloco }}</option>
              @for (r of matrix(); track r.role) { <option [value]="r.role">{{ 'roles.' + r.role | transloco }}</option> }
            </select>
            <select class="h-10 px-2.5 rounded-xl border border-line bg-white text-sm" [attr.aria-label]="'common.status' | transloco"
              [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
              @for (f of statusFilters; track f.key) { <option [ngValue]="f.value">{{ f.key | transloco }}</option> }
            </select>
          </div>
          <app-page-state [loading]="loading()" [error]="error()" [empty]="visibleUsers().length === 0" emptyKey="users.noResults" (retry)="load()">
            <div class="overflow-x-auto">
              <table class="table">
                <thead><tr><th>{{ 'users.name' | transloco }}</th><th>{{ 'users.role' | transloco }}</th><th>{{ 'common.status' | transloco }}</th><th>{{ 'users.lastLogin' | transloco }}</th></tr></thead>
                <tbody>
                  @for (u of visibleUsers(); track u.id) {
                    <tr class="cursor-pointer hover:bg-white/40" [class.bg-ink/[.04]]="selected()?.id === u.id" (click)="select(u)">
                      <td>
                        <button type="button" class="flex items-center gap-3 text-left cursor-pointer" (click)="select(u); $event.stopPropagation()">
                          <span class="grid place-items-center size-8 shrink-0 rounded-full text-[11px] font-bold" [class]="avatar(u.fullName)" aria-hidden="true">{{ initials(u.fullName) }}</span>
                          <span><span class="font-semibold">{{ u.fullName }}</span>@if (u.id === meId) { <span class="text-xs text-ink-muted"> ({{ 'users.you' | transloco }})</span> }
                            <span class="block text-xs text-ink-muted">{{ u.email }}</span></span>
                        </button>
                      </td>
                      <td><span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" [class]="rolePill[u.role] ?? 'bg-ink/[.06]'">{{ 'roles.' + u.role | transloco }}</span></td>
                      <td>
                        <span class="inline-flex items-center gap-1.5 text-xs font-semibold" [class]="u.isActive ? 'text-ok' : 'px-2 py-0.5 rounded-full bg-danger-bg text-danger'">
                          @if (u.isActive) { <span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span> }
                          @else { <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg> }
                          {{ (u.isActive ? 'users.active' : 'users.locked') | transloco }}</span>
                      </td>
                      <td class="whitespace-nowrap text-ink-muted">{{ lastLogin(u.lastLoginAt) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </app-page-state>
        </section>

        <aside class="glass p-5 flex flex-col gap-4">
          @if (selected(); as u) {
            <div class="flex items-center gap-3">
              <span class="grid place-items-center size-12 shrink-0 rounded-full text-sm font-bold" [class]="avatar(u.fullName)" aria-hidden="true">{{ initials(u.fullName) }}</span>
              <div class="min-w-0"><h2 class="text-lg font-semibold">{{ u.fullName }}</h2><p class="text-[13px] text-ink-muted truncate">{{ u.userName }} · {{ u.email }}</p></div>
            </div>
            <fieldset class="flex flex-col gap-2" [disabled]="u.id === meId">
              <legend class="mb-2 text-sm font-semibold">{{ 'users.role' | transloco }}</legend>
              @for (r of matrix(); track r.role) {
                <label class="flex items-center gap-2.5 text-sm rounded-xl border p-3 cursor-pointer" [class]="draftRole() === r.role ? 'border-ink bg-white' : 'border-line bg-white/60'">
                  <input type="radio" name="role" class="accent-ink" [value]="r.role" [ngModel]="draftRole()" (ngModelChange)="draftRole.set($event)" />
                  <span>{{ 'roles.' + r.role | transloco }}
                    @if (draftRole() === r.role && r.role !== u.role) { <span class="text-xs text-ink-muted"> · {{ 'users.current' | transloco: { role: ('roles.' + u.role | transloco) } }}</span> }</span>
                </label>
              }
            </fieldset>
            <div class="rounded-2xl bg-ink/[.04] p-4">
              <h3 class="text-sm font-semibold mb-2">{{ 'users.permissionsOf' | transloco: { role: ('roles.' + draftRole() | transloco) } }}</h3>
              <ul class="flex flex-col gap-1.5 text-[13px]">
                @for (p of draftPermissions(); track p) {
                  <li class="flex items-center gap-2">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="shrink-0"><path d="M5 12l5 5 9-10" /></svg>
                    {{ 'perm.' + p | transloco }}</li>
                }
              </ul>
            </div>
            <p class="flex gap-2 text-xs text-ink-muted">
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mt-px shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M12 11v5" /></svg>
              {{ (u.id === meId ? 'users.ownRole' : 'users.readOnlyMatrix') | transloco }}</p>
            <div class="flex flex-wrap items-center gap-2">
              @if (u.id !== meId) {
                <button type="button" class="px-1 text-sm cursor-pointer hover:underline" [class]="u.isActive ? 'text-danger' : 'text-ok'" (click)="lockOpen.set(true)">{{ (u.isActive ? 'users.lock' : 'users.unlock') | transloco }}</button>
              }
              <span class="flex-1"></span>
              <button type="button" class="btn h-11" [disabled]="draftRole() === u.role" (click)="draftRole.set(u.role)">{{ 'common.cancel' | transloco }}</button>
              <button type="button" class="btn btn-primary h-11 font-semibold" [disabled]="u.id === meId || draftRole() === u.role" (click)="confirmOpen.set(true)">{{ 'users.saveChanges' | transloco }}</button>
            </div>
          } @else {
            <p class="text-sm text-ink-muted">{{ 'users.pick' | transloco }}</p>
          }
        </aside>
      </div>

      <app-dialog [open]="confirmOpen()" [heading]="'users.confirmTitle' | transloco" (closed)="confirmOpen.set(false)">
        @if (selected(); as u) {
          <p class="text-sm">{{ 'users.confirmBody' | transloco: { name: u.fullName, from: ('roles.' + u.role | transloco), to: ('roles.' + draftRole() | transloco) } }}</p>
          <p class="flex items-center gap-2 text-sm">
            <span class="px-2.5 py-1 rounded-full bg-ink/[.06] font-semibold">{{ 'roles.' + u.role | transloco }}</span><span aria-hidden="true">→</span>
            <span class="px-2.5 py-1 rounded-full bg-ink text-white font-semibold">{{ 'roles.' + draftRole() | transloco }}</span></p>
          @if (diff().gained.length) {
            <div><h3 class="text-sm font-semibold text-ok">{{ 'users.gained' | transloco }}</h3>
              <ul class="flex flex-wrap gap-1.5 mt-1">@for (p of diff().gained; track p) { <li class="px-2 py-0.5 rounded-md bg-ok-bg text-ok text-xs">+ {{ 'perm.' + p | transloco }}</li> }</ul></div>
          }
          @if (diff().lost.length) {
            <div><h3 class="text-sm font-semibold text-danger">{{ 'users.lost' | transloco }}</h3>
              <ul class="flex flex-wrap gap-1.5 mt-1">@for (p of diff().lost; track p) { <li class="px-2 py-0.5 rounded-md bg-danger-bg text-danger text-xs">− {{ 'perm.' + p | transloco }}</li> }</ul></div>
          }
          <p class="text-xs text-ink-muted">{{ 'users.reloginNote' | transloco }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="confirmOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" class="btn btn-primary" (click)="save()">{{ 'users.changeRole' | transloco }}</button>
          </div>
        }
      </app-dialog>

      <app-dialog [open]="lockOpen()" [heading]="(selected()?.isActive ? 'users.lock' : 'users.unlock') | transloco" (closed)="lockOpen.set(false)">
        @if (selected(); as u) {
          <p class="text-sm">{{ (u.isActive ? 'users.lockBody' : 'users.unlockBody') | transloco: { name: u.fullName } }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="lockOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" class="btn" [class.btn-danger]="u.isActive" (click)="toggleActive(u)">{{ (u.isActive ? 'users.lock' : 'users.unlock') | transloco }}</button>
          </div>
        }
      </app-dialog>
    </div>
  `,
})
export class UsersPage implements OnInit {
  private readonly api = inject(UsersApi);
  private readonly transloco = inject(TranslocoService);
  protected readonly meId = inject(AuthService).user()?.id;

  protected readonly users = signal<UserAdmin[]>([]);
  protected readonly matrix = signal<RolePermissions[]>([]);
  protected readonly selected = signal<UserAdmin | null>(null);
  protected readonly draftRole = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly lockOpen = signal(false);
  protected readonly roleFilter = signal('');
  protected readonly statusFilter = signal<boolean | null>(null);
  protected readonly statusFilters: { key: string; value: boolean | null }[] = [
    { key: 'projects.tabAll', value: null }, { key: 'users.active', value: true }, { key: 'users.locked', value: false },
  ];
  protected readonly keyword = signal('');
  protected readonly rolePill: Partial<Record<string, string>> = { Admin: 'bg-ink text-white', SecurityAnalyst: 'bg-ink/[.07]', Developer: 'bg-run-bg text-run', Viewer: 'bg-sev-info-bg text-sev-info' };
  protected readonly roleBar: Partial<Record<string, string>> = { Admin: 'bg-ink', SecurityAnalyst: 'bg-ink/60', Developer: 'bg-run', Viewer: 'bg-ink/25' };
  protected readonly activeCount = computed(() => this.users().filter((u) => u.isActive).length);
  // shortcut: filters run client-side on the first 100 users (lab-sized); move to users/get-all params if the list grows.
  protected readonly visibleUsers = computed(() => {
    const kw = this.keyword().trim().toLowerCase();
    return this.users().filter((u) =>
      (!this.roleFilter() || u.role === this.roleFilter()) && (this.statusFilter() === null || u.isActive === this.statusFilter()) &&
      (!kw || u.fullName.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw) || u.userName.toLowerCase().includes(kw)));
  });

  protected readonly countByRole = computed(() =>
    this.users().reduce<Partial<Record<string, number>>>((m, u) => ({ ...m, [u.role]: (m[u.role] ?? 0) + 1 }), {}));
  private readonly permsOf = (role: string) => this.matrix().find((r) => r.role === role)?.permissions ?? [];
  protected readonly draftPermissions = computed(() => this.permsOf(this.draftRole()));
  protected readonly diff = computed(() => {
    const before = this.permsOf(this.selected()?.role ?? '');
    const after = this.draftPermissions();
    return { gained: after.filter((p) => !before.includes(p)), lost: before.filter((p) => !after.includes(p)) };
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ users: this.api.getAll({ pageSize: 100 }), matrix: this.api.getRolePermissions() }).subscribe({
      next: (r) => {
        this.users.set(r.users.data ?? []);
        this.matrix.set(r.matrix.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected select(u: UserAdmin): void {
    this.selected.set(u);
    this.draftRole.set(u.role);
    this.notice.set(null);
  }

  /** Stable pastel avatar per name. */
  protected avatar(name: string): string {
    const tones = ['bg-sev-medium-bg text-sev-medium', 'bg-sev-high-bg text-sev-high-ink', 'bg-ok-bg text-ok', 'bg-run-bg text-run', 'bg-sev-critical-bg text-sev-critical-ink'];
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return tones[h % tones.length];
  }

  protected lastLogin(at: string | null): string {
    if (!at) return '—';
    const d = new Date(at);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86400000);
    if (days === 0) return this.transloco.translate('users.today');
    if (days === 1) return this.transloco.translate('users.yesterday');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
  }

  protected toggleActive(u: UserAdmin): void {
    this.lockOpen.set(false);
    this.actionError.set(null);
    this.api.setActive(u.id, !u.isActive).subscribe({
      next: (r) => {
        if (!r.data) return;
        this.users.update((list) => list.map((x) => (x.id === r.data!.id ? r.data! : x)));
        this.select(r.data);
        this.notice.set(r.data.isActive ? 'users.unlocked' : 'users.lockedNotice');
      },
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  protected save(): void {
    const u = this.selected();
    if (!u) return;
    this.confirmOpen.set(false);
    this.actionError.set(null);
    this.api.changeRole(u.id, this.draftRole()).subscribe({
      next: (r) => {
        if (!r.data) return;
        this.users.update((list) => list.map((x) => (x.id === r.data!.id ? r.data! : x)));
        this.select(r.data);
        this.notice.set('users.saved');
      },
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }
}
