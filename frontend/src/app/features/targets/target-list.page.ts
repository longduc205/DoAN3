import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { PageState, Pagination } from '../../shared/components/page-state';
import { PagingInfo, Target } from '../../shared/models/api.models';
import { TargetsApi } from '../api.services';
import { TargetTableComponent } from './target-table.component';

/** Read-only overview of all accessible targets; create/edit/scan happens inside a project. */
@Component({
  selector: 'app-target-list',
  imports: [TranslocoPipe, PageState, Pagination, TargetTableComponent],
  template: `
    <h1 class="page-title mb-1">{{ 'nav.targets' | transloco }}</h1>
    <p class="text-ink-muted text-sm mb-5">{{ 'targets.manageInProject' | transloco }}</p>
    <section class="glass">
      <app-page-state [loading]="loading()" [error]="error()" [empty]="items().length === 0" emptyKey="targets.empty" (retry)="load()">
        <app-target-table [targets]="items()" [showActions]="false" />
        <app-pagination [paging]="paging()" (pageChange)="load($event)" />
      </app-page-state>
    </section>
  `,
})
export class TargetListPage implements OnInit {
  private readonly api = inject(TargetsApi);
  protected readonly items = signal<Target[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll({ page, pageSize: 20 }).subscribe({
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
