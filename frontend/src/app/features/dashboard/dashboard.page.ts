import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, StatusBadge } from '../../shared/components/badges';
import { PageState } from '../../shared/components/page-state';
import { DashboardSummary, Scan, Severity, Vulnerability } from '../../shared/models/api.models';
import { DashboardApi, ScansApi, VulnerabilitiesApi } from '../api.services';

const SEV_BAR: Record<Severity, string> = {
  Critical: 'bg-sev-critical', High: 'bg-sev-high', Medium: 'bg-sev-medium-bar', Low: 'bg-ink/40', Info: 'bg-ink/20',
};

const RISK_WEIGHTS = { Critical: 25, High: 10, Medium: 4, Low: 1 } as const;

// W02 Dashboard. shortcut: no SLA / due dates yet, so the queue is sorted by severity instead of time left.
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, SeverityBadge, StatusBadge],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="page-title">{{ 'dashboard.title' | transloco }}</h1>
          <p class="mt-1 text-sm text-ink-muted">
            @if (recent()[0]; as last) {
              {{ 'dashboard.insight' | transloco: { target: last.targetName, count: last.totalFindings, unassigned: summary()?.unassigned ?? 0 } }}
            } @else { {{ 'dashboard.subtitle' | transloco }} }
          </p>
        </div>
        @if (canScan) {
          <a routerLink="/scans/new" class="btn btn-primary h-10 rounded-[10px] font-semibold">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {{ 'dashboard.newScan' | transloco }}
          </a>
        }
      </div>

      <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
        @if (summary(); as s) {
          @if (s.scans === 0) {
            <section class="glass p-8 flex flex-col gap-4">
              <h2 class="text-lg font-semibold">{{ 'dashboard.emptyTitle' | transloco }}</h2>
              <ol class="grid md:grid-cols-3 gap-3">
                @for (step of ['dashboard.step1', 'dashboard.step2', 'dashboard.step3']; track step; let i = $index) {
                  <li class="rounded-2xl bg-white/70 border border-line p-4 flex gap-3">
                    <span class="grid place-items-center size-7 shrink-0 rounded-full bg-ink text-white text-sm font-semibold">{{ i + 1 }}</span>
                    <span class="text-sm">{{ step | transloco }}</span>
                  </li>
                }
              </ol>
              <a routerLink="/projects" class="btn self-start">{{ 'nav.projects' | transloco }}</a>
            </section>
          } @else {
            <div class="grid grid-cols-12 gap-4">
              <!-- KPI strip: one glass card under a strip of generated art (W02). -->
              <section class="col-span-12 relative pt-8">
                <div aria-hidden="true" class="absolute inset-x-0 top-0 h-24 rounded-t-[22px] bg-cover bg-center [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
                  style="background-image: url(/art/ember-11.png)"></div>
                <div class="glass relative grid grid-cols-2 lg:grid-cols-4 divide-line overflow-hidden lg:divide-x max-lg:[&>*:nth-child(odd)]:border-r max-lg:[&>*:nth-child(-n+2)]:border-b border-line">
                  <a routerLink="/vulnerabilities" class="p-5 hover:bg-white/40">
                    <div class="text-sm text-ink-muted">{{ 'dashboard.riskScore' | transloco }}</div>
                    <div class="mt-2 text-3xl font-semibold">{{ s.riskScore }}<span class="text-sm font-normal text-ink-muted"> / 100 · {{ 'dashboard.risk.' + riskLevel() | transloco }}</span></div>
                  </a>
                  <a routerLink="/vulnerabilities" class="p-5 hover:bg-white/40">
                    <div class="text-sm text-ink-muted">{{ 'dashboard.openVulns' | transloco }}</div>
                    <div class="mt-2 text-3xl font-semibold">{{ s.openVulnerabilities }}</div>
                    <div class="mt-1 text-xs text-ink-muted">{{ 'dashboard.findingTotal' | transloco: { count: s.findings } }}</div>
                  </a>
                  <a routerLink="/vulnerabilities" class="p-5 hover:bg-white/40">
                    <div class="text-sm text-ink-muted">{{ 'dashboard.unassigned' | transloco }}</div>
                    <div class="mt-2 text-3xl font-semibold" [class.text-danger]="s.unassigned > 0">{{ s.unassigned }}</div>
                  </a>
                  <a routerLink="/vulnerabilities" class="p-5 hover:bg-white/40">
                    <div class="text-sm text-ink-muted">{{ 'dashboard.reappeared' | transloco }}</div>
                    <div class="mt-2 text-3xl font-semibold" [class.text-warn]="s.reappeared > 0">{{ s.reappeared }}</div>
                  </a>
                </div>
              </section>

              <section class="glass col-span-12 lg:col-span-8 overflow-hidden">
                <div class="flex justify-between items-center px-5 pt-4 pb-2">
                  <h2 class="font-semibold">{{ 'dashboard.queue' | transloco }} <span class="font-normal text-ink-muted">{{ queue().length }}</span></h2>
                  <a routerLink="/vulnerabilities" class="text-sm hover:underline">{{ 'common.viewAll' | transloco }}</a>
                </div>
                <ul>
                  @for (v of queue(); track v.id) {
                    <li class="flex items-center gap-4 px-5 py-3 border-t border-line">
                      <span class="w-20 shrink-0"><app-severity-badge [severity]="v.severity" /></span>
                      <span class="flex-1 min-w-0">
                        <a [routerLink]="['/vulnerabilities', v.id]" class="block font-medium truncate hover:underline">{{ v.title }}</a>
                        <span class="block text-[13px] text-ink-muted truncate">
                          {{ v.projectName }} · {{ v.lastDetectedAt | date: 'dd/MM' }} · {{ v.assigneeName ?? ('vulns.unassigned' | transloco) }}
                          @if (v.isReappeared) { · <span class="text-warn">{{ 'vulns.reappeared' | transloco }}</span> }
                        </span>
                      </span>
                      <a [routerLink]="['/vulnerabilities', v.id]" class="btn h-8 shrink-0">{{ actionKey(v) | transloco }}</a>
                    </li>
                  } @empty {
                    <li class="px-5 py-6 border-t border-line text-sm text-center text-ink-muted">{{ 'dashboard.queueEmpty' | transloco }}</li>
                  }
                </ul>
              </section>

              <section class="glass col-span-12 lg:col-span-4 p-5 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h2 class="font-semibold">{{ 'dashboard.bySeverity' | transloco }}</h2>
                  <a routerLink="/vulnerabilities" class="text-sm hover:underline">{{ 'dashboard.viewOpen' | transloco: { count: s.openVulnerabilities } }}</a>
                </div>
                <ul class="flex flex-col gap-1">
                  @for (sev of severities; track sev) {
                    <li>
                      <a routerLink="/vulnerabilities" [queryParams]="{ severity: sev }" class="grid grid-cols-[72px_1fr_28px] items-center gap-3 py-2 rounded-lg text-sm hover:bg-white/50">
                        <span>{{ 'severity.' + sev | transloco }}</span>
                        <span class="h-1.5 rounded-full bg-black/5 overflow-hidden"><span class="block h-full rounded-full" [class]="sevBar[sev]" [style.width.%]="sevPct(sev)"></span></span>
                        <b class="text-right font-semibold">{{ s.openBySeverity[sev] ?? 0 }}</b>
                      </a>
                    </li>
                  }
                </ul>
              </section>

              <section class="glass col-span-12 lg:col-span-8 p-5 flex flex-col gap-3">
                @if (active()[0]; as scan) {
                  <a [routerLink]="['/scans', scan.id]" class="flex flex-col gap-2 group">
                    <div class="flex items-center justify-between gap-2">
                      <h2 class="font-semibold group-hover:underline">{{ 'dashboard.scanRunning' | transloco: { target: scan.targetName } }}</h2>
                      <app-status-badge [status]="scan.status" />
                    </div>
                    <span class="font-mono text-[13px] text-ink-muted truncate">{{ scan.targetBaseUrl }}</span>
                    <div class="h-1.5 rounded-full bg-black/10 overflow-hidden" role="progressbar" [attr.aria-valuenow]="scan.progressPercent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="scan.targetName">
                      <div class="h-full bg-ink" [style.width.%]="scan.progressPercent"></div>
                    </div>
                    <div class="flex justify-between text-[13px] text-ink-muted"><span>{{ 'dashboard.findingTotal' | transloco: { count: scan.totalFindings } }}</span><span>{{ scan.progressPercent }}%</span></div>
                  </a>
                } @else {
                  <h2 class="font-semibold">{{ 'dashboard.activeScans' | transloco }}</h2>
                  <p class="text-sm text-ink-muted">{{ 'dashboard.noActiveScans' | transloco }}</p>
                }
                <div class="flex items-center justify-between pt-3 border-t border-line">
                  <h3 class="text-sm font-semibold">{{ 'dashboard.recent' | transloco }}</h3>
                  <a routerLink="/scans" class="text-sm hover:underline">{{ 'common.viewAll' | transloco }}</a>
                </div>
                <ul class="flex flex-col">
                  @for (scan of recent(); track scan.id) {
                    <li>
                      <a [routerLink]="['/scans', scan.id]" class="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2 text-sm rounded-lg hover:bg-white/50">
                        <span class="min-w-0 truncate"><span class="font-medium mr-2">{{ scan.targetName }}</span><span class="font-mono text-xs text-ink-muted">{{ scan.targetBaseUrl }}</span></span>
                        <app-status-badge [status]="scan.status" />
                        <span class="w-36 text-right text-ink-muted whitespace-nowrap">{{ 'dashboard.findingTotal' | transloco: { count: scan.totalFindings } }} · {{ scan.createdAt | date: 'dd/MM HH:mm' }}</span>
                      </a>
                    </li>
                  }
                </ul>
              </section>

              <section class="glass col-span-12 lg:col-span-4 p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'dashboard.riskFrom' | transloco: { score: s.riskScore } }}</h2>
                <ul class="flex flex-col gap-2 text-sm">
                  @for (r of riskRows(); track r.sev) {
                    <li class="flex justify-between gap-3"><span>{{ 'dashboard.riskRow' | transloco: { count: r.count, sev: r.sev, weight: r.weight } }}</span><b>{{ r.points }}</b></li>
                  } @empty {
                    <li class="text-ink-muted">{{ 'dashboard.queueEmpty' | transloco }}</li>
                  }
                </ul>
                <p class="text-xs text-ink-muted">{{ 'dashboard.riskCap' | transloco }}</p>
              </section>

              <section class="glass col-span-12 grid grid-cols-2 md:grid-cols-6 overflow-hidden">
                <div class="col-span-2 md:col-span-1 p-5 md:border-r border-line">
                  <h2 class="font-semibold">{{ 'dashboard.pipeline' | transloco }}</h2>
                  @if (bottleneck(); as b) {
                    <p class="mt-1 text-[13px] text-ink-muted">{{ 'dashboard.bottleneck' | transloco: { status: ('vulnStatus.' + b | transloco), count: s.byStatus[b] } }}</p>
                  }
                </div>
                @for (st of pipeline; track st; let last = $last) {
                  <div class="p-5 border-line max-md:border-t" [class.md:border-r]="!last">
                    <div class="text-[13px] text-ink-muted">{{ 'vulnStatus.' + st | transloco }}</div>
                    <div class="mt-1 text-xl font-semibold" [class.text-warn]="st === bottleneck()">{{ s.byStatus[st] ?? 0 }}</div>
                  </div>
                }
              </section>
            </div>
          }
        }
      </app-page-state>
    </div>
  `,
})
export class DashboardPage implements OnInit {
  private readonly dashboardApi = inject(DashboardApi);
  private readonly scansApi = inject(ScansApi);
  private readonly vulnApi = inject(VulnerabilitiesApi);
  protected readonly canScan = inject(AuthService).hasPermission('Scan.Create');

  protected readonly pipeline = ['Open', 'Triaged', 'Assigned', 'InProgress', 'PendingVerification'] as const;
  protected readonly severities: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  protected readonly sevBar = SEV_BAR;
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly recent = signal<Scan[]>([]);
  protected readonly active = signal<Scan[]>([]);
  protected readonly queue = signal<Vulnerability[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Label only: >= 60 high, >= 30 medium, else low (same 0-100 scale as the server's capped score). */
  protected readonly riskLevel = computed(() => {
    const r = this.summary()?.riskScore ?? 0;
    return r >= 60 ? 'high' : r >= 30 ? 'medium' : 'low';
  });
  /** "Điểm X đến từ": one row per weighted severity with open items. */
  protected readonly riskRows = computed(() => {
    const o = this.summary()?.openBySeverity ?? {};
    return (['Critical', 'High', 'Medium', 'Low'] as const).filter((k) => o[k])
      .map((k) => ({ sev: k, count: o[k]!, weight: RISK_WEIGHTS[k], points: o[k]! * RISK_WEIGHTS[k] }));
  });

  protected sevPct(sev: Severity): number {
    const s = this.summary();
    const max = Math.max(1, ...this.severities.map((k) => s?.openBySeverity[k] ?? 0));
    return ((s?.openBySeverity[sev] ?? 0) / max) * 100;
  }

  /** The pipeline step holding the most items (W02 "nút thắt"); none when everything is empty. */
  protected readonly bottleneck = computed(() => {
    const by = this.summary()?.byStatus ?? {};
    const top = [...this.pipeline].sort((a, b) => (by[b] ?? 0) - (by[a] ?? 0))[0];
    return (by[top] ?? 0) > 0 ? top : null;
  });

  protected actionKey(v: Vulnerability): string {
    if (v.status === 'PendingVerification') return 'dashboard.actVerify';
    if (!v.assigneeId) return 'dashboard.actAssign';
    return 'dashboard.actView';
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.dashboardApi.getSummary(),
      recent: this.scansApi.getAll({ pageSize: 4 }),
      running: this.scansApi.getAll({ pageSize: 3, status: 'Running' }),
      queued: this.scansApi.getAll({ pageSize: 3, status: 'Queued' }),
      queue: this.vulnApi.getAll({ isOpen: true, sortBy: 'severity', sortDirection: 'Desc', pageSize: 5 }),
    }).subscribe({
      next: (r) => {
        this.summary.set(r.summary.data);
        this.recent.set(r.recent.data ?? []);
        this.active.set([...(r.running.data ?? []), ...(r.queued.data ?? [])].slice(0, 3));
        this.queue.set(r.queue.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
