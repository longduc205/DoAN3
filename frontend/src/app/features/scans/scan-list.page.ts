import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { StatusBadge } from '../../shared/components/badges';
import { PageState, Pagination } from '../../shared/components/page-state';
import { PagingInfo, Scan, ScanStatus } from '../../shared/models/api.models';
import { ScansApi } from '../api.services';

@Component({
  selector: 'app-scan-list',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, Pagination, StatusBadge],
  template: `
    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="page-title">{{ 'nav.scans' | transloco }}</h1>
          <p class="mt-1 text-sm text-ink-muted">{{ 'scans.subtitle' | transloco: { count: paging()?.totalItems ?? 0 } }}</p>
        </div>
        @if (canScan) { <a routerLink="/scans/new" class="btn btn-primary h-10 rounded-[10px] font-semibold">{{ 'nav.newScan' | transloco }}</a> }
      </div>
      <div role="group" [attr.aria-label]="'common.status' | transloco" class="flex flex-wrap p-[3px] rounded-[10px] bg-black/[.04] self-start">
        @for (t of statusTabs; track t.key) {
          <button type="button" class="min-h-[34px] px-3 rounded-lg text-[13px] cursor-pointer" [attr.aria-pressed]="status() === t.value"
            [class]="status() === t.value ? 'bg-white font-semibold' : 'text-ink-muted hover:text-ink'" (click)="setStatus(t.value)">{{ t.key | transloco }}</button>
        }
      </div>
      <section class="rounded-2xl border border-line bg-white overflow-x-auto">
        <app-page-state [loading]="loading()" [error]="error()" [empty]="items().length === 0" emptyKey="dashboard.noScans" (retry)="load()">
          <table class="table">
            <thead>
              <tr><th>{{ 'scans.target' | transloco }}</th><th>{{ 'common.status' | transloco }}</th><th>{{ 'scans.progress' | transloco }}</th>
                <th>{{ 'scans.findings' | transloco }}</th><th>{{ 'common.createdDate' | transloco }}</th></tr>
            </thead>
            <tbody>
              @for (s of items(); track s.id) {
                <tr class="hover:bg-black/[.02]">
                  <td><a [routerLink]="['/scans', s.id]" class="font-medium hover:underline">{{ s.targetName }}</a><div class="mono">{{ s.targetBaseUrl }}</div></td>
                  <td><app-status-badge [status]="s.status" /></td>
                  <td>{{ s.progressPercent }}%</td>
                  <td>{{ s.totalFindings }}</td>
                  <td class="whitespace-nowrap">{{ s.createdAt | date: 'dd/MM HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
          <app-pagination [paging]="paging()" (pageChange)="load($event)" />
        </app-page-state>
      </section>
    </div>
  `,
})
export class ScanListPage implements OnInit {
  private readonly api = inject(ScansApi);
  /** Optional ?projectId= filter (bound from query params). */
  readonly projectId = input<string | undefined>(undefined);

  protected readonly canScan = inject(AuthService).hasPermission('Scan.Create');
  protected readonly statusTabs: { key: string; value: ScanStatus | undefined }[] = [
    { key: 'projects.tabAll', value: undefined }, { key: 'scanStatus.Running', value: 'Running' }, { key: 'scanStatus.Queued', value: 'Queued' },
    { key: 'scanStatus.Completed', value: 'Completed' }, { key: 'scanStatus.Failed', value: 'Failed' }, { key: 'scanStatus.Cancelled', value: 'Cancelled' },
  ];
  protected readonly status = signal<ScanStatus | undefined>(undefined);
  protected readonly items = signal<Scan[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected setStatus(s: ScanStatus | undefined): void {
    this.status.set(s);
    this.load(1);
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll({ page, pageSize: 20, projectId: this.projectId(), status: this.status() }).subscribe({
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
