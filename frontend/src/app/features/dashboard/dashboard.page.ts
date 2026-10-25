import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, StatusBadge } from '../../shared/components/badges';
import { PageState } from '../../shared/components/page-state';
import { DashboardSummary, Scan, Severity } from '../../shared/models/api.models';
import { DashboardApi, ScansApi } from '../api.services';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TranslocoPipe, PageState, SeverityBadge, StatusBadge],
  template: `
    <div class="flex items-end justify-between gap-4 mb-5">
      <h1 class="page-title">{{ 'dashboard.title' | transloco }}</h1>
      <a routerLink="/projects" class="btn btn-primary">{{ 'dashboard.newScan' | transloco }}</a>
    </div>

    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (summary(); as s) {
        <section class="glass grid grid-cols-2 md:grid-cols-4 divide-x divide-line mb-4">
          @for (card of cards; track card.key) {
            <div class="p-5">
              <div class="text-sm text-ink-muted">{{ 'dashboard.' + card.key | transloco }}</div>
              <div class="text-3xl font-semibold mt-1">{{ s[card.key] }}</div>
            </div>
          }
        </section>

        <div class="grid md:grid-cols-[1fr_340px] gap-4">
          <section class="glass">
            <div class="flex justify-between items-center px-5 pt-4 pb-2">
              <h2 class="font-semibold">{{ 'dashboard.recentScans' | transloco }}</h2>
              <a routerLink="/scans" class="text-sm hover:underline">{{ 'common.viewAll' | transloco }}</a>
            </div>
            <app-page-state [empty]="recent().length === 0" emptyKey="dashboard.noScans">
              <table class="table">
                <tbody>
                  @for (scan of recent(); track scan.id) {
                    <tr>
                      <td><a [routerLink]="['/scans', scan.id]" class="font-medium hover:underline">{{ scan.targetName }}</a>
                        <div class="mono">{{ scan.targetBaseUrl }}</div></td>
                      <td><app-status-badge [status]="scan.status" /></td>
                      <td class="text-right">{{ scan.totalFindings }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </app-page-state>
          </section>

          <section class="glass p-5">
            <h2 class="font-semibold mb-3">{{ 'dashboard.bySeverity' | transloco }}</h2>
            <ul class="flex flex-col gap-2">
              @for (sev of severities; track sev) {
                <li class="flex items-center justify-between">
                  <app-severity-badge [severity]="sev" />
                  <span class="font-medium">{{ s.findingsBySeverity[sev] ?? 0 }}</span>
                </li>
              }
            </ul>
          </section>
        </div>
      }
    </app-page-state>
  `,
})
export class DashboardPage implements OnInit {
  private readonly dashboardApi = inject(DashboardApi);
  private readonly scansApi = inject(ScansApi);

  protected readonly cards = [{ key: 'projects' }, { key: 'targets' }, { key: 'scans' }, { key: 'findings' }] as const;
  protected readonly severities: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly recent = signal<Scan[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.dashboardApi.getSummary().subscribe({
      next: (res) => {
        this.summary.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
    this.scansApi.getAll({ pageSize: 5 }).subscribe({ next: (res) => this.recent.set(res.data ?? []) });
  }
}
