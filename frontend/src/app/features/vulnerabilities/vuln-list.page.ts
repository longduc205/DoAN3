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
const STATUSES: VulnerabilityStatus[] = ['Open', 'Triaged', 'Assigned', 'InProgress', 'PendingVerification', 'Reopened', 'Resolved', 'FalsePositive', 'AcceptedRisk'];

// W08 Vulnerability list. Same component for /vulnerabilities, /my-items (route data) and the project tab (projectId input).
@Component({
  selector: 'app-vuln-list',
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
            <nav class="flex p-[3px] rounded-[10px] bg-black/[.04]" [attr.aria-label]="'nav.vulnerabilities' | transloco">
              <a routerLink="/vulnerabilities" class="min-h-[34px] px-3 grid place-items-center rounded-lg text-[13px]" [class]="!assignedToMe() ? 'bg-white font-semibold' : 'text-ink-muted'">{{ 'projects.tabAll' | transloco }}</a>
              <a routerLink="/my-items" class="min-h-[34px] px-3 grid place-items-center rounded-lg text-[13px]" [class]="assignedToMe() ? 'bg-white font-semibold' : 'text-ink-muted'">{{ 'nav.myItems' | transloco }}</a>
            </nav>
          }
        </div>
      }

      <div class="flex flex-wrap items-center gap-2.5">
        <div role="group" [attr.aria-label]="'vulns.severity' | transloco" class="flex flex-wrap gap-1.5">
          <button type="button" class="h-8 px-3 rounded-full text-[13px] border cursor-pointer" [attr.aria-pressed]="!sev()"
            [class]="!sev() ? 'bg-ink text-white border-ink' : 'bg-white border-line'" (click)="setSeverity(null)">{{ 'projects.tabAll' | transloco }}</button>
          @for (s of severities; track s) {
            <button type="button" class="h-8 px-3 rounded-full text-[13px] border cursor-pointer" [attr.aria-pressed]="sev() === s"
              [class]="sev() === s ? 'bg-ink text-white border-ink' : 'bg-white border-line'" (click)="setSeverity(s)">{{ 'severity.' + s | transloco }}
              <span class="opacity-70">{{ facets()?.bySeverity?.[s] ?? 0 }}</span></button>
          }
        </div>
        <select class="h-9 px-2.5 rounded-[10px] border border-line bg-white text-sm" [attr.aria-label]="'common.status' | transloco"
          [ngModel]="statusFilter()" (ngModelChange)="setStatus($event)">
          <option value="open">{{ 'vulns.filterOpen' | transloco }}</option>
          <option value="closed">{{ 'vulns.filterClosed' | transloco }}</option>
          <option value="all">{{ 'projects.tabAll' | transloco }}</option>
          @for (s of statuses; track s) { <option [value]="s">{{ 'vulnStatus.' + s | transloco }}</option> }
        </select>
        <select class="h-9 px-2.5 rounded-[10px] border border-line bg-white text-sm" [attr.aria-label]="'vulns.type' | transloco"
          [ngModel]="findingType()" (ngModelChange)="findingType.set($event); load(1)">
          <option value="">{{ 'vulns.allTypes' | transloco }}</option>
          @for (t of facets()?.findingTypes ?? []; track t) { <option [value]="t">{{ t }}</option> }
        </select>
        @if (canTriage && !assignedToMe()) {
          <select class="h-9 px-2.5 rounded-[10px] border border-line bg-white text-sm" [attr.aria-label]="'vulns.assignee' | transloco"
            [ngModel]="assigneeFilter()" (ngModelChange)="assigneeFilter.set($event); load(1)" (focus)="loadAssignees()">
            <option value="">{{ 'vulns.allAssignees' | transloco }}</option>
            @for (u of assignees(); track u.id) { <option [value]="u.id">{{ u.fullName }}</option> }
          </select>
        }
        <select class="h-9 px-2.5 rounded-[10px] border border-line bg-white text-sm" [attr.aria-label]="'projects.sortLabel' | transloco"
          [ngModel]="sort()" (ngModelChange)="sort.set($event); load(1)">
          <option value="severity">{{ 'vulns.sortSeverity' | transloco }}</option>
          <option value="lastDetected">{{ 'vulns.sortLast' | transloco }}</option>
        </select>
      </div>

      @if (selected().size > 0) {
        <div class="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-ink text-white text-sm" role="region" [attr.aria-label]="'vulns.bulk' | transloco">
          <span>{{ 'vulns.selected' | transloco: { count: selected().size } }}</span>
          <button type="button" class="btn h-8" (click)="openAssign()">{{ 'vulns.assignTo' | transloco }}</button>
          <button type="button" class="underline cursor-pointer" (click)="clearSelection()">{{ 'vulns.clearSelection' | transloco }}</button>
        </div>
      }
      @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }

      <section class="rounded-2xl border border-line bg-white overflow-x-auto">
        <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
          @if (items().length > 0) {
            <table class="table">
              <thead>
                <tr>
                  @if (canTriage) {
                    <th class="w-10"><input type="checkbox" class="check" [checked]="allChecked()" (change)="toggleAll()" [attr.aria-label]="'vulns.selectAll' | transloco" /></th>
                  }
                  <th>{{ 'vulns.issue' | transloco }}</th><th>{{ 'vulns.severity' | transloco }}</th><th>{{ 'scans.target' | transloco }}</th>
                  <th>{{ 'common.status' | transloco }}</th><th>{{ 'vulns.assignee' | transloco }}</th><th>{{ 'vulns.lastSeen' | transloco }}</th>
                </tr>
              </thead>
              <tbody>
                @for (v of items(); track v.id) {
                  <tr class="hover:bg-black/[.02]">
                    @if (canTriage) {
                      <td><input type="checkbox" class="check" [checked]="selected().has(v.id)" (change)="toggle(v.id)" [attr.aria-label]="v.title" /></td>
                    }
                    <td class="min-w-[260px]">
                      <a [routerLink]="['/vulnerabilities', v.id]" class="font-medium hover:underline">{{ v.title }}</a>
                      <div class="mono break-all">{{ v.findingType }} · {{ v.url }}</div>
                    </td>
                    <td><app-severity-badge [severity]="v.severity" /></td>
                    <td class="whitespace-nowrap">{{ v.targetName }}<div class="mono">{{ v.projectName }}</div></td>
                    <td><app-vuln-status-badge [status]="v.status" [reappeared]="v.isReappeared" /></td>
                    <td class="whitespace-nowrap">{{ v.assigneeName ?? ('vulns.unassigned' | transloco) }}</td>
                    <td class="whitespace-nowrap">{{ v.lastDetectedAt | date: 'dd/MM' }}</td>
                  </tr>
                }
              </tbody>
            </table>
            <app-pagination [paging]="paging()" (pageChange)="load($event)" />
          } @else {
            <div class="flex flex-col items-center gap-2.5 px-6 py-11 text-center">
              <h2 class="text-[17px] font-semibold">{{ (filtered() ? 'vulns.noResults' : assignedToMe() ? 'vulns.emptyMine' : 'vulns.empty') | transloco }}</h2>
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
  protected readonly filtered = computed(() => this.sev() !== null || this.statusFilter() !== 'open' || !!this.findingType() || !!this.assigneeFilter());
  protected readonly allChecked = computed(() => this.items().length > 0 && this.items().every((v) => this.selected().has(v.id)));

  ngOnInit(): void {
    this.sev.set(this.severity() ?? null);
    this.load();
  }

  protected setSeverity(s: Severity | null): void { this.sev.set(s); this.load(1); }
  protected setStatus(s: StatusFilter): void { this.statusFilter.set(s); this.load(1); }
  protected clearFilters(): void {
    this.sev.set(null);
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
      page, pageSize: 20, projectId: this.projectId(), assignedToMe: this.assignedToMe(), severity: this.sev() ?? undefined,
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
