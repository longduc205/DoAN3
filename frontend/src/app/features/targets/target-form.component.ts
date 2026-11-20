import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { merge } from 'rxjs';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { ScopeMode, Target, TargetEnvironment } from '../../shared/models/api.models';
import { TargetsApi } from '../api.services';

/** W05 target form, rendered inside <app-dialog>: info → scope → authorization. */
@Component({
  selector: 'app-target-form',
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <form [formGroup]="formAddEdit" (ngSubmit)="save()" class="flex flex-col gap-5">
      @if (error()) {
        <div role="alert" class="px-3 py-2 rounded-xl bg-danger-bg text-danger text-sm">{{ error()! | transloco }}</div>
      }
      <fieldset class="grid md:grid-cols-2 gap-4">
        <legend class="font-semibold mb-2"><span class="mono mr-2">1</span>{{ 'targets.sectionInfo' | transloco }}</legend>
        <div>
          <label class="label" for="t-name">{{ 'targets.name' | transloco }} *</label>
          <input id="t-name" class="input" formControlName="name" [attr.aria-invalid]="bad('name')" />
          @if (bad('name')) { <p class="field-error">{{ 'validation.required' | transloco }}</p> }
        </div>
        <div>
          <label class="label" for="t-env">{{ 'targets.environment' | transloco }}</label>
          <select id="t-env" class="input" formControlName="environment">
            @for (e of environments; track e) { <option [value]="e">{{ 'environment.' + e | transloco }}</option> }
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="label" for="t-url">{{ 'targets.baseUrl' | transloco }} *</label>
          <input id="t-url" class="input font-mono" formControlName="baseUrl" placeholder="http://localhost:3000"
            aria-describedby="t-url-hint" [attr.aria-invalid]="bad('baseUrl')" />
          <p id="t-url-hint" class="text-xs mt-1" [class]="bad('baseUrl') ? 'text-danger' : 'text-ink-muted'">{{ 'validation.url' | transloco }}</p>
        </div>
      </fieldset>

      <fieldset class="flex flex-col gap-2">
        <legend class="font-semibold mb-2"><span class="mono mr-2">2</span>{{ 'targets.sectionScope' | transloco }}</legend>
        @for (m of scopeModes; track m) {
          <label class="flex items-start gap-2 text-sm rounded-xl border border-line bg-white/70 p-3 cursor-pointer">
            <input type="radio" formControlName="scopeMode" [value]="m" class="mt-0.5" />
            <span><b class="font-medium">{{ 'scopeMode.' + m | transloco }}</b><br /><span class="text-ink-muted">{{ 'scopeMode.hint_' + m | transloco }}</span></span>
          </label>
        }
        <p class="text-xs text-ink-muted">{{ 'targets.safetyNote' | transloco }}</p>
      </fieldset>

      <fieldset class="flex flex-col gap-3">
        <legend class="font-semibold mb-2"><span class="mono mr-2">3</span>{{ 'targets.sectionAuth' | transloco }}</legend>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="check" formControlName="isEnabled" /> {{ 'targets.isEnabled' | transloco }}</label>
        <label class="flex items-start gap-2 text-sm rounded-xl p-3" [class]="formAddEdit.controls.isAuthorized.value ? 'bg-ok-bg' : 'bg-warn-bg'">
          <input type="checkbox" class="check mt-0.5 shrink-0" formControlName="isAuthorized" />
          <span><b>{{ 'targets.isAuthorized' | transloco }}</b><br /><span class="text-ink-muted">{{ 'targets.isAuthorizedHint' | transloco }}</span></span>
        </label>
        @if (scopeReset()) {
          <p role="status" class="text-sm text-warn">{{ 'targets.scopeResetNote' | transloco }}</p>
        }
      </fieldset>

      @if (confirmDiscard()) {
        <div role="alert" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-warn-bg text-warn text-sm">
          <span>{{ 'common.discardChanges' | transloco }}</span>
          <span class="flex gap-2">
            <button type="button" class="btn h-8" (click)="confirmDiscard.set(false)">{{ 'common.keepEditing' | transloco }}</button>
            <button type="button" class="btn btn-danger h-8" (click)="cancelled.emit()">{{ 'common.discard' | transloco }}</button>
          </span>
        </div>
      }
      <div class="flex justify-end gap-2">
        <button type="button" class="btn" (click)="cancel()">{{ 'common.cancel' | transloco }}</button>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ 'targets.save' | transloco }}</button>
      </div>
    </form>
  `,
})
export class TargetFormComponent implements OnInit {
  private readonly api = inject(TargetsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly projectId = input.required<string>();
  readonly target = input<Target | null>(null);
  readonly saved = output<Target>();
  readonly cancelled = output<void>();

  protected readonly environments: TargetEnvironment[] = ['Lab', 'Development', 'Staging', 'Production'];
  protected readonly scopeModes: ScopeMode[] = ['SameHostPathPrefix', 'ExactUrl'];
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDiscard = signal(false);
  protected readonly scopeReset = signal(false);
  protected readonly formAddEdit = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    baseUrl: ['', [Validators.required, Validators.maxLength(2048), Validators.pattern(/^https?:\/\/[^\s]+$/i)]],
    environment: ['Lab' as TargetEnvironment],
    scopeMode: ['SameHostPathPrefix' as ScopeMode],
    isEnabled: [true],
    isAuthorized: [false],
  });

  ngOnInit(): void {
    const t = this.target();
    if (!t) return;
    this.formAddEdit.patchValue(t);
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

  protected cancel(): void {
    if (this.formAddEdit.dirty) this.confirmDiscard.set(true);
    else this.cancelled.emit();
  }

  protected save(): void {
    if (this.formAddEdit.invalid) {
      this.formAddEdit.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const body = { ...this.formAddEdit.getRawValue(), projectId: this.projectId() };
    const t = this.target();
    (t ? this.api.update({ ...body, id: t.id }) : this.api.create(body)).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.data) this.saved.emit(res.data);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }
}
