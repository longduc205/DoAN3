import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { switchMap, takeWhile, timer } from 'rxjs';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, StatusBadge } from '../../shared/components/badges';
import { PageState } from '../../shared/components/page-state';
import { AiAdvice, Scan, ScanFinding } from '../../shared/models/api.models';
import { AiApi, ScansApi } from '../api.services';

const POLL_MS = 1500;

@Component({
  selector: 'app-scan-detail',
  imports: [RouterLink, TranslocoPipe, DatePipe, PageState, StatusBadge, SeverityBadge],
  template: `
    <nav class="text-sm text-ink-muted mb-2"><a routerLink="/scans" class="hover:underline">{{ 'nav.scans' | transloco }}</a> /</nav>
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (scan(); as s) {
        <div class="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 class="page-title">{{ s.targetName }}</h1>
            <p class="mono mt-1">{{ s.targetBaseUrl }} · {{ s.scanType }} · {{ s.createdAt | date: 'medium' }}</p>
          </div>
          @if (s.status === 'Queued' || s.status === 'Running') {
            <button type="button" class="btn btn-danger" (click)="cancel()">{{ 'scans.cancel' | transloco }}</button>
          }
        </div>

        <section class="glass p-5 mb-4">
          <div class="flex items-center justify-between mb-3">
            <app-status-badge [status]="s.status" />
            <span class="mono">{{ s.progressPercent }}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-black/10 overflow-hidden" role="progressbar" [attr.aria-valuenow]="s.progressPercent" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full bg-ink transition-[width] duration-500" [style.width.%]="s.progressPercent"></div>
          </div>
          <dl class="grid grid-cols-3 gap-4 mt-4 text-sm">
            <div><dt class="text-ink-muted">{{ 'scans.urls' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalUrls }}</dd></div>
            <div><dt class="text-ink-muted">{{ 'scans.requests' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalRequests }}</dd></div>
            <div><dt class="text-ink-muted">{{ 'scans.findings' | transloco }}</dt><dd class="text-xl font-semibold">{{ s.totalFindings }}</dd></div>
          </dl>
          @if (s.errorMessageSafe) {
            <p role="alert" class="mt-3 text-sm text-danger">{{ s.errorCode }}: {{ s.errorMessageSafe }}</p>
          }
          @if (s.scanType === 'Mock') {
            <p class="mt-3 mono">{{ 'scans.mockNotice' | transloco }}</p>
          }
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
                    <div class="flex gap-1">
                      <button type="button" class="btn h-8" (click)="askAi(f, 'explain')">{{ 'ai.explain' | transloco }}</button>
                      <button type="button" class="btn h-8" (click)="askAi(f, 'remediate')">{{ 'ai.remediate' | transloco }}</button>
                    </div>
                  </div>
                  @if (ai()[f.id]; as a) {
                    <div class="mt-3 rounded-xl bg-white/80 border border-line p-4" aria-live="polite">
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
      }
    </app-page-state>
  `,
})
export class ScanDetailPage implements OnInit {
  private readonly scansApi = inject(ScansApi);
  private readonly aiApi = inject(AiApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  protected readonly scan = signal<Scan | null>(null);
  protected readonly findings = signal<ScanFinding[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly ai = signal<Record<string, { loading: boolean; advice?: AiAdvice; error?: string }>>({});

  ngOnInit(): void {
    this.load();
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
    this.scansApi.cancel(this.id()).subscribe({
      next: (res) => res.data && this.scan.set(res.data),
      error: (err) => this.error.set(apiErrorMessage(err)),
    });
  }

  protected askAi(f: ScanFinding, kind: 'explain' | 'remediate'): void {
    this.ai.update((m) => ({ ...m, [f.id]: { loading: true } }));
    const req = kind === 'explain' ? this.aiApi.explain(f.id) : this.aiApi.suggestRemediation(f.id);
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
