import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, VulnStatusBadge } from '../../shared/components/badges';
import { PageState } from '../../shared/components/page-state';
import { ReportDetail, Severity } from '../../shared/models/api.models';
import { ReportsApi } from '../api.services';

const SEV_BAR: Record<Severity, string> = {
  Critical: 'bg-sev-critical', High: 'bg-sev-high', Medium: 'bg-sev-medium', Low: 'bg-sev-low', Info: 'bg-sev-info',
};

// W11 report preview. Everything here is SYSTEM DATA frozen at generation time; "PDF" = the browser print dialog
// (print styles in styles.css hide the app shell).
@Component({
  selector: 'app-report-detail',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, SeverityBadge, VulnStatusBadge],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (report(); as r) {
        @if (r.snapshot; as s) {
          <article class="flex flex-col gap-5 max-w-5xl">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="mono">{{ s.projectCode }} · {{ 'reportTemplate.' + r.template | transloco }}</p>
                <h1 class="page-title mt-1">{{ r.title }}</h1>
                <p class="text-sm text-ink-muted mt-1">{{ 'reports.generatedBy' | transloco: { date: (s.generatedAt | date: 'dd/MM/yyyy HH:mm'), name: r.createdByName } }}</p>
              </div>
              <div class="flex gap-2 no-print">
                <a routerLink="/reports" class="btn h-10">{{ 'nav.reports' | transloco }}</a>
                <button type="button" class="btn btn-primary h-10" (click)="print()">{{ 'reports.pdf' | transloco }}</button>
              </div>
            </div>

            <div class="rounded-md bg-white px-6 py-8 md:px-12 md:py-10 flex flex-col gap-8 shadow-[0_0_0_.5px_rgb(0_0_0/.1),0_24px_48px_-24px_rgb(10_12_20/.35)]">
            <section class="flex flex-col gap-4">
              <div class="flex items-center justify-between gap-2 pb-2 border-b border-line">
                <h2 class="font-semibold"><span class="text-ink-muted mr-2">1</span>{{ 'reports.summary' | transloco }}</h2>
                <span class="mono px-1.5 border border-line rounded">{{ 'reports.systemData' | transloco }}</span>
              </div>
              <dl class="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div class="rounded-xl bg-ink/[.03] p-3"><dt class="text-xs text-ink-muted">{{ 'dashboard.riskScore' | transloco }}</dt><dd class="text-2xl font-semibold">{{ s.riskScore }}/100</dd></div>
                <div class="rounded-xl bg-ink/[.03] p-3"><dt class="text-xs text-ink-muted">{{ 'dashboard.openVulns' | transloco }}</dt><dd class="text-2xl font-semibold">{{ s.openVulnerabilities }}</dd></div>
                <div class="rounded-xl bg-ink/[.03] p-3"><dt class="text-xs text-ink-muted">{{ 'nav.targets' | transloco }}</dt><dd class="text-2xl font-semibold">{{ s.targets }}</dd></div>
                <div class="rounded-xl bg-ink/[.03] p-3"><dt class="text-xs text-ink-muted">{{ 'nav.scans' | transloco }}</dt><dd class="text-2xl font-semibold">{{ s.scans }}</dd></div>
                <div class="rounded-xl bg-ink/[.03] p-3"><dt class="text-xs text-ink-muted">{{ 'projects.lastScanLabel' | transloco }}</dt><dd class="font-semibold">{{ s.lastScanAt ? (s.lastScanAt | date: 'dd/MM/yyyy') : '—' }}</dd></div>
              </dl>
              @if (s.openVulnerabilities > 0) {
                <div class="flex h-3 rounded-full overflow-hidden bg-black/5" role="img" [attr.aria-label]="'dashboard.bySeverity' | transloco">
                  @for (sev of severities; track sev) {
                    @if (s.openBySeverity[sev]) { <span [class]="sevBar[sev]" [style.width.%]="(s.openBySeverity[sev]! / s.openVulnerabilities) * 100"></span> }
                  }
                </div>
              }
              <ul class="grid grid-cols-5 gap-2">
                @for (sev of severities; track sev) {
                  <li class="rounded-xl bg-ink/[.03] p-3 flex flex-col gap-1 items-start"><app-severity-badge [severity]="sev" /><span class="text-xl font-semibold">{{ s.openBySeverity[sev] ?? 0 }}</span></li>
                }
              </ul>
            </section>

            <section class="overflow-x-auto">
              <div class="flex items-center justify-between gap-2 pb-2 border-b border-line">
                <h2 class="font-semibold"><span class="text-ink-muted mr-2">2</span>{{ (r.template === 'Executive' ? 'reports.topOpen' : 'reports.allVulns') | transloco }}</h2>
                <span class="mono px-1.5 border border-line rounded">{{ 'reports.systemData' | transloco }}</span>
              </div>
              <table class="table">
                <thead><tr><th>{{ 'vulns.issue' | transloco }}</th><th>{{ 'vulns.severity' | transloco }}</th><th>{{ 'common.status' | transloco }}</th>
                  <th>{{ 'scans.target' | transloco }}</th><th>{{ 'vulns.assignee' | transloco }}</th><th>{{ 'vulns.firstSeen' | transloco }}</th></tr></thead>
                <tbody>
                  @for (v of s.vulnerabilities; track $index) {
                    <tr>
                      <td>{{ v.title }}<div class="mono break-all">{{ v.url }}</div></td>
                      <td><app-severity-badge [severity]="v.severity" /></td>
                      <td><app-vuln-status-badge [status]="v.status" /></td>
                      <td>{{ v.targetName }}</td>
                      <td>{{ v.assigneeName ?? ('vulns.unassigned' | transloco) }}</td>
                      <td class="whitespace-nowrap">{{ v.firstDetectedAt | date: 'dd/MM/yyyy' }}</td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="text-center text-ink-muted">{{ 'reports.noVulns' | transloco }}</td></tr>
                  }
                </tbody>
              </table>
            </section>
            <p class="pt-4 border-t border-line text-xs text-ink-muted">{{ 'reports.footer' | transloco }}</p>
            </div>
          </article>
        } @else {
          <div role="alert" class="glass p-6 text-danger">{{ r.errorSafe ?? ('reportStatus.' + r.status | transloco) }}</div>
        }
      }
    </app-page-state>
  `,
})
export class ReportDetailPage implements OnInit {
  private readonly api = inject(ReportsApi);
  protected readonly severities: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  protected readonly sevBar = SEV_BAR;

  readonly id = input.required<string>();
  protected readonly report = signal<ReportDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getById(this.id()).subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected print(): void {
    window.print();
  }
}
