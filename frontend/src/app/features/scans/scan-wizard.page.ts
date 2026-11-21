import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { Target } from '../../shared/models/api.models';
import { ScansApi, TargetsApi } from '../api.services';

type Step = 0 | 1 | 2;

// W06 New scan wizard: target → scope → review, then a retype-the-host confirmation.
// shortcut: no checks/limits/draft steps; the mock engine takes no scan config yet. Add them with the first real engine.
@Component({
  selector: 'app-scan-wizard',
  imports: [RouterLink, FormsModule, TranslocoPipe, PageState, DialogComponent],
  template: `
    <div class="flex flex-col gap-5 max-w-3xl">
      <div>
        <h1 class="page-title">{{ 'wizard.title' | transloco }}</h1>
        <p class="mt-1 text-sm text-ink-muted">{{ 'wizard.subtitle' | transloco }}</p>
      </div>

      <ol class="flex flex-wrap gap-2" [attr.aria-label]="'wizard.steps' | transloco">
        @for (key of stepKeys; track key; let i = $index) {
          <li class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" [attr.aria-current]="step() === i ? 'step' : null"
            [class]="step() === i ? 'bg-ink text-white font-semibold' : i < step() ? 'bg-ok-bg text-ok' : 'bg-black/5 text-ink-muted'">
            <span class="mono text-inherit">{{ i + 1 }}</span>{{ key | transloco }}
          </li>
        }
      </ol>

      <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
        <section class="glass p-6 flex flex-col gap-4">
          @switch (step()) {
            @case (0) {
              <fieldset class="flex flex-col gap-2">
                <legend class="font-semibold mb-2">{{ 'wizard.pickTarget' | transloco }}</legend>
                @for (t of targets(); track t.id) {
                  <label class="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"
                    [class]="t.isAuthorized && t.isEnabled ? 'bg-white/70 border-line' : 'bg-black/[.03] border-transparent text-ink-muted cursor-not-allowed'">
                    <input type="radio" name="target" class="mt-1" [value]="t.id" [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)"
                      [disabled]="!t.isAuthorized || !t.isEnabled" />
                    <span class="min-w-0 flex-1">
                      <span class="font-medium">{{ t.name }}</span>
                      <span class="mono block break-all">{{ t.baseUrl }}</span>
                    </span>
                    @if (!t.isAuthorized) { <span class="px-2 py-0.5 rounded-md text-xs font-semibold text-warn bg-warn-bg">{{ 'targets.notAuthorized' | transloco }}</span> }
                    @else if (!t.isEnabled) { <span class="px-2 py-0.5 rounded-md text-xs text-sev-info bg-sev-info-bg">{{ 'targets.disabled' | transloco }}</span> }
                  </label>
                } @empty {
                  <p class="text-sm text-ink-muted">{{ 'targets.empty' | transloco }} <a routerLink="/projects" class="underline">{{ 'nav.projects' | transloco }}</a></p>
                }
              </fieldset>
            }
            @case (1) {
              @if (selected(); as t) {
                <h2 class="font-semibold">{{ 'wizard.scope' | transloco }}</h2>
                <dl class="grid md:grid-cols-2 gap-3 text-sm">
                  <div class="rounded-xl bg-white/70 p-3"><dt class="text-ink-muted text-xs">{{ 'targets.baseUrl' | transloco }}</dt><dd class="mono text-ink break-all">{{ t.baseUrl }}</dd></div>
                  <div class="rounded-xl bg-white/70 p-3"><dt class="text-ink-muted text-xs">{{ 'targets.scopeMode' | transloco }}</dt><dd>{{ 'scopeMode.' + t.scopeMode | transloco }}</dd></div>
                  <div class="rounded-xl bg-white/70 p-3"><dt class="text-ink-muted text-xs">{{ 'targets.environment' | transloco }}</dt><dd>{{ 'environment.' + t.environment | transloco }}</dd></div>
                  <div class="rounded-xl bg-white/70 p-3"><dt class="text-ink-muted text-xs">{{ 'wizard.engine' | transloco }}</dt><dd>{{ 'wizard.engineMock' | transloco }}</dd></div>
                </dl>
                <p class="text-xs text-ink-muted">{{ 'targets.safetyNote' | transloco }}</p>
              }
            }
            @case (2) {
              @if (selected(); as t) {
                <h2 class="font-semibold">{{ 'wizard.review' | transloco }}</h2>
                <ul class="flex flex-wrap gap-2 text-sm">
                  <li class="px-3 py-1.5 rounded-full bg-white/70 border border-line">{{ t.name }}</li>
                  <li class="px-3 py-1.5 rounded-full bg-white/70 border border-line mono text-ink">{{ host() }}</li>
                  <li class="px-3 py-1.5 rounded-full bg-white/70 border border-line">{{ 'scopeMode.' + t.scopeMode | transloco }}</li>
                </ul>
                <p class="text-sm">{{ 'wizard.queueInfo' | transloco: { count: queued() } }}</p>
                <p class="text-sm text-ink-muted">{{ 'scans.mockNotice' | transloco }}</p>
              }
            }
          }

          @if (submitError()) {
            <div role="alert" class="px-3 py-2 rounded-xl bg-danger-bg text-danger text-sm">{{ submitError()! | transloco }}</div>
          }
          <div class="flex justify-between gap-2 pt-2 border-t border-line">
            <button type="button" class="btn" [disabled]="step() === 0" (click)="step.set(prev())">{{ 'wizard.back' | transloco }}</button>
            @if (step() < 2) {
              <button type="button" class="btn btn-primary" [disabled]="!selected()" (click)="step.set(next())">{{ 'wizard.next' | transloco }}</button>
            } @else {
              <button type="button" class="btn btn-primary" (click)="confirmOpen.set(true)">{{ 'wizard.start' | transloco }}</button>
            }
          </div>
        </section>
      </app-page-state>

      <app-dialog [open]="confirmOpen()" [heading]="'wizard.confirmTitle' | transloco" (closed)="closeConfirm()">
        <p class="text-sm">{{ 'wizard.confirmBody' | transloco: { host: host() } }}</p>
        <label class="label" for="confirm-host">{{ 'wizard.typeHost' | transloco }}</label>
        <input id="confirm-host" class="input font-mono" autocomplete="off" [ngModel]="typedHost()" (ngModelChange)="typedHost.set($event)" />
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="closeConfirm()">{{ 'common.cancel' | transloco }}</button>
          <button type="button" class="btn btn-primary" [disabled]="typedHost().trim() !== host() || submitting()" (click)="start()">{{ 'wizard.start' | transloco }}</button>
        </div>
      </app-dialog>
    </div>
  `,
})
export class ScanWizardPage implements OnInit {
  private readonly targetsApi = inject(TargetsApi);
  private readonly scansApi = inject(ScansApi);
  private readonly router = inject(Router);
  /** Optional ?targetId= / ?projectId= (component input binding). */
  readonly targetId = input<string | undefined>(undefined);
  readonly projectId = input<string | undefined>(undefined);

  protected readonly stepKeys = ['wizard.stepTarget', 'wizard.stepScope', 'wizard.stepReview'];
  protected readonly step = signal<Step>(0);
  protected readonly targets = signal<Target[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(() => this.targets().find((t) => t.id === this.selectedId() && t.isAuthorized && t.isEnabled) ?? null);
  protected readonly host = computed(() => {
    const url = this.selected()?.baseUrl;
    try { return url ? new URL(url).host : ''; } catch { return ''; }
  });
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly typedHost = signal('');
  protected readonly submitting = signal(false);
  protected readonly queued = signal(0);

  ngOnInit(): void {
    this.load();
  }

  protected prev(): Step { return Math.max(0, this.step() - 1) as Step; }
  protected next(): Step { return Math.min(2, this.step() + 1) as Step; }

  protected load(): void {
    this.scansApi.getAll({ status: 'Queued', pageSize: 1 }).subscribe({ next: (r) => this.queued.set(r.paging?.totalItems ?? 0) });
    this.loading.set(true);
    this.error.set(null);
    this.targetsApi.getAll({ pageSize: 100, projectId: this.projectId() }).subscribe({
      next: (res) => {
        this.targets.set(res.data ?? []);
        this.selectedId.set(this.targetId() ?? null);
        if (this.selected()) this.step.set(1);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected closeConfirm(): void {
    this.confirmOpen.set(false);
    this.typedHost.set('');
  }

  protected start(): void {
    const t = this.selected();
    if (!t) return;
    this.submitting.set(true);
    this.submitError.set(null);
    this.scansApi.create(t.id).subscribe({
      next: (res) => res.data && this.router.navigate(['/scans', res.data.id]),
      // Out-of-scope / unauthorized targets are rejected server-side (SCAN_SCOPE_REJECTED) before anything is queued.
      error: (err) => {
        this.submitting.set(false);
        this.closeConfirm();
        this.submitError.set(apiErrorMessage(err));
      },
    });
  }
}
