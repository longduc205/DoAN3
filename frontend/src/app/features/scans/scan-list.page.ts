import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { StatusBadge } from '../../shared/components/badges';
import { PageState, Pagination } from '../../shared/components/page-state';
import { PagingInfo, Scan } from '../../shared/models/api.models';
import { ScansApi } from '../api.services';

@Component({
  selector: 'app-scan-list',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, Pagination, StatusBadge],
  template: `
    <h1 class="page-title mb-1">{{ 'nav.scans' | transloco }}</h1>
    <p class="text-ink-muted text-sm mb-5">{{ 'scans.startFromProject' | transloco }}</p>
    <section class="glass">
      <app-page-state [loading]="loading()" [error]="error()" [empty]="items().length === 0" emptyKey="dashboard.noScans" (retry)="load()">
        <table class="table">
          <thead>
            <tr><th>{{ 'scans.target' | transloco }}</th><th>{{ 'common.status' | transloco }}</th><th>{{ 'scans.progress' | transloco }}</th>
              <th>{{ 'scans.findings' | transloco }}</th><th>{{ 'common.createdDate' | transloco }}</th></tr>
          </thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr>
                <td><a [routerLink]="['/scans', s.id]" class="font-medium hover:underline">{{ s.targetName }}</a><div class="mono">{{ s.targetBaseUrl }}</div></td>
                <td><app-status-badge [status]="s.status" /></td>
                <td>{{ s.progressPercent }}%</td>
                <td>{{ s.totalFindings }}</td>
                <td>{{ s.createdAt | date: 'short' }}</td>
              </tr>
            }
          </tbody>
        </table>
        <app-pagination [paging]="paging()" (pageChange)="load($event)" />
      </app-page-state>
    </section>
  `,
})
export class ScanListPage implements OnInit {
  private readonly api = inject(ScansApi);
  /** Optional ?projectId= filter (bound from query params). */
  readonly projectId = input<string | undefined>(undefined);

  protected readonly items = signal<Scan[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll({ page, pageSize: 20, projectId: this.projectId() }).subscribe({
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
