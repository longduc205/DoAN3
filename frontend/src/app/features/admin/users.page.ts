import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { RolePermissions, UserAdmin } from '../../shared/models/api.models';
import { UsersApi } from '../api.services';

// W12 Users & Roles. Permissions are fixed per role (A3); the editor only changes the user's single role.
// shortcut: no create / lock user yet (needs a password-reset flow); add with account lifecycle.
@Component({
  selector: 'app-users',
  imports: [FormsModule, TranslocoPipe, DatePipe, PageState, DialogComponent],
  template: `
    <div class="flex flex-col gap-5">
      <div>
        <h1 class="page-title">{{ 'nav.users' | transloco }}</h1>
        <p class="mt-1 text-sm text-ink-muted">{{ 'users.subtitle' | transloco: { count: users().length } }}</p>
      </div>

      <dl class="grid grid-cols-2 md:grid-cols-4 gap-3">
        @for (r of matrix(); track r.role) {
          <div class="glass p-4"><dt class="text-sm text-ink-muted">{{ 'roles.' + r.role | transloco }}</dt><dd class="text-2xl font-semibold">{{ countByRole()[r.role] ?? 0 }}</dd></div>
        }
      </dl>

      @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }
      @if (notice()) { <div role="status" class="px-4 py-3 rounded-xl bg-ok-bg text-ok text-sm">{{ notice()! | transloco }}</div> }

      <div class="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <section class="rounded-2xl border border-line bg-white overflow-x-auto">
          <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
            <table class="table">
              <thead><tr><th>{{ 'users.name' | transloco }}</th><th>{{ 'users.role' | transloco }}</th><th>{{ 'common.status' | transloco }}</th><th>{{ 'users.lastLogin' | transloco }}</th></tr></thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr class="cursor-pointer hover:bg-black/[.02]" [class.bg-black/[.04]]="selected()?.id === u.id" (click)="select(u)">
                    <td>
                      <button type="button" class="flex items-center gap-3 text-left cursor-pointer" (click)="select(u); $event.stopPropagation()">
                        <span class="grid place-items-center size-8 shrink-0 rounded-full bg-ink text-white text-xs font-semibold" aria-hidden="true">{{ initials(u.fullName) }}</span>
                        <span><span class="font-medium">{{ u.fullName }}</span>@if (u.id === meId) { <span class="mono"> · {{ 'users.you' | transloco }}</span> }
                          <span class="mono block">{{ u.email }}</span></span>
                      </button>
                    </td>
                    <td>{{ 'roles.' + u.role | transloco }}</td>
                    <td><span class="px-2 py-0.5 rounded-md text-xs font-medium" [class]="u.isActive ? 'text-ok bg-ok-bg' : 'text-danger bg-danger-bg'">{{ (u.isActive ? 'users.active' : 'users.locked') | transloco }}</span></td>
                    <td class="whitespace-nowrap">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd/MM HH:mm') : '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </app-page-state>
        </section>

        <aside class="glass p-5 flex flex-col gap-4">
          @if (selected(); as u) {
            <div>
              <h2 class="font-semibold">{{ u.fullName }}</h2>
              <p class="mono">{{ u.userName }} · {{ u.email }}</p>
            </div>
            <fieldset class="flex flex-col gap-2" [disabled]="u.id === meId">
              <legend class="label">{{ 'users.role' | transloco }}</legend>
              @for (r of matrix(); track r.role) {
                <label class="flex items-center gap-2 text-sm rounded-xl border border-line bg-white/70 p-2.5 cursor-pointer">
                  <input type="radio" name="role" [value]="r.role" [ngModel]="draftRole()" (ngModelChange)="draftRole.set($event)" />
                  {{ 'roles.' + r.role | transloco }}
                </label>
              }
            </fieldset>
            @if (u.id === meId) { <p class="text-sm text-warn">{{ 'users.ownRole' | transloco }}</p> }
            <div>
              <h3 class="text-sm font-semibold mb-2">{{ 'users.permissionsOf' | transloco: { role: ('roles.' + draftRole() | transloco) } }}</h3>
              <ul class="flex flex-wrap gap-1.5">
                @for (p of draftPermissions(); track p) { <li class="mono px-2 py-0.5 rounded-md bg-white/80 border border-line text-ink">{{ p }}</li> }
              </ul>
              <p class="text-xs text-ink-muted mt-2">{{ 'users.readOnlyMatrix' | transloco }}</p>
            </div>
            <button type="button" class="btn btn-primary" [disabled]="u.id === meId || draftRole() === u.role" (click)="confirmOpen.set(true)">{{ 'users.changeRole' | transloco }}</button>
          } @else {
            <p class="text-sm text-ink-muted">{{ 'users.pick' | transloco }}</p>
          }
        </aside>
      </div>

      <app-dialog [open]="confirmOpen()" [heading]="'users.confirmTitle' | transloco" (closed)="confirmOpen.set(false)">
        @if (selected(); as u) {
          <p class="text-sm">{{ 'users.confirmBody' | transloco: { name: u.fullName, from: ('roles.' + u.role | transloco), to: ('roles.' + draftRole() | transloco) } }}</p>
          @if (diff().gained.length) {
            <div><h3 class="text-sm font-semibold text-ok">{{ 'users.gained' | transloco }}</h3>
              <ul class="flex flex-wrap gap-1.5 mt-1">@for (p of diff().gained; track p) { <li class="mono px-2 py-0.5 rounded-md bg-ok-bg text-ok">+ {{ p }}</li> }</ul></div>
          }
          @if (diff().lost.length) {
            <div><h3 class="text-sm font-semibold text-danger">{{ 'users.lost' | transloco }}</h3>
              <ul class="flex flex-wrap gap-1.5 mt-1">@for (p of diff().lost; track p) { <li class="mono px-2 py-0.5 rounded-md bg-danger-bg text-danger">− {{ p }}</li> }</ul></div>
          }
          <p class="text-xs text-ink-muted">{{ 'users.reloginNote' | transloco }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="confirmOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" class="btn btn-primary" (click)="save()">{{ 'users.changeRole' | transloco }}</button>
          </div>
        }
      </app-dialog>
    </div>
  `,
})
export class UsersPage implements OnInit {
  private readonly api = inject(UsersApi);
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

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
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
