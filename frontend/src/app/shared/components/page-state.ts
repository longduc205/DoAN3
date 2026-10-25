import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PagingInfo } from '../models/api.models';

/** Loading / error / empty states for any data-driven block. Renders projected content otherwise. */
@Component({
  selector: 'app-page-state',
  imports: [TranslocoPipe],
  template: `
    @if (loading()) {
      <div class="p-8 text-center text-ink-muted" role="status">{{ 'common.loading' | transloco }}</div>
    } @else if (error()) {
      <div class="p-6 text-center" role="alert">
        <p class="text-danger mb-3">{{ error()! | transloco }}</p>
        <button type="button" class="btn" (click)="retry.emit()">{{ 'common.retry' | transloco }}</button>
      </div>
    } @else if (empty()) {
      <div class="p-8 text-center text-ink-muted">{{ emptyKey() | transloco }}</div>
    } @else {
      <ng-content />
    }
  `,
})
export class PageState {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly empty = input(false);
  readonly emptyKey = input('common.empty');
  readonly retry = output<void>();
}

@Component({
  selector: 'app-pagination',
  imports: [TranslocoPipe],
  template: `
    @if (paging(); as p) {
      @if (p.totalPages > 1) {
        <nav class="flex items-center justify-end gap-2 p-3 text-sm" [attr.aria-label]="'common.pagination' | transloco">
          <button type="button" class="btn h-8" [disabled]="p.page <= 1" (click)="pageChange.emit(p.page - 1)">{{ 'common.prev' | transloco }}</button>
          <span class="mono">{{ p.page }} / {{ p.totalPages }}</span>
          <button type="button" class="btn h-8" [disabled]="p.page >= p.totalPages" (click)="pageChange.emit(p.page + 1)">{{ 'common.next' | transloco }}</button>
        </nav>
      }
    }
  `,
})
export class Pagination {
  readonly paging = input<PagingInfo | null>(null);
  readonly pageChange = output<number>();
}
