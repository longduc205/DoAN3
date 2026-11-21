import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, StatusBadge, VulnStatusBadge } from '../../shared/components/badges';
import { PageState } from '../../shared/components/page-state';
import { DashboardSummary, Scan, Severity, Vulnerability } from '../../shared/models/api.models';
import { DashboardApi, ScansApi, VulnerabilitiesApi } from '../api.services';

const SEV_BAR: Record<Severity, string> = {
  Critical: 'bg-sev-critical', High: 'bg-sev-high', Medium: 'bg-sev-medium', Low: 'bg-sev-low', Info: 'bg-sev-info',
};

const RISK_WEIGHTS = { Critical: 25, High: 10, Medium: 4, Low: 1 } as const;

// W02 Dashboard. shortcut: no SLA / due dates yet, so the queue is sorted by severity instead of time left.
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, SeverityBadge, StatusBadge, VulnStatusBadge],
  template: `
    <div class="flex flex-col gap-5">
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
          <a routerLink="/scans/new" class="btn btn-primary h-10 rounded-[10px] font-semibold">{{ 'dashboard.newScan' | transloco }}</a>
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
              <a routerLink="/vulnerabilities" class="glass col-span-6 lg:col-span-3 p-5 hover:bg-white/80">
                <div class="text-sm text-ink-muted">{{ 'dashboard.riskScore' | transloco }}</div>
                <div class="text-3xl font-semibold mt-1">{{ s.riskScore }}<span class="text-base text-ink-muted">/100</span></div>
                <div class="text-xs text-ink-muted mt-1">{{ riskExplain() }}</div>
              </a>
              <a routerLink="/vulnerabilities" class="glass col-span-6 lg:col-span-3 p-5 hover:bg-white/80">
                <div class="text-sm text-ink-muted">{{ 'dashboard.openVulns' | transloco }}</div>
                <div class="text-3xl font-semibold mt-1">{{ s.openVulnerabilities }}</div>
              </a>
              @for (card of cards; track card.key) {
                <a [routerLink]="card.link" class="glass col-span-6 lg:col-span-3 p-5 hover:bg-white/80">
                  <div class="text-sm text-ink-muted">{{ 'dashboard.' + card.key | transloco }}</div>
                  <div class="text-3xl font-semibold mt-1">{{ s[card.key] }}</div>
                </a>
              }

              <section class="glass col-span-12 lg:col-span-8 p-5 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h2 class="font-semibold">{{ 'dashboard.bySeverity' | transloco }}</h2>
                  <a routerLink="/vulnerabilities" class="text-sm hover:underline">{{ 'dashboard.viewOpen' | transloco: { count: s.openVulnerabilities } }}</a>
                </div>
                @if (s.openVulnerabilities > 0) {
                  <div class="flex h-3 rounded-full overflow-hidden bg-black/5" role="img" [attr.aria-label]="severityLabel()">
                    @for (sev of severities; track sev) {
                      @if (s.openBySeverity[sev]) {
                        <span [class]="sevBar[sev]" [style.width.%]="(s.openBySeverity[sev]! / s.openVulnerabilities) * 100"></span>
                      }
                    }
                  </div>
                }
                <ul class="grid grid-cols-5 gap-2">
                  @for (sev of severities; track sev) {
                    <li>
                      <a routerLink="/vulnerabilities" [queryParams]="{ severity: sev }" class="rounded-xl bg-white/60 p-3 flex flex-col gap-2 items-start hover:bg-white/85">
                        <app-severity-badge [severity]="sev" />
                        <span class="text-2xl font-semibold">{{ s.openBySeverity[sev] ?? 0 }}</span>
                      </a>
                    </li>
                  }
                </ul>
                <h3 class="text-sm font-semibold mt-2">{{ 'dashboard.pipeline' | transloco }}</h3>
                <ol class="grid grid-cols-5 gap-2 text-sm">
                  @for (st of pipeline; track st) {
                    <li class="rounded-xl p-3" [class]="st === bottleneck() ? 'bg-warn-bg ring-1 ring-warn/30' : 'bg-white/60'">
                      <div class="text-xs text-ink-muted">{{ 'vulnStatus.' + st | transloco }}</div>
                      <div class="text-xl font-semibold">{{ s.byStatus[st] ?? 0 }}</div></li>
                  }
                </ol>
                @if (bottleneck(); as b) {
                  <p class="text-xs text-warn">{{ 'dashboard.bottleneck' | transloco: { status: ('vulnStatus.' + b | transloco), count: s.byStatus[b] } }}</p>
                }
              </section>

              <section class="glass col-span-12 lg:col-span-4 p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'dashboard.todo' | transloco }}</h2>
                <ul class="flex flex-col gap-2 text-sm">
                  <li class="flex justify-between rounded-xl bg-white/60 p-3"><span>{{ 'dashboard.unassigned' | transloco }}</span><b>{{ s.unassigned }}</b></li>
                  <li class="flex justify-between rounded-xl bg-white/60 p-3"><span>{{ 'dashboard.pendingVerification' | transloco }}</span><b>{{ s.byStatus.PendingVerification ?? 0 }}</b></li>
                  <li class="flex justify-between rounded-xl bg-white/60 p-3"><span>{{ 'dashboard.reappeared' | transloco }}</span><b class="text-warn">{{ s.reappeared }}</b></li>
                </ul>
                <h2 class="font-semibold mt-2">{{ 'dashboard.activeScans' | transloco }}</h2>
                @for (scan of active(); track scan.id) {
                  <a [routerLink]="['/scans', scan.id]" class="rounded-xl bg-white/60 p-3 flex flex-col gap-2 hover:bg-white/85">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-medium truncate">{{ scan.targetName }}</span>
                      <app-status-badge [status]="scan.status" />
                    </div>
                    <span class="mono truncate">{{ scan.targetBaseUrl }}</span>
                    <div class="h-1.5 rounded-full bg-black/10 overflow-hidden" role="progressbar" [attr.aria-valuenow]="scan.progressPercent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="scan.targetName">
                      <div class="h-full bg-ink" [style.width.%]="scan.progressPercent"></div>
                    </div>
                  </a>
                } @empty {
                  <p class="text-sm text-ink-muted">{{ 'dashboard.noActiveScans' | transloco }}</p>
                }
              </section>

              <section class="glass col-span-12">
                <div class="flex justify-between items-center px-5 pt-4 pb-2">
                  <h2 class="font-semibold">{{ 'dashboard.queue' | transloco }}</h2>
                  <a routerLink="/vulnerabilities" class="text-sm hover:underline">{{ 'dashboard.viewOpen' | transloco: { count: s.openVulnerabilities } }}</a>
                </div>
                <div class="overflow-x-auto">
                  <table class="table">
                    <thead><tr><th>{{ 'vulns.severity' | transloco }}</th><th>{{ 'vulns.issue' | transloco }}</th><th>{{ 'common.status' | transloco }}</th>
                      <th>{{ 'vulns.assignee' | transloco }}</th><th><span class="sr-only">{{ 'dashboard.action' | transloco }}</span></th></tr></thead>
                    <tbody>
                      @for (v of queue(); track v.id) {
                        <tr>
                          <td><app-severity-badge [severity]="v.severity" /></td>
                          <td class="min-w-[220px]"><span class="font-medium">{{ v.title }}</span><div class="mono">{{ v.projectName }} · {{ v.lastDetectedAt | date: 'dd/MM' }}</div></td>
                          <td><app-vuln-status-badge [status]="v.status" [reappeared]="v.isReappeared" /></td>
                          <td class="whitespace-nowrap">{{ v.assigneeName ?? ('vulns.unassigned' | transloco) }}</td>
                          <td class="text-right"><a [routerLink]="['/vulnerabilities', v.id]" class="btn h-8">{{ actionKey(v) | transloco }}</a></td>
                        </tr>
                      } @empty {
                        <tr><td colspan="5" class="text-center text-ink-muted">{{ 'dashboard.queueEmpty' | transloco }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="glass col-span-12">
                <div class="flex justify-between items-center px-5 pt-4 pb-2">
                  <h2 class="font-semibold">{{ 'dashboard.recentScans' | transloco }}</h2>
                  <a routerLink="/scans" class="text-sm hover:underline">{{ 'common.viewAll' | transloco }}</a>
                </div>
                <div class="overflow-x-auto">
                  <table class="table">
                    <thead><tr><th>{{ 'scans.target' | transloco }}</th><th>{{ 'common.status' | transloco }}</th>
                      <th>{{ 'scans.findings' | transloco }}</th><th>{{ 'common.createdDate' | transloco }}</th></tr></thead>
                    <tbody>
                      @for (scan of recent(); track scan.id) {
                        <tr>
                          <td><a [routerLink]="['/scans', scan.id]" class="font-medium hover:underline">{{ scan.targetName }}</a>
                            <div class="mono">{{ scan.targetBaseUrl }}</div></td>
                          <td><app-status-badge [status]="scan.status" /></td>
                          <td>{{ scan.totalFindings }}</td>
                          <td class="whitespace-nowrap">{{ scan.createdAt | date: 'dd/MM HH:mm' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
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

  protected readonly cards = [
    { key: 'projects', link: '/projects' }, { key: 'scans', link: '/scans' },
  ] as const;
  protected readonly pipeline = ['Open', 'Triaged', 'Assigned', 'InProgress', 'PendingVerification'] as const;
  protected readonly severities: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  protected readonly sevBar = SEV_BAR;
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly recent = signal<Scan[]>([]);
  protected readonly active = signal<Scan[]>([]);
  protected readonly queue = signal<Vulnerability[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly severityLabel = computed(() =>
    this.severities.map((s) => `${s}: ${this.summary()?.openBySeverity[s] ?? 0}`).join(', '),
  );
  /** "Why 72": weights match DashboardService.RiskWeights on the server. */
  protected readonly riskExplain = computed(() => {
    const o = this.summary()?.openBySeverity ?? {};
    return (['Critical', 'High', 'Medium', 'Low'] as const).filter((k) => o[k]).map((k) => `${o[k]}×${RISK_WEIGHTS[k]} ${k}`).join(' + ');
  });

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
      recent: this.scansApi.getAll({ pageSize: 5 }),
      running: this.scansApi.getAll({ pageSize: 3, status: 'Running' }),
      queued: this.scansApi.getAll({ pageSize: 3, status: 'Queued' }),
      queue: this.vulnApi.getAll({ isOpen: true, sortBy: 'severity', sortDirection: 'Desc', pageSize: 6 }),
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
