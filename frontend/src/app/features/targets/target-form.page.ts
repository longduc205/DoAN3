import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { merge } from 'rxjs';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { Project, ScopeMode, Target, TargetEnvironment } from '../../shared/models/api.models';
import { ProjectsApi, TargetsApi } from '../api.services';

/**
 * W05 target form as a page: 1 info → 2 scope → 3 authorization, with a status preview on the right.
 * shortcut: allowed/excluded path chips and notes need fields the API does not have yet; scope is the scope-mode radio until then.
 */
@Component({
  selector: 'app-target-form-page',
  imports: [ReactiveFormsModule, TranslocoPipe, PageState, DialogComponent],
  template: `
    <app-page-state [loading]="loading()" [error]="loadError()" (retry)="load()">
      <div class="flex flex-col gap-5">
        <div>
          <h1 class="page-title">{{ (target() ? 'targets.edit' : 'targets.new') | transloco }}</h1>
          <p class="mt-1 text-sm text-ink-muted">{{ 'targets.pageSub' | transloco: { project: project()?.name ?? '' } }}</p>
        </div>

        <form [formGroup]="formAddEdit" (ngSubmit)="save()" class="grid lg:grid-cols-[1fr_344px] gap-5 items-start" novalidate>
          <div class="flex flex-col gap-4 min-w-0">
            @if (error()) {
              <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ error()! | transloco }}</div>
            }
            <section class="glass p-5 flex flex-col gap-4" aria-labelledby="t-sec1">
              <h2 id="t-sec1" class="flex items-center gap-2.5 font-semibold"><span class="step-no">1</span>{{ 'targets.sectionInfo' | transloco }}</h2>
              <div class="grid md:grid-cols-[1fr_232px] gap-4">
                <div>
                  <label class="label" for="t-url">{{ 'targets.baseUrl' | transloco }} *</label>
                  <span class="flex items-center gap-2.5 h-11 px-3.5 rounded-xl border bg-white/85 focus-within:border-focus"
                    [class]="bad('baseUrl') ? 'border-danger' : 'border-line'">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="shrink-0 text-ink-muted"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
                    <input id="t-url" class="flex-1 min-w-0 bg-transparent font-mono text-sm outline-none" formControlName="baseUrl" placeholder="https://shop-staging.lab.local"
                      aria-describedby="t-url-hint" [attr.aria-invalid]="bad('baseUrl')" />
                  </span>
                  <p id="t-url-hint" class="text-xs mt-1" [class]="bad('baseUrl') ? 'text-danger' : 'text-ink-muted'">{{ 'validation.url' | transloco }}</p>
                </div>
                <div>
                  <label class="label" for="t-env">{{ 'targets.environment' | transloco }} *</label>
                  <select id="t-env" class="input h-11" formControlName="environment">
                    @for (e of environments; track e) { <option [value]="e">{{ 'environment.' + e | transloco }}</option> }
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="label" for="t-name">{{ 'targets.name' | transloco }} *</label>
                  <input id="t-name" class="input h-11" formControlName="name" [attr.aria-invalid]="bad('name')" />
                  @if (bad('name')) { <p class="field-error">{{ 'validation.required' | transloco }}</p> }
                </div>
              </div>
            </section>

            <section class="glass p-5 flex flex-col gap-3" aria-labelledby="t-sec2">
              <h2 id="t-sec2" class="flex items-center gap-2.5 font-semibold"><span class="step-no">2</span>{{ 'targets.sectionScope' | transloco }}</h2>
              <div role="radiogroup" aria-labelledby="t-sec2" class="grid md:grid-cols-2 gap-2.5">
                @for (m of scopeModes; track m) {
                  <label class="flex items-start gap-2.5 text-sm rounded-xl border p-3 cursor-pointer"
                    [class]="formAddEdit.controls.scopeMode.value === m ? 'border-ink bg-white' : 'border-line bg-white/60'">
                    <input type="radio" formControlName="scopeMode" [value]="m" class="mt-0.5 accent-ink" />
                    <span><b class="font-medium">{{ 'scopeMode.' + m | transloco }}</b><br /><span class="text-ink-muted">{{ 'scopeMode.hint_' + m | transloco }}</span></span>
                  </label>
                }
              </div>
            </section>

            <section class="glass p-5 flex flex-col gap-3" aria-labelledby="t-sec3">
              <h2 id="t-sec3" class="flex items-center gap-2.5 font-semibold"><span class="step-no">3</span>{{ 'targets.sectionAuth' | transloco }}</h2>
              <label class="flex items-start gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" class="check mt-0.5 shrink-0" formControlName="isAuthorized" />
                <span>{{ 'targets.isAuthorizedLong' | transloco }}</span>
              </label>
              @if (scopeReset()) {
                <p role="status" class="text-sm text-warn">{{ 'targets.scopeResetNote' | transloco }}</p>
              }
            </section>

            @if (confirmDiscard()) {
              <div role="alert" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl bg-warn-bg text-warn text-sm">
                <span>{{ 'common.discardChanges' | transloco }}</span>
                <span class="flex gap-2">
                  <button type="button" class="btn h-8" (click)="confirmDiscard.set(false)">{{ 'common.keepEditing' | transloco }}</button>
                  <button type="button" class="btn btn-danger h-8" (click)="back()">{{ 'common.discard' | transloco }}</button>
                </span>
              </div>
            }
            <div class="flex flex-wrap items-center gap-2">
              @if (target(); as t) {
                <button type="button" class="px-3 text-sm cursor-pointer hover:underline" [class]="t.isEnabled ? 'text-danger' : 'text-ok'" (click)="toggleEnabled()">
                  {{ (t.isEnabled ? 'targets.disableTarget' : 'targets.enableTarget') | transloco }}</button>
                <button type="button" class="px-3 text-sm text-ink-muted cursor-pointer hover:text-danger hover:underline" (click)="deleteOpen.set(true)">{{ 'common.delete' | transloco }}</button>
              }
              <span class="flex-1"></span>
              <button type="button" class="btn h-11 px-4" (click)="cancel()">{{ 'common.cancel' | transloco }}</button>
              <button type="submit" class="btn btn-primary h-11 px-4 font-semibold" [disabled]="saving()">{{ 'targets.save' | transloco }}</button>
            </div>
          </div>

          <aside class="flex flex-col gap-4">
            <section class="glass p-5 flex flex-col gap-3">
              <h2 class="text-sm font-semibold">{{ 'targets.afterSave' | transloco }}</h2>
              <span class="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-semibold"
                [class]="authorized() ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'">
                <span aria-hidden="true" class="size-1.5 rounded-full bg-current"></span>
                {{ (authorized() ? 'targets.scopeConfirmed' : 'targets.notAuthorized') | transloco }}</span>
              <p class="text-sm leading-relaxed text-ink-muted">{{ (authorized() ? 'targets.afterSaveOk' : 'targets.afterSaveWarn') | transloco }}</p>
            </section>
            <section class="rounded-[20px] bg-white/45 p-5 flex flex-col gap-2.5 text-[13px] text-ink-muted">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-ink">
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></svg>
                {{ 'targets.safetyTitle' | transloco }}</h2>
              <p>{{ 'targets.safety1' | transloco }}</p>
              <p>{{ 'targets.safety2' | transloco }}</p>
              <p>{{ 'targets.safety3' | transloco }}</p>
            </section>
          </aside>
        </form>
      </div>

      <app-dialog [open]="deleteOpen()" [heading]="'targets.deleteTitle' | transloco" (closed)="deleteOpen.set(false)">
        <p class="text-sm">{{ 'targets.deleteBody' | transloco: { name: target()?.name } }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn" (click)="deleteOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
          <button type="button" class="btn btn-danger" (click)="remove()">{{ 'common.delete' | transloco }}</button>
        </div>
      </app-dialog>
    </app-page-state>
  `,
  styles: `.step-no { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 13px; background: rgb(20 20 22 / 0.06); font-size: 13px; }`,
})
export class TargetFormPage implements OnInit {
  private readonly api = inject(TargetsApi);
  private readonly projectsApi = inject(ProjectsApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  /** Route params: projects/:id/targets/new and projects/:id/targets/:targetId/edit. */
  readonly id = input.required<string>();
  readonly targetId = input<string>();

  protected readonly environments: TargetEnvironment[] = ['Lab', 'Development', 'Staging', 'Production'];
  protected readonly scopeModes: ScopeMode[] = ['SameHostPathPrefix', 'ExactUrl'];
  protected readonly project = signal<Project | null>(null);
  protected readonly target = signal<Target | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDiscard = signal(false);
  protected readonly scopeReset = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly formAddEdit = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    baseUrl: ['', [Validators.required, Validators.maxLength(2048), Validators.pattern(/^https?:\/\/[^\s]+$/i)]],
    environment: ['Lab' as TargetEnvironment],
    scopeMode: ['SameHostPathPrefix' as ScopeMode],
    isEnabled: [true],
    isAuthorized: [false],
  });
  protected readonly authorized = signal(false);

  ngOnInit(): void {
    this.formAddEdit.controls.isAuthorized.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => this.authorized.set(v));
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.projectsApi.getById(this.id()).subscribe({
      next: (res) => {
        this.project.set(res.data);
        const tid = this.targetId();
        if (!tid) return this.loading.set(false);
        this.api.getById(tid).subscribe({
          next: (r) => {
            if (r.data) this.edit(r.data);
            this.loading.set(false);
          },
          error: (err) => { this.loadError.set(apiErrorMessage(err)); this.loading.set(false); },
        });
      },
      error: (err) => { this.loadError.set(apiErrorMessage(err)); this.loading.set(false); },
    });
  }

  private edit(t: Target): void {
    this.target.set(t);
    this.formAddEdit.patchValue(t);
    this.authorized.set(t.isAuthorized);
    // A11: changing the scope of a confirmed target drops the confirmation; the user must tick it again.
    const c = this.formAddEdit.controls;
    merge(c.baseUrl.valueChanges, c.scopeMode.valueChanges).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (t.isAuthorized && c.isAuthorized.value && (c.baseUrl.value !== t.baseUrl || c.scopeMode.value !== t.scopeMode)) {
        c.isAuthorized.setValue(false);
        this.scopeReset.set(true);
      }
    });
  }

  protected bad(name: 'name' | 'baseUrl'): boolean {
    const c = this.formAddEdit.controls[name];
    return c.touched && c.invalid;
  }

  protected back(): void {
    this.router.navigate(['/projects', this.id()]);
  }

  protected cancel(): void {
    if (this.formAddEdit.dirty) this.confirmDiscard.set(true);
    else this.back();
  }

  protected toggleEnabled(): void {
    this.formAddEdit.controls.isEnabled.setValue(!this.target()!.isEnabled);
    this.save();
  }

  protected save(): void {
    if (this.formAddEdit.invalid) {
      this.formAddEdit.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const body = { ...this.formAddEdit.getRawValue(), projectId: this.id() };
    const t = this.target();
    (t ? this.api.update({ ...body, id: t.id }) : this.api.create(body)).subscribe({
      next: () => {
        this.saving.set(false);
        this.formAddEdit.markAsPristine();
        this.back();
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected remove(): void {
    this.deleteOpen.set(false);
    this.api.delete(this.target()!.id).subscribe({ next: () => this.back(), error: (err) => this.error.set(apiErrorMessage(err)) });
  }
}
