import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScanStatus, Severity } from '../models/api.models';

const SEVERITY_CLASS: Record<Severity, string> = {
  Critical: 'text-white bg-sev-critical',
  High: 'text-white bg-sev-high',
  Medium: 'text-sev-medium bg-sev-medium-bg',
  Low: 'text-sev-low bg-sev-low-bg',
  Info: 'text-sev-info bg-sev-info-bg',
};

const STATUS_CLASS: Partial<Record<ScanStatus, string>> = {
  Queued: 'text-run bg-run-bg',
  Running: 'text-run bg-run-bg',
  Cancelling: 'text-warn bg-warn-bg',
  Completed: 'text-ok bg-ok-bg',
  Failed: 'text-danger bg-danger-bg',
};

/** Severity is shown as text + color, never color alone. */
@Component({
  selector: 'app-severity-badge',
  imports: [TranslocoPipe],
  template: `<span class="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" [class]="cls()">{{ 'severity.' + severity() | transloco }}</span>`,
})
export class SeverityBadge {
  readonly severity = input.required<Severity>();
  protected readonly cls = computed(() => SEVERITY_CLASS[this.severity()]);
}

@Component({
  selector: 'app-status-badge',
  imports: [TranslocoPipe],
  template: `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium" [class]="cls()">
    @if (status() === 'Running') { <span aria-hidden="true" class="size-1.5 rounded-full bg-current animate-pulse"></span> }
    {{ 'scanStatus.' + status() | transloco }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<ScanStatus>();
  protected readonly cls = computed(() => STATUS_CLASS[this.status()] ?? 'text-sev-info bg-sev-info-bg');
}
