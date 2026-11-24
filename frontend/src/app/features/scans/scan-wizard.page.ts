import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
    <div class="flex flex-col gap-5">
      <div>
        <h1 class="page-title">{{ 'wizard.title' | transloco }}</h1>
        <p class="mt-1 text-sm text-ink-muted">{{ (step() === 2 ? 'wizard.subtitleReview' : 'wizard.subtitle') | transloco }}</p>
      </div>

      <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
        <div class="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
          <ol class="glass p-3 flex flex-col gap-1" [attr.aria-label]="'wizard.steps' | transloco">
            @for (key of stepKeys; track key; let i = $index) {
              <li class="flex items-start gap-3 px-3 py-2.5 rounded-xl" [class.bg-ink/5]="step() === i" [attr.aria-current]="step() === i ? 'step' : null">
                @if (i < step()) {
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="mt-0.5 shrink-0 text-ok"><path d="M5 12l5 5 9-10" /></svg>
                } @else {
                  <span class="grid place-items-center size-6 shrink-0 rounded-full text-xs font-semibold" [class]="step() === i ? 'bg-ink text-white' : 'bg-ink/[.06] text-ink-muted'">{{ i + 1 }}</span>
                }
                <span class="min-w-0">
                  <span class="block text-sm" [class.font-semibold]="step() >= i" [class.text-ink-muted]="step() < i">{{ key | transloco }}</span>
                  <span class="block text-xs text-ink-muted truncate">{{ stepSummary(i) }}</span>
                </span>
              </li>
            }
          </ol>

          <div class="flex flex-col gap-4 min-w-0">
            @switch (step()) {
              @case (0) {
                <section class="glass p-5">
                  <fieldset class="flex flex-col gap-2">
                    <legend class="font-semibold mb-3">{{ 'wizard.pickTarget' | transloco }}</legend>
                    @for (t of targets(); track t.id) {
                      <label class="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"
                        [class]="t.isAuthorized && t.isEnabled ? (selectedId() === t.id ? 'bg-white border-ink' : 'bg-white/70 border-line') : 'bg-black/[.03] border-transparent text-ink-muted cursor-not-allowed'">
                        <input type="radio" name="target" class="mt-1 accent-ink" [value]="t.id" [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)"
                          [disabled]="!t.isAuthorized || !t.isEnabled" />
                        <span class="min-w-0 flex-1">
                          <span class="block font-mono font-semibold break-all">{{ t.baseUrl }}</span>
                          <span class="block text-[13px] text-ink-muted">{{ t.name }} · {{ 'environment.' + t.environment | transloco }}</span>
                        </span>
                        @if (!t.isAuthorized) { <span class="px-2 py-0.5 rounded-full text-xs font-semibold text-warn bg-warn-bg">{{ 'targets.notAuthorized' | transloco }}</span> }
                        @else if (!t.isEnabled) { <span class="px-2 py-0.5 rounded-full text-xs text-sev-info bg-sev-info-bg">{{ 'targets.disabled' | transloco }}</span> }
                      </label>
                    } @empty {
                      <p class="text-sm text-ink-muted">{{ 'targets.empty' | transloco }} <a routerLink="/projects" class="underline">{{ 'nav.projects' | transloco }}</a></p>
                    }
                  </fieldset>
                </section>
              }
              @default {
                @if (selected(); as t) {
                  <section class="glass p-5 flex flex-wrap items-center gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="font-mono font-semibold break-all">{{ t.baseUrl }}</div>
                      <div class="text-[13px] text-ink-muted">{{ t.name }} · {{ 'environment.' + t.environment | transloco }} · {{ 'targets.scopeConfirmed' | transloco }}</div>
                    </div>
                    <button type="button" class="btn h-9" (click)="step.set(0)">{{ 'wizard.changeTarget' | transloco }}</button>
                  </section>
                  <div class="grid md:grid-cols-2 gap-4">
                    <section class="glass p-5 flex flex-col gap-2.5">
                      <h2 class="font-semibold">{{ 'wizard.scope' | transloco }}</h2>
                      <span class="self-start px-2 py-0.5 rounded-md bg-ink/[.05] font-mono text-xs">{{ 'scopeMode.' + t.scopeMode | transloco }}</span>
                      <p class="text-[13px] text-ink-muted">{{ 'scopeMode.hint_' + t.scopeMode | transloco }}</p>
                      <a [routerLink]="['/projects', t.projectId, 'targets', t.id, 'edit']" class="self-start text-sm underline underline-offset-4">{{ 'wizard.editOnTarget' | transloco }}</a>
                    </section>
                    <section class="glass p-5 flex flex-col gap-2.5">
                      <h2 class="font-semibold">{{ 'wizard.engine' | transloco }}</h2>
                      <dl class="grid grid-cols-2 gap-3">
                        <div><dt class="text-xs text-ink-muted">{{ 'wizard.engine' | transloco }}</dt><dd class="text-lg font-semibold">Mock</dd></div>
                        <div><dt class="text-xs text-ink-muted">{{ 'wizard.network' | transloco }}</dt><dd class="text-lg font-semibold">{{ 'wizard.networkNone' | transloco }}</dd></div>
                      </dl>
                      <p class="text-[13px] text-ink-muted">{{ 'scans.mockNotice' | transloco }}</p>
                    </section>
                  </div>
                  @if (step() === 2) {
                    <p class="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-run-bg text-run text-sm">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                      {{ 'wizard.queueInfo' | transloco: { count: queued() } }}
                    </p>
                  }
                }
              }
            }

            @if (submitError()) {
              <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ submitError()! | transloco }}</div>
            }
            <div class="glass p-3 flex items-center gap-2">
              <button type="button" class="btn h-11" [disabled]="step() === 0" (click)="step.set(prev())">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
                {{ 'wizard.back' | transloco }}</button>
              <span class="flex-1"></span>
              @if (step() < 2) {
                <button type="button" class="btn btn-primary h-11 px-5 font-semibold" [disabled]="!selected()" (click)="step.set(next())">{{ 'wizard.next' | transloco }}</button>
              } @else {
                <button type="button" class="btn btn-primary h-11 px-5 font-semibold" (click)="confirmOpen.set(true)">
                  <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 4l13 8-13 8z" /></svg>
                  {{ 'wizard.start' | transloco }}</button>
              }
            </div>
          </div>
        </div>
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
  private readonly transloco = inject(TranslocoService);
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

  protected stepSummary(i: number): string {
    const t = this.selected();
    if (i === 0) return t ? this.host() : '';
    if (i === 1) return t && this.step() > 1 ? this.transloco.translate('scopeMode.' + t.scopeMode) : '';
    return this.step() === 2 ? this.transloco.translate('wizard.current') : '';
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
