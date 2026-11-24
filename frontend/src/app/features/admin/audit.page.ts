import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { PageState, Pagination } from '../../shared/components/page-state';
import { AuditLog, AuditResult, AuditStats, PagingInfo, UserAdmin } from '../../shared/models/api.models';
import { AuditLogSearch, AuditLogsApi, UsersApi } from '../api.services';

const RESULT_CLASS: Record<AuditResult, string> = { Success: 'text-ok bg-ok-bg', Blocked: 'text-danger bg-white ring-1 ring-danger/30', Failed: 'text-danger bg-danger-bg' };
const CHIP_CLASS: Partial<Record<string, string>> = {
  User: 'bg-ink/[.06] text-ink', Project: 'bg-ok-bg text-ok', Target: 'bg-run-bg text-run', Scan: 'bg-run-bg text-run',
  Vulnerability: 'bg-warn-bg text-warn', Report: 'bg-sev-info-bg text-sev-info',
};
const ENTITY_ROUTE: Partial<Record<string, string>> = { Project: '/projects', Scan: '/scans', Vulnerability: '/vulnerabilities', Report: '/reports' };
const ENTITY_TYPES = ['User', 'Project', 'Target', 'Scan', 'Vulnerability', 'Report'];

// W13 Audit logs: read-only (no edit/delete exists anywhere). Secrets were masked before storing.
export type DiffLine = { kind: ' ' | '-' | '+'; text: string };

/** Audit detail as -/+ lines: {before, after} objects per changed field, {from, to} or scalar {before, after} as one pair; anything else as indented JSON. Secrets were masked server-side. */
export function auditDiff(json: string): DiffLine[] {
  let d: unknown;
  try { d = JSON.parse(json); } catch { return [{ kind: ' ', text: json }]; }
  const o = (d ?? {}) as Record<string, unknown>;
  const fmt = (v: unknown) => JSON.stringify(v);
  if (o['before'] && o['after'] && typeof o['before'] === 'object' && typeof o['after'] === 'object') {
    const b = o['before'] as Record<string, unknown>, a = o['after'] as Record<string, unknown>;
    const out: DiffLine[] = [];
    for (const k of new Set([...Object.keys(b), ...Object.keys(a)])) {
      if (fmt(b[k]) === fmt(a[k])) continue;
      out.push({ kind: ' ', text: `${k}:` }, { kind: '-', text: `- ${fmt(b[k])}` }, { kind: '+', text: `+ ${fmt(a[k])}` });
    }
    return out.length ? out : [{ kind: ' ', text: '(no field changes)' }];
  }
  for (const [from, to] of [['from', 'to'], ['before', 'after']]) {
    if (!(from in o) || !(to in o)) continue;
    const rest = Object.entries(o).filter(([k]) => k !== from && k !== to).map(([k, v]) => ({ kind: ' ' as const, text: `${k}: ${fmt(v)}` }));
    return [{ kind: '-', text: `- ${fmt(o[from])}` }, { kind: '+', text: `+ ${fmt(o[to])}` }, ...rest];
  }
  return JSON.stringify(d, null, 2).split('\n').map((text) => ({ kind: ' ' as const, text }));
}

@Component({
  selector: 'app-audit',
  imports: [FormsModule, RouterLink, TranslocoPipe, DatePipe, PageState, Pagination],
  styles: `
    .chip { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px; font-size: 13px; cursor: pointer;
      border: 1px solid var(--color-line); background: rgb(255 255 255 / 0.7); }
    .chip span { color: var(--color-ink-muted); }
    .chip.on { background: var(--color-ink); border-color: var(--color-ink); color: #fff; font-weight: 600; }
    .chip.on span { color: rgb(255 255 255 / 0.7); }
  `,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="page-title">{{ 'nav.audit' | transloco }}</h1>
          <p class="mt-1 text-sm text-ink-muted">{{ 'audit.subtitleLong' | transloco }}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-run-bg text-run text-xs font-semibold">
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            {{ 'audit.readOnlyPill' | transloco }}</span>
          <button type="button" class="btn h-10" [disabled]="exporting()" (click)="exportCsv()">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
            {{ 'audit.export' | transloco }}</button>
        </div>
      </div>

      @if (stats(); as st) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="glass p-4"><div class="text-[13px] text-ink-muted">{{ 'audit.last7' | transloco }}</div><div class="text-xl font-semibold">{{ st.last7Days }}</div></div>
          <div class="glass p-4"><div class="text-[13px] text-ink-muted">{{ 'audit.blocked403' | transloco }}</div><div class="text-xl font-semibold">{{ st.blocked }}</div></div>
          <div class="glass p-4"><div class="text-[13px] text-ink-muted">{{ 'audit.failedLogins' | transloco }}</div><div class="text-xl font-semibold">{{ st.failedLogins }}</div></div>
          <div class="glass p-4">
            <div class="text-[13px] text-ink-muted mb-2">{{ 'audit.perDay' | transloco }}</div>
            <ol class="flex items-end gap-1 h-8" role="img" [attr.aria-label]="dayLabel()">
              @for (d of st.byDay; track d.date; let last = $last) {
                <li class="flex-1 rounded-[3px]" [class]="last ? 'bg-ink' : 'bg-sev-critical-bg ring-1 ring-inset ring-sev-high/20'"
                  [style.height.%]="maxDay() ? (d.count / maxDay()) * 100 : 0" [style.min-height.px]="d.count ? 4 : 2" [title]="d.date + ': ' + d.count"></li>
              }
            </ol>
          </div>
        </div>
      }

      <div class="grid lg:grid-cols-[1fr_400px] gap-4 items-start">
        <section class="glass overflow-hidden">
          <div class="flex flex-col gap-3 p-4 border-b border-line">
            <div role="group" [attr.aria-label]="'audit.entity' | transloco" class="flex flex-wrap gap-1.5">
              <button type="button" class="chip" [class.on]="!entityType()" [attr.aria-pressed]="!entityType()" (click)="entityType.set(''); load(1)">
                {{ 'audit.allEntities' | transloco }} <span>{{ stats()?.last7Days }}</span></button>
              @for (e of entityTypes; track e) {
                <button type="button" class="chip" [class.on]="entityType() === e" [attr.aria-pressed]="entityType() === e" (click)="entityType.set(e); load(1)">
                  {{ 'audit.entity_' + e | transloco }} <span>{{ stats()?.byEntityType?.[e] ?? 0 }}</span></button>
              }
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <select class="h-10 px-2.5 rounded-xl border border-line bg-white text-sm" [attr.aria-label]="'audit.actor' | transloco"
                [ngModel]="userId()" (ngModelChange)="userId.set($event); load(1)">
                <option value="">{{ 'audit.allActors' | transloco }}</option>
                @for (u of users(); track u.id) { <option [value]="u.id">{{ u.fullName }}</option> }
              </select>
              <select class="h-10 px-2.5 rounded-xl border border-line bg-white text-sm" [attr.aria-label]="'audit.result' | transloco"
                [ngModel]="result()" (ngModelChange)="result.set($event); load(1)">
                @for (r of results; track r.key) { <option [ngValue]="r.value">{{ (r.value ? r.key : 'audit.allResults') | transloco }}</option> }
              </select>
              <span class="flex items-center gap-2 h-10 px-3 rounded-xl border border-line bg-white text-sm">
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="text-ink-muted"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
                <input type="date" class="bg-transparent outline-none" [attr.aria-label]="'audit.from' | transloco" [ngModel]="from()" (ngModelChange)="from.set($event); load(1)" />
                <span aria-hidden="true">→</span>
                <input type="date" class="bg-transparent outline-none" [attr.aria-label]="'audit.to' | transloco" [ngModel]="to()" (ngModelChange)="to.set($event); load(1)" />
              </span>
              <form class="flex-[1_1_160px]" role="search" (ngSubmit)="load(1)">
                <input type="search" name="kw" class="w-full h-10 px-3 rounded-xl border border-line bg-white text-sm" [placeholder]="'audit.searchPh' | transloco"
                  [attr.aria-label]="'audit.searchPh' | transloco" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" />
              </form>
              <button type="button" class="px-2 text-sm font-semibold cursor-pointer hover:underline" (click)="clearFilters()">{{ 'projects.clearFilters' | transloco }}</button>
            </div>
          </div>
          <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
            @if (items().length > 0) {
              @for (day of days(); track day.date) {
                <h2 class="px-4 py-2 bg-ink/[.025] text-[13px] font-semibold">{{ dayLabelOf(day.date) }}</h2>
                <ul>
                  @for (a of day.items; track a.id) {
                    <li>
                      <button type="button" class="w-full text-left px-4 py-3 border-t border-line flex items-start gap-3 cursor-pointer"
                        [class]="selected()?.id === a.id ? 'bg-ink/[.05]' : a.result === 'Blocked' ? 'bg-danger-bg/60 hover:bg-danger-bg' : 'hover:bg-white/40'" (click)="selected.set(a)">
                        <span class="flex-1 min-w-0">
                          <span class="flex flex-wrap items-center gap-2">
                            <span class="px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold" [class]="chipClass(a.entityType)">{{ a.action }}</span>
                            <span class="text-sm"><b class="font-semibold">{{ a.userName ?? ('vulns.system' | transloco) }}</b> · {{ a.summary }}</span>
                          </span>
                          <span class="block mt-0.5 text-[13px] text-ink-muted truncate">{{ 'audit.entity_' + a.entityType | transloco }}@if (a.ipAddress) { · IP <span class="font-mono">{{ a.ipAddress }}</span> }</span>
                        </span>
                        <span class="flex flex-col items-end gap-1 shrink-0">
                          <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" [class]="resultClass[a.result]">
                            <span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span>{{ 'audit.result_' + a.result | transloco }}</span>
                          <span class="font-mono text-xs text-ink-muted">{{ a.createdAt | date: 'HH:mm:ss' }}</span>
                        </span>
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

        <aside class="flex flex-col gap-4">
          <section class="glass p-5 flex flex-col gap-3">
            @if (selected(); as a) {
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold">{{ 'audit.detailTitle' | transloco }}</h2>
                <span class="font-mono text-xs text-ink-muted">{{ a.id.slice(0, 8) }}…{{ a.id.slice(-4) }}</span>
              </div>
              <span class="self-start px-1.5 py-0.5 rounded font-mono text-xs font-semibold" [class]="chipClass(a.entityType)">{{ a.action }}</span>
              <dl class="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt class="text-ink-muted">{{ 'audit.time' | transloco }}</dt><dd class="font-mono">{{ a.createdAt | date: 'dd/MM/yyyy HH:mm:ss Z' }}</dd>
                <dt class="text-ink-muted">{{ 'audit.actor' | transloco }}</dt><dd>{{ a.userName ?? ('vulns.system' | transloco) }}</dd>
                <dt class="text-ink-muted">{{ 'audit.entity' | transloco }}</dt><dd>{{ 'audit.entity_' + a.entityType | transloco }} @if (a.entityId) { <span class="font-mono text-xs text-ink-muted break-all">{{ a.entityId }}</span> }</dd>
                <dt class="text-ink-muted">{{ 'audit.result' | transloco }}</dt><dd>{{ 'audit.result_' + a.result | transloco }}</dd>
                <dt class="text-ink-muted">IP</dt><dd class="font-mono">{{ a.ipAddress ?? '—' }}</dd>
              </dl>
              <p class="text-sm">{{ a.summary }}</p>
              @if (a.detailJson) {
                <h3 class="text-sm font-semibold">{{ 'audit.changes' | transloco }}</h3>
                <pre class="rounded-2xl bg-[#121519] text-white/80 p-4 font-mono text-xs leading-5 whitespace-pre-wrap break-all">@for (l of diffLines(a.detailJson); track $index) {<span [class]="l.kind === '-' ? 'text-[#ff8a80]' : l.kind === '+' ? 'text-[#ff7043]' : ''">{{ l.text }}</span>
}</pre>
              }
              @if (entityLink(a); as link) {
                <a [routerLink]="link" class="self-start text-sm font-semibold hover:underline">{{ 'audit.openEntity' | transloco: { entity: ('audit.entity_' + a.entityType | transloco) } }} →</a>
              }
            } @else {
              <p class="text-sm text-ink-muted">{{ 'audit.pick' | transloco }}</p>
            }
          </section>
          <section class="rounded-[20px] bg-white/45 p-5 flex flex-col gap-2.5 text-[13px] text-ink-muted">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-ink">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></svg>
              {{ 'audit.rulesTitle' | transloco }}</h2>
            <p>{{ 'audit.rule1' | transloco }}</p>
            <p>{{ 'audit.maskedNote' | transloco }}</p>
            <p>{{ 'audit.rule3' | transloco }}</p>
          </section>
        </aside>
      </div>
    </div>
  `,
})
export class AuditPage implements OnInit {
  private readonly api = inject(AuditLogsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
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

  protected chipClass(entity: string): string {
    return CHIP_CLASS[entity] ?? 'bg-ink/[.06] text-ink';
  }

  protected entityLink(a: AuditLog): string[] | null {
    if (a.entityType === 'User') return ['/users'];
    const base = ENTITY_ROUTE[a.entityType];
    return base && a.entityId && !a.action.endsWith('_DELETED') ? [base, a.entityId] : null;
  }

  protected dayLabelOf(iso: string): string {
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(iso).getTime()) / 86_400_000);
    const d = new Date(iso);
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (days === 0) return `${this.transloco.translate('users.today')}, ${date}`;
    if (days === 1) return `${this.transloco.translate('users.yesterday')}, ${date}`;
    return `${date}/${d.getFullYear()}`;
  }

  protected readonly diffLines = auditDiff;

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
