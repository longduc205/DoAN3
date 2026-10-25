import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Target } from '../../shared/models/api.models';

/** Presentational target table; the parent page owns data loading and actions. */
@Component({
  selector: 'app-target-table',
  imports: [TranslocoPipe, DatePipe],
  template: `
    <table class="table">
      <thead>
        <tr><th>{{ 'targets.name' | transloco }}</th><th>{{ 'targets.baseUrl' | transloco }}</th>
          <th>{{ 'targets.scope' | transloco }}</th><th>{{ 'targets.lastScan' | transloco }}</th><th></th></tr>
      </thead>
      <tbody>
        @for (t of targets(); track t.id) {
          <tr>
            <td class="font-medium">{{ t.name }}<div class="mono">{{ t.environment }}</div></td>
            <td class="mono break-all">{{ t.baseUrl }}</td>
            <td class="text-xs">
              <div>{{ (t.isEnabled ? 'targets.enabled' : 'targets.disabled') | transloco }}</div>
              <div [class.text-danger]="!t.isAuthorized">{{ (t.isAuthorized ? 'targets.authorized' : 'targets.notAuthorized') | transloco }}</div>
            </td>
            <td>{{ t.lastScanAt ? (t.lastScanAt | date: 'short') : '—' }}</td>
            <td class="text-right whitespace-nowrap">
              @if (showActions()) {
                <button type="button" class="btn btn-primary h-8" (click)="scan.emit(t)">{{ 'targets.startScan' | transloco }}</button>
                <button type="button" class="btn h-8 ml-1" (click)="edit.emit(t)">{{ 'common.edit' | transloco }}</button>
                <button type="button" class="btn btn-danger h-8 ml-1" (click)="remove.emit(t)">{{ 'common.delete' | transloco }}</button>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class TargetTableComponent {
  readonly targets = input.required<Target[]>();
  readonly showActions = input(true);
  readonly scan = output<Target>();
  readonly edit = output<Target>();
  readonly remove = output<Target>();
}
