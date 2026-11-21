import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { StatusBadge } from '../../shared/components/badges';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { Project, Scan, Target, Vulnerability, VulnerabilityStatus } from '../../shared/models/api.models';

const CLOSED: VulnerabilityStatus[] = ['Resolved', 'FalsePositive', 'AcceptedRisk'];
import { ProjectsApi, ScansApi, TargetsApi, VulnerabilitiesApi } from '../api.services';
import { TargetFormComponent } from '../targets/target-form.component';
import { ReportListPage } from '../reports/report-list.page';
import { VulnListPage } from '../vulnerabilities/vuln-list.page';
import { ProjectFormComponent } from './project-form.component';

type Tab = 'overview' | 'targets' | 'scans' | 'vulns' | 'reports';

// W04 Project detail.
@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, StatusBadge, DialogComponent, TargetFormComponent, ProjectFormComponent, VulnListPage, ReportListPage],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (project(); as p) {
        <div class="flex flex-col gap-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex gap-4 items-start min-w-0">
              <span class="grid place-items-center size-12 shrink-0 rounded-2xl bg-ink text-white font-semibold" aria-hidden="true">{{ p.name.slice(0, 2).toUpperCase() }}</span>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="page-title">{{ p.name }}</h1>
                  <span class="px-2 py-0.5 rounded-md text-xs font-medium"
                    [class]="p.status === 'Active' ? 'text-ok bg-ok-bg' : 'text-sev-info bg-sev-info-bg'">{{ 'projectStatus.' + p.status | transloco }}</span>
                </div>
                <p class="mono mt-1">{{ p.code }} · {{ 'projects.createdOn' | transloco: { date: (p.createdDate | date: 'dd/MM/yyyy') } }}</p>
                @if (p.description) { <p class="text-ink-muted mt-2 max-w-2xl text-sm">{{ p.description }}</p> }
              </div>
            </div>
            <div class="flex gap-2">
              @if (canEdit) { <button type="button" class="btn h-10" (click)="editOpen.set(true)">{{ 'common.edit' | transloco }}</button> }
              @if (canScan) {
                <a routerLink="/scans/new" [queryParams]="{ projectId: p.id }" class="btn btn-primary h-10 rounded-[10px] font-semibold">{{ 'targets.startScan' | transloco }}</a>
              }
            </div>
          </div>

          <dl class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="glass p-4"><dt class="text-sm text-ink-muted">{{ 'nav.targets' | transloco }}</dt>
              <dd class="text-2xl font-semibold mt-1">{{ targets().length }}
                @if (needScope() > 0) { <span class="text-sm font-medium text-warn">· {{ 'projects.needScope' | transloco: { count: needScope() } }}</span> }</dd></div>
            <div class="glass p-4"><dt class="text-sm text-ink-muted">{{ 'dashboard.openVulns' | transloco }}</dt>
              <dd class="text-2xl font-semibold mt-1">{{ openVulns().length }}
                @if (criticalOpen() > 0) { <span class="text-sm font-medium text-sev-critical">· {{ 'projects.criticalCount' | transloco: { count: criticalOpen() } }}</span> }</dd></div>
            <div class="glass p-4"><dt class="text-sm text-ink-muted">{{ 'projects.resolved' | transloco }}</dt><dd class="text-2xl font-semibold mt-1">{{ resolvedCount() }}</dd></div>
            <div class="glass p-4"><dt class="text-sm text-ink-muted">{{ 'projects.lastScanLabel' | transloco }}</dt>
              <dd class="text-lg font-semibold mt-1">{{ lastScan() ? (lastScan() | date: 'dd/MM HH:mm') : ('projects.neverScanned' | transloco) }}</dd></div>
          </dl>

          <div role="tablist" [attr.aria-label]="p.name" class="flex p-[3px] rounded-[10px] bg-black/[.04] self-start">
            @for (t of tabs; track t) {
              <button type="button" role="tab" class="min-h-[34px] px-3 rounded-lg text-[13px] cursor-pointer" [attr.aria-selected]="tab() === t"
                [class]="tab() === t ? 'bg-white font-semibold' : 'text-ink-muted hover:text-ink'" (click)="tab.set(t)">
                {{ 'projects.tab_' + t | transloco }}
                @if (t === 'targets') { <span class="text-ink-muted">{{ targets().length }}</span> }
                @if (t === 'scans') { <span class="text-ink-muted">{{ scans().length }}</span> }
              </button>
            }
          </div>

          @if (actionError()) {
            <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div>
          }

          @switch (tab()) {
            @case ('overview') {
              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'projects.recentActivity' | transloco }}</h2>
                @for (s of scans().slice(0, 5); track s.id) {
                  <a [routerLink]="['/scans', s.id]" class="flex flex-wrap items-center gap-3 rounded-xl bg-white/60 p-3 hover:bg-white/85">
                    <app-status-badge [status]="s.status" />
                    <span class="font-medium">{{ s.targetName }}</span>
                    <span class="mono flex-1">{{ 'scans.findingCount' | transloco: { count: s.totalFindings } }}</span>
                    <span class="mono">{{ s.createdAt | date: 'dd/MM HH:mm' }}</span>
                  </a>
                } @empty {
                  <p class="text-sm text-ink-muted">{{ 'dashboard.noScans' | transloco }}</p>
                }
              </section>
            }
            @case ('targets') {
              <div class="flex justify-end">
                @if (canEdit) { <button type="button" class="btn h-10" (click)="targetModal.set({ target: null })">{{ 'targets.new' | transloco }}</button> }
              </div>
              <ul class="grid md:grid-cols-2 gap-4">
                @for (t of targets(); track t.id) {
                  <li class="glass p-5 flex flex-col gap-3">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="font-semibold">{{ t.name }}</div>
                        <div class="mono break-all">{{ t.baseUrl }}</div>
                      </div>
                      <span class="px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap"
                        [class]="t.isAuthorized ? 'text-ok bg-ok-bg' : 'text-warn bg-warn-bg'">
                        {{ (t.isAuthorized ? 'targets.scopeConfirmed' : 'targets.notAuthorized') | transloco }}</span>
                    </div>
                    <dl class="grid grid-cols-3 gap-2 text-sm">
                      <div><dt class="text-ink-muted text-xs">{{ 'targets.environment' | transloco }}</dt><dd>{{ 'environment.' + t.environment | transloco }}</dd></div>
                      <div><dt class="text-ink-muted text-xs">{{ 'targets.scopeMode' | transloco }}</dt><dd>{{ 'scopeMode.' + t.scopeMode | transloco }}</dd></div>
                      <div><dt class="text-ink-muted text-xs">{{ 'targets.lastScan' | transloco }}</dt><dd>{{ t.lastScanAt ? (t.lastScanAt | date: 'dd/MM') : '—' }}</dd></div>
                    </dl>
                    <div class="flex flex-wrap items-center gap-3 text-sm">
                      <span>{{ 'projects.openOnTarget' | transloco: { count: openByTarget()[t.id] ?? 0 } }}</span>
                      @if (runningByTarget()[t.id]; as run) {
                        <a [routerLink]="['/scans', run.id]" class="flex items-center gap-2 text-run">
                          <span class="size-1.5 rounded-full bg-current animate-pulse" aria-hidden="true"></span>{{ 'projects.scanningPct' | transloco: { pct: run.progressPercent } }}</a>
                      }
                    </div>
                    @if (!t.isEnabled) { <p class="text-xs text-ink-muted">{{ 'targets.disabled' | transloco }}</p> }
                    <div class="flex flex-wrap gap-2 pt-1">
                      @if (canScan && t.isEnabled && t.isAuthorized) {
                        <a routerLink="/scans/new" [queryParams]="{ targetId: t.id }" class="btn btn-primary h-8">{{ 'targets.startScan' | transloco }}</a>
                      }
                      @if (canEdit) {
                        <button type="button" class="btn h-8" (click)="targetModal.set({ target: t })">
                          {{ (t.isAuthorized ? 'common.edit' : 'targets.confirmScope') | transloco }}</button>
                        <button type="button" class="btn btn-danger h-8" (click)="toDelete.set(t)">{{ 'common.delete' | transloco }}</button>
                      }
                    </div>
                  </li>
                } @empty {
                  <li class="glass p-8 text-center text-ink-muted md:col-span-2">{{ 'targets.empty' | transloco }}</li>
                }
              </ul>
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
                        <td><a [routerLink]="['/scans', s.id]" class="font-medium hover:underline">{{ s.targetName }}</a></td>
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

          <app-dialog [open]="editOpen()" [heading]="'projects.edit' | transloco" (closed)="editOpen.set(false)">
            @if (editOpen()) { <app-project-form [project]="p" (saved)="onProjectSaved($event)" (cancelled)="editOpen.set(false)" /> }
          </app-dialog>
          <app-dialog [open]="!!targetModal()" [heading]="(targetModal()?.target ? 'targets.edit' : 'targets.new') | transloco" (closed)="targetModal.set(null)">
            @if (targetModal(); as m) { <app-target-form [projectId]="p.id" [target]="m.target" (saved)="onTargetSaved()" (cancelled)="targetModal.set(null)" /> }
          </app-dialog>
          <app-dialog [open]="!!toDelete()" [heading]="'targets.deleteTitle' | transloco" (closed)="toDelete.set(null)">
            <p class="text-sm">{{ 'targets.deleteBody' | transloco: { name: toDelete()?.name } }}</p>
            <div class="flex justify-end gap-2">
              <button type="button" class="btn" (click)="toDelete.set(null)">{{ 'common.cancel' | transloco }}</button>
              <button type="button" class="btn btn-danger" (click)="removeTarget()">{{ 'common.delete' | transloco }}</button>
            </div>
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
  protected readonly targetModal = signal<{ target: Target | null } | null>(null);
  protected readonly toDelete = signal<Target | null>(null);

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

  protected onTargetSaved(): void {
    this.targetModal.set(null);
    this.loadTargets();
  }

  protected removeTarget(): void {
    const t = this.toDelete();
    this.toDelete.set(null);
    if (!t) return;
    this.targetsApi.delete(t.id).subscribe({ next: () => this.loadTargets(), error: (err) => this.actionError.set(apiErrorMessage(err)) });
  }

  private loadTargets(): void {
    this.targetsApi.getAll({ projectId: this.id(), pageSize: 100 }).subscribe({
      next: (res) => this.targets.set(res.data ?? []),
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }
}
