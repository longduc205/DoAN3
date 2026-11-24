import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, VulnStatusBadge } from '../../shared/components/badges';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState, Pagination } from '../../shared/components/page-state';
import { PagingInfo, Severity, UserLookup, Vulnerability, VulnerabilityFacets, VulnerabilityStatus } from '../../shared/models/api.models';
import { VulnerabilitiesApi, VulnerabilitySearch } from '../api.services';

type StatusFilter = 'open' | 'closed' | 'all' | VulnerabilityStatus;
const SEV_BAR: Record<Severity, string> = {
  Critical: 'bg-sev-critical', High: 'bg-sev-high', Medium: 'bg-sev-medium-bar', Low: 'bg-sev-low', Info: 'bg-ink/30',
};
const STATUSES: VulnerabilityStatus[] = ['Open', 'Triaged', 'Assigned', 'InProgress', 'PendingVerification', 'Reopened', 'Resolved', 'FalsePositive', 'AcceptedRisk'];

// W08 Vulnerability list. Same component for /vulnerabilities, /my-items (route data) and the project tab (projectId input).
@Component({
  selector: 'app-vuln-list',
  styles: `
    .filter-pill { display: inline-flex; align-items: center; gap: 4px; height: 40px; padding: 0 10px 0 12px; border-radius: 12px; border: 1px solid var(--color-line); background: rgb(255 255 255 / 0.85); font-size: 14px; }
    .filter-pill select { background: transparent; font-weight: 600; outline: none; cursor: pointer; }
  `,
  imports: [RouterLink, FormsModule, TranslocoPipe, DatePipe, PageState, Pagination, SeverityBadge, VulnStatusBadge, DialogComponent],
  template: `
    <div class="flex flex-col gap-4">
      @if (!projectId()) {
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 class="page-title">{{ (assignedToMe() ? 'nav.myItems' : 'nav.vulnerabilities') | transloco }}</h1>
            <p class="mt-1 text-sm text-ink-muted">{{ (assignedToMe() ? 'vulns.mineHint' : 'vulns.subtitle') | transloco: { count: paging()?.totalItems ?? 0 } }}</p>
          </div>
          @if (canUpdate) {
            <nav class="flex p-[3px] rounded-[12px] bg-white/60 ring-1 ring-line" [attr.aria-label]="'nav.vulnerabilities' | transloco">
              <a routerLink="/vulnerabilities" class="min-h-[34px] px-3 flex items-center gap-1.5 rounded-[9px] text-[13px]" [class]="!assignedToMe() ? 'bg-white font-semibold shadow-sm' : 'text-ink-muted'">
                {{ 'projects.tabAll' | transloco }} <span class="text-ink-muted font-normal">{{ tabCounts().all }}</span></a>
              <a routerLink="/my-items" class="min-h-[34px] px-3 flex items-center gap-1.5 rounded-[9px] text-[13px]" [class]="assignedToMe() ? 'bg-white font-semibold shadow-sm' : 'text-ink-muted'">
                {{ 'nav.myItems' | transloco }} <span class="text-ink-muted font-normal">{{ tabCounts().mine }}</span></a>
            </nav>
          }
        </div>
      }

      <div role="group" [attr.aria-label]="'vulns.severity' | transloco" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        @for (s of severities; track s) {
          <button type="button" class="glass flex items-center gap-3 p-3.5 text-left cursor-pointer hover:bg-white/80" [attr.aria-pressed]="sev() === s"
            [class.ring-2]="sev() === s" [class.ring-ink]="sev() === s" (click)="setSeverity(sev() === s ? null : s)">
            <span aria-hidden="true" class="w-2 h-9 rounded-full" [class]="sevBar[s]"></span>
            <span><span class="block text-[13px] text-ink-muted">{{ 'severity.' + s | transloco }}</span>
              <b class="block text-xl font-semibold leading-tight">{{ facets()?.bySeverity?.[s] ?? 0 }}</b></span>
          </button>
        }
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <form class="flex-[1_1_280px] min-w-0" role="search" (ngSubmit)="load(1)">
          <label class="flex items-center gap-2 h-10 px-3 rounded-xl border border-line bg-white/85 text-ink-muted">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" name="keyword" class="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none" [placeholder]="'vulns.searchPh' | transloco"
              [attr.aria-label]="'vulns.searchPh' | transloco" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" />
          </label>
        </form>
        <label class="filter-pill">
          <span class="text-ink-muted">{{ 'common.status' | transloco }}:</span>
          <select [ngModel]="statusFilter()" (ngModelChange)="setStatus($event)" [attr.aria-label]="'common.status' | transloco">
            <option value="open">{{ 'vulns.filterOpen' | transloco }}</option>
            <option value="closed">{{ 'vulns.filterClosed' | transloco }}</option>
            <option value="all">{{ 'projects.tabAll' | transloco }}</option>
            @for (s of statuses; track s) { <option [value]="s">{{ 'vulnStatus.' + s | transloco }}</option> }
          </select>
        </label>
        <label class="filter-pill">
          <select [ngModel]="findingType()" (ngModelChange)="findingType.set($event); load(1)" [attr.aria-label]="'vulns.type' | transloco">
            <option value="">{{ 'vulns.type' | transloco }}</option>
            @for (t of facets()?.findingTypes ?? []; track t) { <option [value]="t">{{ t }}</option> }
          </select>
        </label>
        @if (canTriage && !assignedToMe()) {
          <label class="filter-pill">
            <select [ngModel]="assigneeFilter()" (ngModelChange)="assigneeFilter.set($event); load(1)" (focus)="loadAssignees()" [attr.aria-label]="'vulns.assignee' | transloco">
              <option value="">{{ 'vulns.assignee' | transloco }}</option>
              @for (u of assignees(); track u.id) { <option [value]="u.id">{{ u.fullName }}</option> }
            </select>
          </label>
        }
        @if (filtered()) {
          <button type="button" class="h-10 px-3 rounded-xl border border-dashed border-ink/25 text-sm text-ink-muted hover:text-ink cursor-pointer" (click)="clearFilters()">{{ 'projects.clearFilters' | transloco }}</button>
        }
      </div>

      @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }

      <section class="glass overflow-hidden">
        @if (selected().size > 0) {
          <div class="flex flex-wrap items-center gap-3 px-4 py-3 bg-ink/[.04] border-b border-line text-sm" role="region" [attr.aria-label]="'vulns.bulk' | transloco">
            <b class="font-semibold">{{ 'vulns.selected' | transloco: { count: selected().size } }}</b>
            <button type="button" class="btn btn-primary h-9 rounded-[10px]" (click)="openAssign()">
              <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M8.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 8v6M22 11h-6" /></svg>
              {{ 'vulns.assignTo' | transloco }}</button>
            <button type="button" class="underline underline-offset-4 cursor-pointer" (click)="clearSelection()">{{ 'vulns.clearSelection' | transloco }}</button>
          </div>
        }
        <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
          @if (items().length > 0) {
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    @if (canTriage) {
                      <th class="w-10"><input type="checkbox" class="check" [checked]="allChecked()" (change)="toggleAll()" [attr.aria-label]="'vulns.selectAll' | transloco" /></th>
                    }
                    <th>{{ 'vulns.issue' | transloco }}</th>
                    <th [attr.aria-sort]="sort() === 'severity' ? 'descending' : 'none'">
                      <button type="button" class="inline-flex items-center gap-1 cursor-pointer hover:text-ink" (click)="setSort('severity')">{{ 'vulns.severity' | transloco }}
                        @if (sort() === 'severity') { <span aria-hidden="true">↓</span> }</button></th>
                    <th>{{ 'scans.target' | transloco }}</th>
                    <th>{{ 'common.status' | transloco }}</th><th>{{ 'vulns.assignee' | transloco }}</th>
                    <th [attr.aria-sort]="sort() === 'lastDetected' ? 'descending' : 'none'">
                      <button type="button" class="inline-flex items-center gap-1 cursor-pointer hover:text-ink" (click)="setSort('lastDetected')">{{ 'vulns.lastSeen' | transloco }}
                        @if (sort() === 'lastDetected') { <span aria-hidden="true">↓</span> }</button></th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of items(); track v.id) {
                    <tr class="hover:bg-white/40">
                      @if (canTriage) {
                        <td><input type="checkbox" class="check" [checked]="selected().has(v.id)" (change)="toggle(v.id)" [attr.aria-label]="v.title" /></td>
                      }
                      <td class="min-w-[260px]">
                        <a [routerLink]="['/vulnerabilities', v.id]" class="font-medium hover:underline">{{ v.title }}</a>
                        <div class="text-xs text-ink-muted">{{ v.findingType }} · {{ v.firstDetectedAt | date: 'dd/MM' }}
                          @if (v.isReappeared) { · <b class="font-semibold text-warn">{{ 'vulns.reappeared' | transloco }}</b> }</div>
                      </td>
                      <td><app-severity-badge [severity]="v.severity" /></td>
                      <td class="whitespace-nowrap font-mono text-[13px]">{{ v.targetName }}</td>
                      <td><app-vuln-status-badge [status]="v.status" /></td>
                      <td class="whitespace-nowrap">
                        @if (v.assigneeName) {
                          <span class="inline-flex items-center gap-2"><span aria-hidden="true" class="grid place-items-center size-6 rounded-full bg-sev-medium-bg text-sev-medium text-[10px] font-bold">{{ initials(v.assigneeName) }}</span>{{ v.assigneeName }}</span>
                        } @else { <span class="text-ink-muted">{{ 'vulns.unassigned' | transloco }}</span> }
                      </td>
                      <td class="whitespace-nowrap">{{ v.lastDetectedAt | date: 'dd/MM' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <app-pagination [paging]="paging()" (pageChange)="load($event)" />
          } @else {
            <div class="flex flex-col items-center gap-2.5 px-6 py-12 text-center">
              <span class="size-14 rounded-full grid place-items-center bg-black/[.04] text-ink-muted">
                @if (filtered()) {
                  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8.5 11h5" /></svg>
                } @else {
                  <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
                }
              </span>
              <h2 class="text-[17px] font-semibold">{{ (filtered() ? 'vulns.noResults' : assignedToMe() ? 'vulns.emptyMine' : 'vulns.empty') | transloco }}</h2>
              <p class="max-w-md text-sm text-ink-muted">{{ (filtered() ? 'vulns.noResultsHint' : 'vulns.emptyHint') | transloco }}</p>
              @if (filtered()) {
                <button type="button" class="btn h-10" (click)="clearFilters()">{{ 'projects.clearFilters' | transloco }}</button>
              } @else if (canScan && !assignedToMe()) {
                <a routerLink="/scans/new" class="btn btn-primary h-10">{{ 'nav.newScan' | transloco }}</a>
              }
            </div>
          }
        </app-page-state>
      </section>

      <app-dialog [open]="assignOpen()" [heading]="'vulns.assignTitle' | transloco: { count: selected().size }" (closed)="assignOpen.set(false)">
        <label class="label" for="assignee">{{ 'vulns.assignee' | transloco }}</label>
        <select id="assignee" class="input" [ngModel]="assigneeId()" (ngModelChange)="assigneeId.set($event)">
          <option [ngValue]="null" disabled>{{ 'vulns.pickAssignee' | transloco }}</option>
          @for (u of assignees(); track u.id) { <option [ngValue]="u.id">{{ u.fullName }} · {{ u.role }}</option> }
        </select>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="assignOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
          <button type="button" class="btn btn-primary" [disabled]="!assigneeId()" (click)="assign()">{{ 'vulns.assignTo' | transloco }}</button>
        </div>
      </app-dialog>
    </div>
  `,
})
export class VulnListPage implements OnInit {
  private readonly api = inject(VulnerabilitiesApi);
  private readonly auth = inject(AuthService);
  protected readonly canTriage = this.auth.hasPermission('Vulnerability.Triage');
  protected readonly canUpdate = this.auth.hasPermission('Vulnerability.Update');
  protected readonly canScan = this.auth.hasPermission('Scan.Create');
  protected readonly severities: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  protected readonly statuses = STATUSES;
  protected readonly sevBar = SEV_BAR;
  protected readonly keyword = signal('');
  /** Open items for the All / My items switch. */
  protected readonly tabCounts = signal<{ all: number | null; mine: number | null }>({ all: null, mine: null });

  /** Route data (/my-items) or query params (?severity=), or set by the project tab. */
  readonly assignedToMe = input(false);
  readonly projectId = input<string | undefined>(undefined);
  readonly severity = input<Severity | undefined>(undefined);

  protected readonly sev = signal<Severity | null>(null);
  protected readonly statusFilter = signal<StatusFilter>('open');
  protected readonly sort = signal<'severity' | 'lastDetected'>('severity');
  protected readonly items = signal<Vulnerability[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly selected = signal(new Set<string>());
  protected readonly assignOpen = signal(false);
  protected readonly assignees = signal<UserLookup[]>([]);
  protected readonly assigneeId = signal<string | null>(null);
  protected readonly findingType = signal('');
  protected readonly assigneeFilter = signal('');
  protected readonly facets = signal<VulnerabilityFacets | null>(null);
  protected readonly filtered = computed(() => this.sev() !== null || !!this.keyword().trim() || this.statusFilter() !== 'open' || !!this.findingType() || !!this.assigneeFilter());
  protected readonly allChecked = computed(() => this.items().length > 0 && this.items().every((v) => this.selected().has(v.id)));

  ngOnInit(): void {
    this.sev.set(this.severity() ?? null);
    this.load();
    if (!this.projectId() && this.canUpdate) {
      this.api.getAll({ isOpen: true, pageSize: 1 }).subscribe({ next: (r) => this.tabCounts.update((c) => ({ ...c, all: r.paging?.totalItems ?? 0 })) });
      this.api.getAll({ isOpen: true, assignedToMe: true, pageSize: 1 }).subscribe({ next: (r) => this.tabCounts.update((c) => ({ ...c, mine: r.paging?.totalItems ?? 0 })) });
    }
  }

  protected setSort(s: 'severity' | 'lastDetected'): void { this.sort.set(s); this.load(1); }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
  }

  protected setSeverity(s: Severity | null): void { this.sev.set(s); this.load(1); }
  protected setStatus(s: StatusFilter): void { this.statusFilter.set(s); this.load(1); }
  protected clearFilters(): void {
    this.sev.set(null);
    this.keyword.set('');
    this.statusFilter.set('open');
    this.findingType.set('');
    this.assigneeFilter.set('');
    this.load(1);
  }

  protected loadAssignees(): void {
    if (this.assignees().length === 0) this.api.getAssignees().subscribe({ next: (r) => this.assignees.set(r.data ?? []) });
  }

  protected clearSelection(): void { this.selected.set(new Set()); }

  protected toggle(id: string): void {
    const next = new Set(this.selected());
    if (!next.delete(id)) next.add(id);
    this.selected.set(next);
  }

  protected toggleAll(): void {
    this.selected.set(this.allChecked() ? new Set() : new Set(this.items().map((v) => v.id)));
  }

  protected openAssign(): void {
    this.assignOpen.set(true);
    this.loadAssignees();
  }

  protected assign(): void {
    const id = this.assigneeId();
    if (!id) return;
    this.assignOpen.set(false);
    this.actionError.set(null);
    this.api.assign([...this.selected()], id).subscribe({
      next: () => { this.selected.set(new Set()); this.load(this.paging()?.page ?? 1); },
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    const f = this.statusFilter();
    const p: VulnerabilitySearch = {
      page, pageSize: 20, keyword: this.keyword().trim() || undefined, projectId: this.projectId(), assignedToMe: this.assignedToMe(), severity: this.sev() ?? undefined,
      sortBy: this.sort(), sortDirection: 'Desc',
      isOpen: f === 'open' ? true : f === 'closed' ? false : null, status: f === 'open' || f === 'closed' || f === 'all' ? undefined : f,
      findingType: this.findingType() || undefined, assigneeId: this.assigneeFilter() || undefined,
    };
    // Chip counts / type options ignore the severity and type filters themselves (server side).
    this.api.getFacets(p).subscribe({ next: (r) => this.facets.set(r.data) });
    this.api.getAll(p).subscribe({
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
