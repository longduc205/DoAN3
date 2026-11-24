import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { switchMap, takeWhile, timer } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, StatusBadge } from '../../shared/components/badges';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { OccurrenceTag, Scan, ScanFinding, Severity } from '../../shared/models/api.models';
import { ScansApi } from '../api.services';

const POLL_MS = 1500;
type PhaseState = 'done' | 'now' | 'wait' | 'fail' | 'stop';
const PHASE_CLASS: Record<PhaseState, string> = {
  done: 'bg-ok-bg text-ok', now: 'bg-run-bg text-run', wait: 'bg-black/[.04] text-ink-muted',
  fail: 'bg-danger-bg text-danger', stop: 'bg-sev-info-bg text-sev-info',
};
const TAG_CLASS: Record<OccurrenceTag, string> = { New: 'text-run bg-run-bg', Known: 'text-ink', Reappeared: 'text-warn bg-warn-bg' };
type EventLevel = 'INFO' | 'RUN' | 'FIND' | 'OK' | 'FAIL' | 'STOP';
const EVENT_CLASS: Record<EventLevel, string> = { INFO: 'text-ink', RUN: 'text-ink', FIND: 'text-danger', OK: 'text-ok', FAIL: 'text-danger', STOP: 'text-sev-info' };
const SEV_CLASS: Record<Severity, string> = {
  Critical: 'bg-sev-critical-bg text-sev-critical-ink', High: 'bg-sev-high-bg text-sev-high-ink', Medium: 'bg-sev-medium-bg text-sev-medium',
  Low: 'bg-sev-low-bg text-sev-low', Info: 'bg-sev-info-bg text-sev-info',
};
// shortcut: phases are derived from progress % (mock engine reports 10/40/75/100); add a real phase field with a real engine.
const PHASES = [{ key: 'crawl', end: 40 }, { key: 'detect', end: 100 }, { key: 'analyze', end: 101 }] as const;

@Component({
  selector: 'app-scan-detail',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, StatusBadge, SeverityBadge, DialogComponent],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (scan(); as s) {
        <div class="flex flex-col gap-4">
          <section class="glass p-5 flex flex-col gap-4">
            <div class="flex flex-wrap items-start gap-4">
              <span class="grid place-items-center size-12 shrink-0 rounded-2xl bg-run-bg text-run" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12l6-6" /></svg>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="page-title">{{ 'scans.titleOn' | transloco: { target: s.targetName } }}</h1>
                  <app-status-badge [status]="s.status" />
                </div>
                <p class="mt-1 text-sm text-ink-muted break-all">
                  <span class="font-mono text-ink">{{ host() }}</span> · {{ s.scanType }}
                  @if (s.startedAt) { · {{ 'scans.startedAt' | transloco: { time: (s.startedAt | date: 'HH:mm dd/MM') } }} · {{ 'scans.elapsed' | transloco: { min: elapsedMin() } }} }
                  @else { · {{ 'scans.createdAt' | transloco: { time: (s.createdAt | date: 'HH:mm dd/MM') } }} }
                </p>
              </div>
              <div class="flex gap-2">
                @if (canScan && (s.status === 'Queued' || s.status === 'Running')) {
                  <button type="button" class="btn h-10 border-danger/40 text-danger hover:bg-danger-bg" (click)="cancelOpen.set(true)">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    {{ 'scans.cancel' | transloco }}</button>
                }
                @if (canScan && (s.status === 'Failed' || s.status === 'Cancelled')) {
                  <button type="button" class="btn btn-primary h-10" (click)="retry(s)">{{ 'scans.retry' | transloco }}</button>
                }
                @if (s.status === 'Completed' && canReport) {
                  <a routerLink="/reports" class="btn h-10">{{ 'reports.new' | transloco }}</a>
                }
              </div>
            </div>

            @switch (s.status) {
              @case ('Queued') { <div role="status" class="px-4 py-3 rounded-xl bg-run-bg text-run text-sm">{{ 'scans.bannerQueued' | transloco }}</div> }
              @case ('Cancelling') { <div role="status" class="px-4 py-3 rounded-xl bg-warn-bg text-warn text-sm">{{ 'scans.bannerCancelling' | transloco }}</div> }
              @case ('Cancelled') { <div role="status" class="px-4 py-3 rounded-xl bg-sev-info-bg text-sev-info text-sm">{{ 'scans.bannerCancelled' | transloco: { date: (s.completedAt | date: 'dd/MM HH:mm') } }}</div> }
              @case ('Failed') {
                <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">
                  <b class="font-semibold">{{ 'scans.bannerFailed' | transloco }}</b>
                  @if (s.errorMessageSafe) { <span class="font-mono"> {{ s.errorCode }}</span> · {{ s.errorMessageSafe }} }
                </div>
              }
            }

            <div class="flex items-center justify-between text-sm">
              <b class="font-semibold">
                @if (currentPhase(); as cp) { {{ 'scans.phaseOf' | transloco: { n: cp.n, phase: ('scans.phase_' + cp.key | transloco) } }} }
                @else { {{ 'scans.progress' | transloco }} }
              </b>
              <b class="font-semibold">{{ s.progressPercent }}%</b>
            </div>
            <div class="h-2 rounded-full bg-black/10 overflow-hidden" role="progressbar" [attr.aria-valuenow]="s.progressPercent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'scans.progress' | transloco">
              <div class="h-full rounded-full bg-ink transition-[width] duration-500" [style.width.%]="s.progressPercent"></div>
            </div>
            <ol class="grid md:grid-cols-3 gap-2.5">
              @for (ph of phases(); track ph.key; let i = $index) {
                <li class="rounded-xl px-3 py-2.5 flex items-center gap-2 text-[13px]" [class]="phaseClass[ph.state]">
                  <b class="font-semibold">{{ i + 1 }}</b>
                  <span class="flex-1 min-w-0 truncate"><span class="font-medium">{{ 'scans.phase_' + ph.key | transloco }}</span> · {{ 'scans.phaseDesc_' + ph.key | transloco }}</span>
                  <span>{{ 'scans.phaseState_' + ph.state | transloco }}</span>
                </li>
              }
            </ol>
            <dl class="grid grid-cols-3 gap-4 pt-4 border-t border-line">
              <div><dt class="text-[13px] text-ink-muted">{{ 'scans.urls' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalUrls }}</dd></div>
              <div><dt class="text-[13px] text-ink-muted">{{ 'scans.requests' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalRequests }}</dd></div>
              <div><dt class="text-[13px] text-ink-muted">{{ 'scans.findings' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalFindings }}</dd></div>
            </dl>
            @if (s.scanType === 'Mock') { <p class="mono">{{ 'scans.mockNotice' | transloco }}</p> }
          </section>

          <div class="grid lg:grid-cols-[2fr_1fr] gap-4 items-start">
            <section class="glass overflow-hidden">
              <div class="flex flex-col gap-3 px-5 pt-4 pb-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <h2 class="font-semibold">{{ 'scans.findingsOfScan' | transloco }}</h2>
                  <a routerLink="/vulnerabilities" [queryParams]="{ projectId: s.projectId }" class="text-sm font-medium underline underline-offset-4">{{ 'scans.openInVulns' | transloco }} →</a>
                </div>
                @if (findings().length > 0) {
                  <ul class="flex flex-wrap items-center gap-1.5 text-[13px]" [attr.aria-label]="'scans.findingSummary' | transloco">
                    @for (c of sevCounts(); track c.sev) {
                      <li class="px-2.5 py-0.5 rounded-full font-medium" [class]="sevClass[c.sev]">{{ 'severity.' + c.sev | transloco }} {{ c.count }}</li>
                    }
                    <li aria-hidden="true" class="mx-1 h-5 w-px bg-line"></li>
                    @for (t of tagCounts(); track t.tag) {
                      <li class="px-2.5 py-0.5 rounded-full font-medium" [class]="tagClass[t.tag]">{{ 'scans.tag_' + t.tag | transloco }} {{ t.count }}</li>
                    }
                  </ul>
                }
              </div>
              @if (findings().length === 0 && s.status === 'Completed') {
                <div class="mx-5 mb-5 p-5 rounded-2xl bg-ok-bg text-ok text-sm">{{ 'scans.bannerZero' | transloco }}</div>
              } @else {
                <ul>
                  @for (f of findings(); track f.id) {
                    <li class="flex items-center gap-3 px-5 py-3 border-t border-line">
                      <app-severity-badge [severity]="f.severity" />
                      <div class="flex-1 min-w-0">
                        @if (f.vulnerabilityId) {
                          <a [routerLink]="['/vulnerabilities', f.vulnerabilityId]" class="block font-medium truncate hover:underline">{{ f.title }} · <span class="font-mono text-[13px]">{{ path(f.url) }}</span></a>
                        } @else { <span class="block font-medium truncate">{{ f.title }} · <span class="font-mono text-[13px]">{{ path(f.url) }}</span></span> }
                        <span class="block text-[13px] text-ink-muted truncate">
                          {{ f.detectorName }} · {{ 'confidence.' + f.confidence | transloco }}
                          @if (f.vulnerabilityStatus) { · {{ 'vulnStatus.' + f.vulnerabilityStatus | transloco }} }
                        </span>
                      </div>
                      @if (f.occurrenceTag) { <span class="px-2 py-0.5 rounded-full text-xs font-medium" [class]="tagClass[f.occurrenceTag]">{{ 'scans.tag_' + f.occurrenceTag | transloco }}</span> }
                    </li>
                  } @empty {
                    <li class="px-5 py-6 border-t border-line text-sm text-center text-ink-muted">{{ 'scans.noFindings' | transloco }}</li>
                  }
                </ul>
              }
            </section>

            <section class="rounded-[20px] bg-white/45 p-5 flex flex-col gap-3">
              <div class="flex items-center justify-between gap-2">
                <h2 class="font-semibold">{{ 'scans.eventLog' | transloco }}</h2>
                @if (!terminal()) {
                  <span class="flex items-center gap-1.5 text-[13px] text-ink-muted"><span aria-hidden="true" class="size-1.5 rounded-full bg-ink animate-pulse"></span>{{ 'scans.autoRefresh' | transloco }}</span>
                }
              </div>
              <ol class="flex flex-col gap-1.5 font-mono text-[13px] leading-5" aria-live="polite">
                @for (e of events(); track $index) {
                  <li class="flex gap-3"><span class="text-ink-muted shrink-0">{{ e.at | date: 'HH:mm:ss' }}</span>
                    <span [class]="eventClass[e.level]">{{ e.key | transloco: e.params }}</span></li>
                }
              </ol>
            </section>
          </div>
        </div>

        <app-dialog [open]="cancelOpen()" [heading]="'scans.cancelTitle' | transloco" (closed)="cancelOpen.set(false)">
          <p class="text-sm">{{ 'scans.cancelBody' | transloco: { name: s.targetName } }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="cancelOpen.set(false)">{{ 'common.close' | transloco }}</button>
            <button type="button" class="btn btn-danger" (click)="cancel()">{{ 'scans.cancel' | transloco }}</button>
          </div>
        </app-dialog>
      }
    </app-page-state>
  `,
})
export class ScanDetailPage implements OnInit {
  private readonly scansApi = inject(ScansApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly canScan = this.auth.hasPermission('Scan.Create');
  protected readonly phaseClass = PHASE_CLASS;
  protected readonly cancelOpen = signal(false);
  protected readonly canReport = this.auth.hasPermission('Report.Generate');
  protected readonly tagClass = TAG_CLASS;
  protected readonly sevClass = SEV_CLASS;
  protected readonly sevCounts = computed(() => (['Critical', 'High', 'Medium', 'Low', 'Info'] as const)
    .map((sev) => ({ sev, count: this.findings().filter((f) => f.severity === sev).length })).filter((c) => c.count > 0));
  protected readonly terminal = computed(() => ['Completed', 'Failed', 'Cancelled'].includes(this.scan()?.status ?? ''));
  protected readonly host = computed(() => {
    try { return new URL(this.scan()?.targetBaseUrl ?? '').host; } catch { return this.scan()?.targetBaseUrl ?? ''; }
  });
  protected readonly currentPhase = computed(() => {
    const i = this.phases().findIndex((p) => p.state === 'now');
    return i < 0 ? null : { n: i + 1, key: this.phases()[i].key };
  });
  /** Minutes from start to end (or now while running); refreshed by each poll tick. */
  protected readonly elapsedMin = computed(() => {
    const s = this.scan();
    if (!s?.startedAt) return 0;
    const end = s.completedAt ? Date.parse(s.completedAt) : Date.now();
    return Math.max(0, Math.round((end - Date.parse(s.startedAt)) / 60000));
  });

  protected path(url: string): string {
    try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
  }
  protected readonly eventClass = EVENT_CLASS;
  protected readonly tagCounts = computed(() => (['New', 'Known', 'Reappeared'] as const)
    .map((tag) => ({ tag, count: this.findings().filter((f) => f.occurrenceTag === tag).length })).filter((t) => t.count > 0));
  // shortcut: the event log is rebuilt from scan timestamps + finding times (no scan_events table); store events with a real engine.
  protected readonly events = computed(() => {
    const s = this.scan();
    if (!s) return [];
    const list: { at: string; level: EventLevel; key: string; params?: Record<string, unknown> }[] = [{ at: s.createdAt, level: 'INFO', key: 'scans.evQueued' }];
    if (s.startedAt) list.push({ at: s.startedAt, level: 'RUN', key: 'scans.evStarted' });
    for (const f of this.findings()) list.push({ at: f.detectedAt, level: 'FIND', key: 'scans.evFinding', params: { title: f.title, severity: f.severity } });
    if (s.completedAt) {
      const end: Partial<Record<string, EventLevel>> = { Completed: 'OK', Failed: 'FAIL', Cancelled: 'STOP' };
      list.push({ at: s.completedAt, level: end[s.status] ?? 'INFO', key: 'scans.ev' + s.status, params: { count: s.totalFindings, error: s.errorCode ?? '' } });
    }
    return list.sort((a, b) => a.at.localeCompare(b.at));
  });

  readonly id = input.required<string>();
  protected readonly scan = signal<Scan | null>(null);
  protected readonly findings = signal<ScanFinding[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly phases = computed(() => {
    const s = this.scan();
    if (!s) return [];
    let start = 0;
    return PHASES.map((ph) => {
      const from = start;
      start = ph.end;
      const p = s.progressPercent;
      let state: PhaseState = 'wait';
      if (s.status === 'Completed' || p >= ph.end) state = 'done';
      else if (p >= from && (s.status === 'Running' || s.status === 'Cancelling')) state = 'now';
      else if (p >= from && s.status === 'Failed') state = 'fail';
      else if (p >= from && s.status === 'Cancelled') state = 'stop';
      return { key: ph.key, state };
    });
  });

  ngOnInit(): void {
    this.load();
  }

  /** Retry = a new scan on the same target (A5); the failed one stays as history. */
  protected retry(s: Scan): void {
    this.scansApi.create(s.targetId).subscribe({
      next: (res) => res.data && this.router.navigateByUrl(`/scans/${res.data.id}`).then(() => this.load()),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.scansApi.getById(this.id()).subscribe({
      next: (res) => {
        this.scan.set(res.data);
        this.loading.set(false);
        this.loadFindings();
        if (res.data && !['Completed', 'Failed', 'Cancelled'].includes(res.data.status)) this.poll();
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected cancel(): void {
    this.cancelOpen.set(false);
    this.scansApi.cancel(this.id()).subscribe({
      next: (res) => res.data && this.scan.set(res.data),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  /** Polls get-progress until the scan reaches a terminal state, then reloads details and findings. */
  private poll(): void {
    timer(POLL_MS, POLL_MS)
      .pipe(
        switchMap(() => this.scansApi.getProgress(this.id())),
        takeWhile((res) => !res.data?.isTerminal, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        const p = res.data;
        if (!p) return;
        this.scan.update((s) => (s ? { ...s, ...p } : s));
        if (p.totalFindings !== this.findings().length) this.loadFindings();
        if (p.isTerminal) this.scansApi.getById(this.id()).subscribe((r) => r.data && this.scan.set(r.data));
      });
  }

  private loadFindings(): void {
    this.scansApi.getFindings(this.id(), { pageSize: 100 }).subscribe({ next: (res) => this.findings.set(res.data ?? []) });
  }
}
