import { Component, computed, input, output } from '@angular/core';
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
      @if (p.totalItems > 0) {
        <nav class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm" [attr.aria-label]="'common.pagination' | transloco">
          <span class="mono">{{ (p.page - 1) * p.pageSize + 1 }}–{{ min(p.page * p.pageSize, p.totalItems) }} / {{ p.totalItems }}</span>
          @if (p.totalPages > 1) {
            <span class="flex items-center gap-1">
              <button type="button" class="btn h-8 px-2" [disabled]="p.page <= 1" (click)="pageChange.emit(p.page - 1)" [attr.aria-label]="'common.prev' | transloco">‹</button>
              @for (n of pages(); track $index) {
                @if (n === 0) { <span class="px-1 text-ink-muted" aria-hidden="true">…</span> }
                @else {
                  <button type="button" class="btn h-8 min-w-8 px-2" [class.bg-ink]="n === p.page" [class.text-white]="n === p.page"
                    [attr.aria-current]="n === p.page ? 'page' : null" (click)="pageChange.emit(n)">{{ n }}</button>
                }
              }
              <button type="button" class="btn h-8 px-2" [disabled]="p.page >= p.totalPages" (click)="pageChange.emit(p.page + 1)" [attr.aria-label]="'common.next' | transloco">›</button>
            </span>
          }
        </nav>
      }
    }
  `,
})
export class Pagination {
  readonly paging = input<PagingInfo | null>(null);
  readonly pageChange = output<number>();
  protected readonly min = Math.min;
  /** First, last and the current page ±1; 0 marks a gap. */
  protected readonly pages = computed(() => {
    const p = this.paging();
    if (!p) return [];
    const keep = new Set([1, p.totalPages, p.page - 1, p.page, p.page + 1].filter((n) => n >= 1 && n <= p.totalPages));
    const sorted = [...keep].sort((a, b) => a - b);
    return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [0, n] : [n]));
  });
}
