import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { PageState, Pagination } from '../../shared/components/page-state';
import { AuditLog, AuditResult, AuditStats, PagingInfo, UserAdmin } from '../../shared/models/api.models';
import { AuditLogSearch, AuditLogsApi, UsersApi } from '../api.services';

const RESULT_CLASS: Record<AuditResult, string> = { Success: 'text-ok bg-ok-bg', Blocked: 'text-warn bg-warn-bg', Failed: 'text-danger bg-danger-bg' };
const ENTITY_TYPES = ['User', 'Project', 'Target', 'Scan', 'Vulnerability', 'Report'];

// W13 Audit logs: read-only (no edit/delete exists anywhere). Secrets were masked before storing.
@Component({
  selector: 'app-audit',
  imports: [FormsModule, TranslocoPipe, DatePipe, PageState, Pagination],
  template: `
    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="page-title">{{ 'nav.audit' | transloco }}</h1>
          <p class="mt-1 text-sm text-ink-muted">{{ 'audit.subtitle' | transloco: { count: paging()?.totalItems ?? 0 } }}</p>
        </div>
        <button type="button" class="btn h-10" [disabled]="exporting()" (click)="exportCsv()">{{ 'audit.export' | transloco }}</button>
      </div>

      @if (stats(); as st) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="glass p-4"><div class="text-sm text-ink-muted">{{ 'audit.last7' | transloco }}</div><div class="text-2xl font-semibold">{{ st.last7Days }}</div></div>
          <div class="glass p-4"><div class="text-sm text-ink-muted">{{ 'audit.result_Blocked' | transloco }}</div><div class="text-2xl font-semibold text-warn">{{ st.blocked }}</div></div>
          <div class="glass p-4"><div class="text-sm text-ink-muted">{{ 'audit.failedLogins' | transloco }}</div><div class="text-2xl font-semibold text-danger">{{ st.failedLogins }}</div></div>
          <div class="glass p-4 col-span-2 lg:col-span-1">
            <div class="text-sm text-ink-muted mb-2">{{ 'audit.perDay' | transloco }}</div>
            <ol class="flex items-end gap-1 h-12" role="img" [attr.aria-label]="dayLabel()">
              @for (d of st.byDay; track d.date) {
                <li class="flex-1 rounded-t bg-ink/80" [style.height.%]="maxDay() ? (d.count / maxDay()) * 100 : 0" [style.min-height.px]="d.count ? 3 : 1" [title]="d.date + ': ' + d.count"></li>
              }
            </ol>
          </div>
        </div>
        <div role="group" [attr.aria-label]="'audit.entity' | transloco" class="flex flex-wrap p-[3px] rounded-[10px] bg-black/[.04] self-start">
          <button type="button" class="min-h-[34px] px-3 rounded-lg text-[13px] cursor-pointer" [attr.aria-pressed]="!entityType()"
            [class]="!entityType() ? 'bg-white font-semibold' : 'text-ink-muted hover:text-ink'" (click)="entityType.set(''); load(1)">{{ 'audit.allEntities' | transloco }}</button>
          @for (e of entityTypes; track e) {
            <button type="button" class="min-h-[34px] px-3 rounded-lg text-[13px] cursor-pointer" [attr.aria-pressed]="entityType() === e"
              [class]="entityType() === e ? 'bg-white font-semibold' : 'text-ink-muted hover:text-ink'" (click)="entityType.set(e); load(1)">
              {{ 'audit.entity_' + e | transloco }} <span class="text-ink-muted">{{ st.byEntityType[e] ?? 0 }}</span></button>
          }
        </div>
      }

      <div class="flex flex-wrap items-center gap-2.5">
        <div role="group" [attr.aria-label]="'audit.result' | transloco" class="flex p-[3px] rounded-[10px] bg-black/[.04]">
          @for (r of results; track r.key) {
            <button type="button" class="min-h-[34px] px-3 rounded-lg text-[13px] cursor-pointer" [attr.aria-pressed]="result() === r.value"
              [class]="result() === r.value ? 'bg-white font-semibold' : 'text-ink-muted hover:text-ink'" (click)="result.set(r.value); load(1)">{{ r.key | transloco }}</button>
          }
        </div>
        <select class="h-9 px-2.5 rounded-[10px] border border-line bg-white text-sm" [attr.aria-label]="'audit.actor' | transloco"
          [ngModel]="userId()" (ngModelChange)="userId.set($event); load(1)">
          <option value="">{{ 'audit.allActors' | transloco }}</option>
          @for (u of users(); track u.id) { <option [value]="u.id">{{ u.fullName }}</option> }
        </select>
        <label class="flex items-center gap-1.5 text-sm">{{ 'audit.from' | transloco }}
          <input type="date" class="h-9 px-2 rounded-[10px] border border-line bg-white" [ngModel]="from()" (ngModelChange)="from.set($event); load(1)" /></label>
        <label class="flex items-center gap-1.5 text-sm">{{ 'audit.to' | transloco }}
          <input type="date" class="h-9 px-2 rounded-[10px] border border-line bg-white" [ngModel]="to()" (ngModelChange)="to.set($event); load(1)" /></label>
        <form class="flex-[1_1_200px]" role="search" (ngSubmit)="load(1)">
          <input type="search" name="kw" class="w-full h-9 px-3 rounded-[10px] border border-line bg-white text-sm" [placeholder]="'audit.searchPh' | transloco"
            [attr.aria-label]="'audit.searchPh' | transloco" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" />
        </form>
      </div>

      <div class="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
        <section class="rounded-2xl border border-line bg-white">
          <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
            @if (items().length > 0) {
              @for (day of days(); track day.date) {
                <h2 class="px-5 pt-4 pb-1 mono">{{ day.date | date: 'dd/MM/yyyy' }}</h2>
                <ul>
                  @for (a of day.items; track a.id) {
                    <li>
                      <button type="button" class="w-full text-left px-5 py-3 border-t border-line flex flex-wrap items-center gap-3 cursor-pointer hover:bg-black/[.02]"
                        [class.bg-black/[.04]]="selected()?.id === a.id" (click)="selected.set(a)">
                        <span class="mono text-ink w-44 shrink-0">{{ a.action }}</span>
                        <span class="flex-1 min-w-[180px] text-sm">{{ a.summary }}<span class="block text-xs text-ink-muted">{{ a.userName ?? ('vulns.system' | transloco) }}</span></span>
                        <span class="px-2 py-0.5 rounded-md text-xs font-medium" [class]="resultClass[a.result]">{{ 'audit.result_' + a.result | transloco }}</span>
                        <span class="mono">{{ a.createdAt | date: 'HH:mm:ss' }}</span>
                      </button>
                    </li>
                  }
                </ul>
              }
              <app-pagination [paging]="paging()" (pageChange)="load($event)" />
            } @else {
              <div class="flex flex-col items-center gap-2.5 px-6 py-11 text-center">
                <h2 class="text-[17px] font-semibold">{{ 'audit.empty' | transloco }}</h2>
                <button type="button" class="btn h-10" (click)="clearFilters()">{{ 'projects.clearFilters' | transloco }}</button>
              </div>
            }
          </app-page-state>
        </section>

        <aside class="glass p-5 flex flex-col gap-3">
          @if (selected(); as a) {
            <h2 class="font-semibold mono text-ink">{{ a.action }}</h2>
            <dl class="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt class="text-ink-muted">{{ 'audit.time' | transloco }}</dt><dd>{{ a.createdAt | date: 'dd/MM/yyyy HH:mm:ss' }}</dd>
              <dt class="text-ink-muted">{{ 'audit.actor' | transloco }}</dt><dd>{{ a.userName ?? ('vulns.system' | transloco) }}</dd>
              <dt class="text-ink-muted">{{ 'audit.entity' | transloco }}</dt><dd>{{ a.entityType }} <span class="mono break-all">{{ a.entityId }}</span></dd>
              <dt class="text-ink-muted">{{ 'audit.result' | transloco }}</dt><dd>{{ 'audit.result_' + a.result | transloco }}</dd>
              <dt class="text-ink-muted">IP</dt><dd class="mono text-ink">{{ a.ipAddress ?? '—' }}</dd>
              <dt class="text-ink-muted">ID</dt><dd class="mono break-all">{{ a.id }}</dd>
            </dl>
            <p class="text-sm">{{ a.summary }}</p>
            @if (a.detailJson) {
              <pre class="rounded-xl bg-ink text-white/90 p-3 text-xs whitespace-pre-wrap break-all">{{ pretty(a.detailJson) }}</pre>
            }
            <p class="text-xs text-ink-muted">{{ 'audit.maskedNote' | transloco }}</p>
          } @else {
            <p class="text-sm text-ink-muted">{{ 'audit.pick' | transloco }}</p>
            <p class="text-xs text-ink-muted">{{ 'audit.readOnly' | transloco }}</p>
          }
        </aside>
      </div>
    </div>
  `,
})
export class AuditPage implements OnInit {
  private readonly api = inject(AuditLogsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);
  protected readonly resultClass = RESULT_CLASS;
  protected readonly entityTypes = ENTITY_TYPES;
  protected readonly results: { key: string; value: AuditResult | undefined }[] = [
    { key: 'projects.tabAll', value: undefined }, { key: 'audit.result_Success', value: 'Success' },
    { key: 'audit.result_Blocked', value: 'Blocked' }, { key: 'audit.result_Failed', value: 'Failed' },
  ];

  protected readonly result = signal<AuditResult | undefined>(undefined);
  protected readonly entityType = signal('');
  protected readonly userId = signal('');
  protected readonly users = signal<UserAdmin[]>([]);
  protected readonly stats = signal<AuditStats | null>(null);
  protected readonly exporting = signal(false);
  protected readonly maxDay = computed(() => Math.max(0, ...(this.stats()?.byDay.map((d) => d.count) ?? [])));
  protected readonly dayLabel = computed(() => (this.stats()?.byDay ?? []).map((d) => `${d.date}: ${d.count}`).join(', '));
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly keyword = signal('');
  protected readonly items = signal<AuditLog[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly selected = signal<AuditLog | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  /** Groups the current page by local calendar day (W13 "grouped by day"). */
  protected readonly days = computed(() => {
    const map = new Map<string, AuditLog[]>();
    for (const a of this.items()) {
      const d = new Date(a.createdAt);
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()].map(([date, items]) => ({ date, items }));
  });

  ngOnInit(): void {
    this.load();
    this.api.getStats().subscribe({ next: (r) => this.stats.set(r.data) });
    // The actor filter needs the user list; Audit is admin-only and admins hold User.Manage.
    if (this.auth.hasPermission('User.Manage')) this.usersApi.getAll({ pageSize: 100 }).subscribe({ next: (r) => this.users.set(r.data ?? []) });
  }

  protected exportCsv(): void {
    this.exporting.set(true);
    this.api.exportCsv(this.filters()).subscribe({
      next: (blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.exporting.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.exporting.set(false);
      },
    });
  }

  protected clearFilters(): void {
    this.result.set(undefined);
    this.entityType.set('');
    this.userId.set('');
    this.from.set('');
    this.to.set('');
    this.keyword.set('');
    this.load(1);
  }

  protected pretty(json: string): string {
    try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
  }

  private filters(): AuditLogSearch {
    // "to" is inclusive in the UI: send the start of the next day.
    const to = this.to() ? new Date(new Date(this.to()).getTime() + 86_400_000).toISOString() : undefined;
    return {
      result: this.result(), entityType: this.entityType() || undefined, userId: this.userId() || undefined,
      keyword: this.keyword().trim() || undefined, from: this.from() ? new Date(this.from()).toISOString() : undefined, to,
    };
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll({ ...this.filters(), page, pageSize: 50 }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.paging.set(res.paging);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
