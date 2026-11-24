import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { StatusBadge } from '../../shared/components/badges';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { Project, Scan, ScanStatus, Target, Vulnerability, VulnerabilityStatus } from '../../shared/models/api.models';

const CLOSED: VulnerabilityStatus[] = ['Resolved', 'FalsePositive', 'AcceptedRisk'];
/** Same weights as DashboardService.RiskWeights on the server, so the ring matches the dashboard score. */
const RISK_WEIGHTS: Partial<Record<string, number>> = { Critical: 25, High: 10, Medium: 4, Low: 1 };
import { ProjectsApi, ScansApi, TargetsApi, VulnerabilitiesApi } from '../api.services';
import { ReportListPage } from '../reports/report-list.page';
import { VulnListPage } from '../vulnerabilities/vuln-list.page';
import { ProjectFormComponent } from './project-form.component';

type Tab = 'overview' | 'targets' | 'scans' | 'vulns' | 'reports';

// W04 Project detail.
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, NgTemplateOutlet, TranslocoPipe, DatePipe, PageState, StatusBadge, DialogComponent, ProjectFormComponent, VulnListPage, ReportListPage],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (project(); as p) {
        <div class="flex flex-col gap-5">
          <section class="glass p-5 flex flex-col gap-4">
            <div class="flex flex-wrap items-center gap-4">
              <span class="grid place-items-center size-14 shrink-0 rounded-2xl bg-ink/[.06] text-lg font-semibold" aria-hidden="true">{{ p.name.slice(0, 2).toUpperCase() }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="page-title">{{ p.name }}</h1>
                  <span class="px-2 py-0.5 rounded-md bg-ink/[.06] font-mono text-xs">{{ p.code }}</span>
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                    [class]="p.status === 'Active' ? 'text-ok bg-ok-bg' : 'text-sev-info bg-sev-info-bg'">
                    <span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span>{{ 'projectStatus.' + p.status | transloco }}</span>
                </div>
                <p class="mt-1 text-sm text-ink-muted">
                  @if (p.description) { {{ p.description }} · }{{ 'projects.createdOn' | transloco: { date: (p.createdDate | date: 'dd/MM/yyyy') } }}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <div class="relative size-16 shrink-0" role="img" [attr.aria-label]="'projects.riskAria' | transloco: { score: risk() }">
                  <svg viewBox="0 0 36 36" class="size-16 -rotate-90" aria-hidden="true">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-ink/10" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="text-sev-high"
                      [attr.stroke-dasharray]="(risk() / 100) * 97.4 + ' 97.4'" />
                  </svg>
                  <span class="absolute inset-0 grid place-content-center text-center leading-none">
                    <b class="text-lg text-sev-high">{{ risk() }}</b><span class="text-[9px] text-ink-muted">{{ 'projects.riskShort' | transloco }}</span>
                  </span>
                </div>
                @if (canEdit) {
                  <button type="button" class="btn h-10" (click)="editOpen.set(true)">
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" /></svg>
                    {{ 'common.edit' | transloco }}</button>
                }
                @if (canScan) {
                  <a routerLink="/scans/new" [queryParams]="{ projectId: p.id }" class="btn btn-primary h-10 rounded-[10px] font-semibold">
                    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4l13 8-13 8z" /></svg>
                    {{ 'projects.runScan' | transloco }}</a>
                }
              </div>
            </div>
            <dl class="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-line">
              <div><dt class="text-[13px] text-ink-muted">{{ 'nav.targets' | transloco }}</dt>
                <dd class="mt-0.5 text-lg font-semibold">{{ targets().length }}
                  @if (needScope() > 0) { <span class="text-xs font-medium text-warn">· {{ 'projects.needScope' | transloco: { count: needScope() } }}</span> }</dd></div>
              <div><dt class="text-[13px] text-ink-muted">{{ 'dashboard.openVulns' | transloco }}</dt>
                <dd class="mt-0.5 text-lg font-semibold">{{ openVulns().length }}
                  @if (criticalOpen() > 0) { <span class="text-xs font-medium text-sev-critical">· {{ 'projects.criticalCount' | transloco: { count: criticalOpen() } }}</span> }</dd></div>
              <div><dt class="text-[13px] text-ink-muted">{{ 'projects.lastScanLabel' | transloco }}</dt>
                <dd class="mt-0.5 text-lg font-semibold">{{ lastScan() ? (lastScan() | date: 'dd/MM HH:mm') : ('projects.neverScanned' | transloco) }}
                  @if (anyRunning()) { <span class="text-xs font-medium text-run">· {{ 'projects.scanning' | transloco }}</span> }</dd></div>
              <div><dt class="text-[13px] text-ink-muted">{{ 'projects.resolved' | transloco }}</dt><dd class="mt-0.5 text-lg font-semibold">{{ resolvedCount() }}</dd></div>
            </dl>
          </section>

          <div role="tablist" [attr.aria-label]="p.name" class="flex gap-1 border-b border-line overflow-x-auto">
            @for (t of tabs; track t) {
              <button type="button" role="tab" class="-mb-px flex items-center gap-2 px-3 py-2.5 border-b-2 text-sm whitespace-nowrap cursor-pointer" [attr.aria-selected]="tab() === t"
                [class]="tab() === t ? 'border-ink font-semibold' : 'border-transparent text-ink-muted hover:text-ink'" (click)="tab.set(t)">
                {{ 'projects.tab_' + t | transloco }}
                @if (tabCount(t); as n) { <span class="px-1.5 rounded-full bg-ink/[.06] text-xs font-medium">{{ n }}</span> }
              </button>
            }
          </div>

          @if (actionError()) {
            <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div>
          }

          @switch (tab()) {
            @case ('overview') {
              <section class="glass p-5 max-w-2xl"><ng-container *ngTemplateOutlet="activity" /></section>
            }
            @case ('targets') {
              <div class="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
                <div class="flex flex-col gap-3 min-w-0">
                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm text-ink-muted [&_b]:font-semibold [&_b]:text-ok" [innerHTML]="'targets.addHint' | transloco"></p>
                    @if (canEdit) {
                      <a [routerLink]="['/projects', p.id, 'targets', 'new']" class="btn h-10">
                        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
                        {{ 'targets.new' | transloco }}</a>
                    }
                  </div>
                  <ul class="flex flex-col gap-3">
                    @for (t of targets(); track t.id) {
                      @if (t.isAuthorized) {
                        <li class="glass p-5 flex flex-col gap-3">
                          <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                              <div class="font-mono font-semibold break-all">{{ t.baseUrl }}</div>
                              <div class="text-[13px] text-ink-muted">{{ t.name }} · {{ 'targets.confirmedBy' | transloco: { env: ('environment.' + t.environment | transloco), date: (t.createdDate | date: 'dd/MM') } }}</div>
                            </div>
                            @if (t.isEnabled) {
                              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap text-ok bg-ok-bg">
                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12l5 5 9-10" /></svg>
                                {{ 'targets.scopeConfirmed' | transloco }}</span>
                            } @else {
                              <span class="px-2 py-0.5 rounded-full text-xs font-semibold text-sev-info bg-sev-info-bg">{{ 'targets.disabledTag' | transloco }}</span>
                            }
                          </div>
                          <div class="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                            {{ 'targets.scopeMode' | transloco }} <span class="px-2 py-0.5 rounded-md bg-ink/[.05] font-mono text-xs text-ink">{{ 'scopeMode.' + t.scopeMode | transloco }}</span>
                          </div>
                          <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-line text-[13px]">
                            @if (runningByTarget()[t.id]; as run) {
                              <a [routerLink]="['/scans', run.id]" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-run-bg text-run font-medium">
                                <span class="size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true"></span>{{ 'projects.scanningPct' | transloco: { pct: run.progressPercent } }}</a>
                            }
                            <span class="text-ink-muted">{{ 'targets.openCount' | transloco: { count: openByTarget()[t.id] ?? 0 } }}</span>
                            <span class="flex-1"></span>
                            @if (canEdit) { <a [routerLink]="['/projects', p.id, 'targets', t.id, 'edit']" class="underline underline-offset-4">{{ 'common.edit' | transloco }}</a> }
                            @if (canScan && t.isEnabled) { <a routerLink="/scans/new" [queryParams]="{ targetId: t.id }" class="underline underline-offset-4">{{ 'projects.runScan' | transloco }}</a> }
                          </div>
                        </li>
                      } @else {
                        <li class="rounded-[20px] border border-warn/30 bg-warn-bg p-5 flex flex-wrap items-center gap-3">
                          <div class="min-w-0 flex-1">
                            <div class="font-mono font-semibold break-all">{{ t.baseUrl }}</div>
                            <div class="text-[13px] text-warn">{{ 'targets.unconfirmedHint' | transloco }}</div>
                          </div>
                          @if (canEdit) {
                            <a [routerLink]="['/projects', p.id, 'targets', t.id, 'edit']" class="btn h-9 border-transparent bg-warn text-white hover:bg-warn/90 font-semibold">{{ 'targets.confirmScope' | transloco }}</a>
                          }
                        </li>
                      }
                    } @empty {
                      <li class="glass p-8 text-center text-ink-muted">{{ 'targets.empty' | transloco }}</li>
                    }
                  </ul>
                </div>
                <section class="glass p-5"><ng-container *ngTemplateOutlet="activity" /></section>
              </div>
            }
            @case ('vulns') { <app-vuln-list [projectId]="p.id" /> }
            @case ('reports') { <app-report-list [projectId]="p.id" /> }
            @case ('scans') {
              <section class="glass overflow-x-auto">
                <table class="table">
                  <thead><tr><th>{{ 'scans.target' | transloco }}</th><th>{{ 'common.status' | transloco }}</th>
                    <th>{{ 'scans.findings' | transloco }}</th><th>{{ 'common.createdDate' | transloco }}</th></tr></thead>
                  <tbody>
                    @for (s of scans(); track s.id) {
                      <tr>
                        <td><a [routerLink]="['/scans', s.id]" class="font-medium hover:underline">{{ s.targetName }}</a><div class="mono">{{ s.targetBaseUrl }}</div></td>
                        <td><app-status-badge [status]="s.status" /></td>
                        <td>{{ s.totalFindings }}</td>
                        <td class="whitespace-nowrap">{{ s.createdAt | date: 'dd/MM HH:mm' }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="4" class="text-center text-ink-muted">{{ 'dashboard.noScans' | transloco }}</td></tr>
                    }
                  </tbody>
                </table>
              </section>
            }
          }

          <ng-template #activity>
            <h2 class="font-semibold mb-3">{{ 'projects.recentActivity' | transloco }}</h2>
            <ul class="flex flex-col gap-3.5">
              @for (s of scans().slice(0, 5); track s.id) {
                <li class="flex gap-3">
                  <span aria-hidden="true" class="mt-1.5 size-2.5 shrink-0 rounded-full" [class]="dot(s.status)"></span>
                  <a [routerLink]="['/scans', s.id]" class="min-w-0 text-sm hover:underline">
                    {{ 'projects.activityScan' | transloco: { target: s.targetName, status: ('scanStatus.' + s.status | transloco) } }}
                    <span class="block text-[13px] text-ink-muted">{{ s.createdAt | date: 'dd/MM HH:mm' }} · {{ 'scans.findingCount' | transloco: { count: s.totalFindings } }}</span>
                  </a>
                </li>
              } @empty {
                <li class="text-sm text-ink-muted">{{ 'dashboard.noScans' | transloco }}</li>
              }
            </ul>
          </ng-template>

          <app-dialog [open]="editOpen()" [heading]="'projects.edit' | transloco" (closed)="editOpen.set(false)">
            @if (editOpen()) { <app-project-form [project]="p" (saved)="onProjectSaved($event)" (cancelled)="editOpen.set(false)" /> }
          </app-dialog>
        </div>
      }
    </app-page-state>
  `,
})
export class ProjectDetailPage implements OnInit {
  private readonly projectsApi = inject(ProjectsApi);
  private readonly targetsApi = inject(TargetsApi);
  private readonly scansApi = inject(ScansApi);
  private readonly vulnApi = inject(VulnerabilitiesApi);
  private readonly auth = inject(AuthService);
  protected readonly canEdit = this.auth.hasPermission('Project.Update');
  protected readonly canScan = this.auth.hasPermission('Scan.Create');
  protected readonly tabs: Tab[] = ['overview', 'targets', 'scans', 'vulns', 'reports'];

  readonly id = input.required<string>();
  protected readonly project = signal<Project | null>(null);
  protected readonly targets = signal<Target[]>([]);
  protected readonly scans = signal<Scan[]>([]);
  protected readonly tab = signal<Tab>('targets');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly editOpen = signal(false);

  protected readonly needScope = computed(() => this.targets().filter((t) => t.isEnabled && !t.isAuthorized).length);
  // shortcut: counts come from the first 100 vulnerabilities of the project; add a count API if projects grow past that.
  protected readonly vulns = signal<Vulnerability[]>([]);
  protected readonly openVulns = computed(() => this.vulns().filter((v) => !CLOSED.includes(v.status)));
  protected readonly criticalOpen = computed(() => this.openVulns().filter((v) => v.severity === 'Critical').length);
  protected readonly resolvedCount = computed(() => this.vulns().filter((v) => v.status === 'Resolved').length);
  protected readonly openByTarget = computed(() =>
    this.openVulns().reduce<Partial<Record<string, number>>>((m, v) => ({ ...m, [v.targetId]: (m[v.targetId] ?? 0) + 1 }), {}));
  protected readonly runningByTarget = computed(() =>
    Object.fromEntries(this.scans().filter((s) => s.status === 'Running' || s.status === 'Queued').map((s) => [s.targetId, s])) as Partial<Record<string, Scan>>);
  protected readonly anyRunning = computed(() => this.scans().some((s) => s.status === 'Running' || s.status === 'Queued'));
  protected readonly risk = computed(() => Math.min(100, this.openVulns().reduce((n, v) => n + (RISK_WEIGHTS[v.severity] ?? 0), 0)));
  protected readonly lastScan = computed(() => this.scans()[0]?.createdAt ?? null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.projectsApi.getById(this.id()).subscribe({
      next: (res) => {
        this.project.set(res.data);
        this.loading.set(false);
        this.loadTargets();
        this.scansApi.getAll({ projectId: this.id(), pageSize: 100 }).subscribe({ next: (r) => this.scans.set(r.data ?? []) });
        this.vulnApi.getAll({ projectId: this.id(), pageSize: 100 }).subscribe({ next: (r) => this.vulns.set(r.data ?? []) });
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected onProjectSaved(p: Project): void {
    this.editOpen.set(false);
    this.project.set(p);
  }

  protected tabCount(t: Tab): number | null {
    if (t === 'targets') return this.targets().length;
    if (t === 'scans') return this.scans().length;
    if (t === 'vulns') return this.openVulns().length;
    return null;
  }

  protected dot(s: ScanStatus): string {
    return s === 'Completed' ? 'bg-ok' : s === 'Failed' ? 'bg-sev-high' : s === 'Running' || s === 'Queued' ? 'bg-run' : 'bg-ink/30';
  }

  private loadTargets(): void {
    this.targetsApi.getAll({ projectId: this.id(), pageSize: 100 }).subscribe({
      next: (res) => this.targets.set(res.data ?? []),
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }
}
