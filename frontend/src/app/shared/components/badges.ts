import { Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScanStatus, Severity } from '../models/api.models';

const SEVERITY_CLASS: Record<Severity, string> = {
  Critical: 'text-sev-critical bg-sev-critical/10',
  High: 'text-sev-high bg-sev-high/10',
  Medium: 'text-sev-medium bg-sev-medium/10',
  Low: 'text-sev-low bg-sev-low/10',
  Info: 'text-sev-info bg-sev-info/10',
};

const STATUS_CLASS: Partial<Record<ScanStatus, string>> = {
  Running: 'text-run bg-run/10',
  Cancelling: 'text-run bg-run/10',
  Completed: 'text-ok bg-ok/10',
  Failed: 'text-danger bg-danger/10',
};

/** Severity is shown as text + color, never color alone. */
@Component({
  selector: 'app-severity-badge',
  imports: [TranslocoPipe],
  template: `<span class="inline-block px-2 py-0.5 rounded-md text-xs font-medium" [class]="cls()">{{ 'severity.' + severity() | transloco }}</span>`,
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
  protected readonly cls = computed(() => STATUS_CLASS[this.status()] ?? 'text-ink-muted bg-black/5');
}
