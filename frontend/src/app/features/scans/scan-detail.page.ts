import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { switchMap, takeWhile, timer } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, StatusBadge } from '../../shared/components/badges';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { AiAdvice, Scan, ScanFinding } from '../../shared/models/api.models';
import { AiApi, ScansApi } from '../api.services';

const POLL_MS = 1500;
type PhaseState = 'done' | 'now' | 'wait' | 'fail' | 'stop';
const PHASE_CLASS: Record<PhaseState, string> = {
  done: 'bg-ok-bg text-ok', now: 'bg-run-bg text-run', wait: 'bg-black/[.04] text-ink-muted',
  fail: 'bg-danger-bg text-danger', stop: 'bg-sev-info-bg text-sev-info',
};
// shortcut: phases are derived from progress % (mock engine reports 10/40/75/100); add a real phase field with a real engine.
const PHASES = [{ key: 'crawl', end: 40 }, { key: 'detect', end: 100 }, { key: 'analyze', end: 101 }] as const;

@Component({
  selector: 'app-scan-detail',
  imports: [TranslocoPipe, DatePipe, PageState, StatusBadge, SeverityBadge, DialogComponent],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (scan(); as s) {
        <div class="flex flex-col gap-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="page-title">{{ s.targetName }}</h1>
                <app-status-badge [status]="s.status" />
              </div>
              <p class="mono mt-1 break-all">{{ s.targetBaseUrl }} · {{ s.scanType }} · {{ s.createdAt | date: 'dd/MM/yyyy HH:mm' }}</p>
            </div>
            @if (canScan) {
              <div class="flex gap-2">
                @if (s.status === 'Queued' || s.status === 'Running') {
                  <button type="button" class="btn btn-danger h-10" (click)="cancelOpen.set(true)">{{ 'scans.cancel' | transloco }}</button>
                }
                @if (s.status === 'Failed' || s.status === 'Cancelled') {
                  <button type="button" class="btn btn-primary h-10" (click)="retry(s)">{{ 'scans.retry' | transloco }}</button>
                }
              </div>
            }
          </div>

          @switch (s.status) {
            @case ('Queued') { <div role="status" class="px-4 py-3 rounded-xl bg-run-bg text-run text-sm">{{ 'scans.bannerQueued' | transloco }}</div> }
            @case ('Cancelling') { <div role="status" class="px-4 py-3 rounded-xl bg-warn-bg text-warn text-sm">{{ 'scans.bannerCancelling' | transloco }}</div> }
            @case ('Cancelled') { <div role="status" class="px-4 py-3 rounded-xl bg-sev-info-bg text-sev-info text-sm">{{ 'scans.bannerCancelled' | transloco: { date: (s.completedAt | date: 'dd/MM HH:mm') } }}</div> }
            @case ('Failed') {
              <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">
                <b class="font-semibold">{{ 'scans.bannerFailed' | transloco }}</b>
                @if (s.errorMessageSafe) { <span class="mono text-danger"> {{ s.errorCode }}</span> · {{ s.errorMessageSafe }} }
              </div>
            }
            @case ('Completed') {
              @if (s.totalFindings === 0) { <div role="status" class="px-4 py-3 rounded-xl bg-ok-bg text-ok text-sm">{{ 'scans.bannerZero' | transloco }}</div> }
            }
          }

          <section class="glass p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <h2 class="font-semibold">{{ 'scans.progress' | transloco }}</h2>
              <span class="mono">{{ s.progressPercent }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-black/10 overflow-hidden" role="progressbar" [attr.aria-valuenow]="s.progressPercent" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'scans.progress' | transloco">
              <div class="h-full bg-ink transition-[width] duration-500" [style.width.%]="s.progressPercent"></div>
            </div>
            <ol class="grid md:grid-cols-3 gap-3">
              @for (ph of phases(); track ph.key) {
                <li class="rounded-xl p-3 flex items-center gap-2 text-sm" [class]="phaseClass[ph.state]">
                  <span class="mono text-inherit">{{ 'scans.phaseState_' + ph.state | transloco }}</span>
                  <span class="font-medium">{{ 'scans.phase_' + ph.key | transloco }}</span>
                </li>
              }
            </ol>
            <dl class="grid grid-cols-3 gap-4 text-sm">
              <div><dt class="text-ink-muted">{{ 'scans.urls' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalUrls }}</dd></div>
              <div><dt class="text-ink-muted">{{ 'scans.requests' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalRequests }}</dd></div>
              <div><dt class="text-ink-muted">{{ 'scans.findings' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalFindings }}</dd></div>
            </dl>
            @if (s.scanType === 'Mock') { <p class="mono">{{ 'scans.mockNotice' | transloco }}</p> }
          </section>

          <section class="glass">
            <h2 class="font-semibold px-5 pt-4 pb-2">{{ 'scans.findings' | transloco }}</h2>
            <app-page-state [empty]="findings().length === 0" emptyKey="scans.noFindings">
              <ul>
                @for (f of findings(); track f.id) {
                  <li class="px-5 py-4 border-t border-line">
                    <div class="flex flex-wrap items-start gap-3">
                      <app-severity-badge [severity]="f.severity" />
                      <div class="flex-1 min-w-0">
                        <div class="font-medium">{{ f.title }}</div>
                        <div class="mono break-all">{{ f.url }} · {{ f.detectorName }} · {{ 'confidence.' + f.confidence | transloco }}</div>
                        <p class="text-sm text-ink-muted mt-1">{{ f.evidenceSummary }}</p>
                      </div>
                      @if (canAi) {
                        <div class="flex gap-1">
                          <button type="button" class="btn h-8" (click)="askAi(f, 'explain')">{{ 'ai.explain' | transloco }}</button>
                          <button type="button" class="btn h-8" (click)="askAi(f, 'remediate')">{{ 'ai.remediate' | transloco }}</button>
                        </div>
                      }
                    </div>
                    @if (ai()[f.id]; as a) {
                      <div class="mt-3 rounded-xl bg-sev-info-bg border border-line p-4" aria-live="polite">
                        <div class="mono mb-2">{{ 'ai.advisoryLabel' | transloco }}</div>
                        @if (a.loading) {
                          <p class="text-sm text-ink-muted">{{ 'common.loading' | transloco }}</p>
                        } @else if (a.error) {
                          <p class="text-sm text-danger">{{ a.error | transloco }}</p>
                        } @else if (a.advice) {
                          <p class="text-sm whitespace-pre-line">{{ a.advice.content }}</p>
                          <p class="mono mt-2">{{ a.advice.provider }} · {{ a.advice.model }}</p>
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
            </app-page-state>
          </section>
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
  private readonly aiApi = inject(AiApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  protected readonly canScan = this.auth.hasPermission('Scan.Create');
  protected readonly canAi = this.auth.hasPermission('AI.Ask');
  protected readonly phaseClass = PHASE_CLASS;
  protected readonly cancelOpen = signal(false);

  readonly id = input.required<string>();
  protected readonly scan = signal<Scan | null>(null);
  protected readonly findings = signal<ScanFinding[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ai = signal<Record<string, { loading: boolean; advice?: AiAdvice; error?: string }>>({});

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

  protected askAi(f: ScanFinding, kind: 'explain' | 'remediate'): void {
    this.ai.update((m) => ({ ...m, [f.id]: { loading: true } }));
    const req = kind === 'explain' ? this.aiApi.explain({ findingId: f.id }) : this.aiApi.suggestRemediation({ findingId: f.id });
    req.subscribe({
      next: (res) => this.ai.update((m) => ({ ...m, [f.id]: { loading: false, advice: res.data ?? undefined } })),
      error: (err) => this.ai.update((m) => ({ ...m, [f.id]: { loading: false, error: apiErrorMessage(err) } })),
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
