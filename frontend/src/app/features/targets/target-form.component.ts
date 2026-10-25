import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { ScopeMode, Target, TargetEnvironment } from '../../shared/models/api.models';
import { TargetsApi } from '../api.services';

@Component({
  selector: 'app-target-form',
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <form [formGroup]="formAddEdit" (ngSubmit)="save()" class="glass p-5 mb-4 grid md:grid-cols-2 gap-4">
      <h2 class="md:col-span-2 font-semibold">{{ (target() ? 'targets.edit' : 'targets.new') | transloco }}</h2>
      @if (error()) {
        <div role="alert" class="md:col-span-2 px-3 py-2 rounded-xl bg-danger/10 text-danger text-sm">{{ error()! | transloco }}</div>
      }
      <div>
        <label class="label" for="t-name">{{ 'targets.name' | transloco }}</label>
        <input id="t-name" class="input" formControlName="name" />
        @if (formAddEdit.controls.name.touched && formAddEdit.controls.name.invalid) {
          <p class="field-error">{{ 'validation.required' | transloco }}</p>
        }
      </div>
      <div>
        <label class="label" for="t-url">{{ 'targets.baseUrl' | transloco }}</label>
        <input id="t-url" class="input font-mono" formControlName="baseUrl" placeholder="http://localhost:3000" />
        @if (formAddEdit.controls.baseUrl.touched && formAddEdit.controls.baseUrl.invalid) {
          <p class="field-error">{{ 'validation.url' | transloco }}</p>
        }
      </div>
      <div>
        <label class="label" for="t-env">{{ 'targets.environment' | transloco }}</label>
        <select id="t-env" class="input" formControlName="environment">
          @for (e of environments; track e) { <option [value]="e">{{ e }}</option> }
        </select>
      </div>
      <div>
        <label class="label" for="t-scope">{{ 'targets.scopeMode' | transloco }}</label>
        <select id="t-scope" class="input" formControlName="scopeMode">
          <option value="SameHostPathPrefix">{{ 'scopeMode.SameHostPathPrefix' | transloco }}</option>
          <option value="ExactUrl">{{ 'scopeMode.ExactUrl' | transloco }}</option>
        </select>
      </div>
      <label class="flex items-center gap-2 text-sm"><input type="checkbox" formControlName="isEnabled" /> {{ 'targets.isEnabled' | transloco }}</label>
      <label class="flex items-start gap-2 text-sm md:col-span-2">
        <input type="checkbox" formControlName="isAuthorized" class="mt-1" />
        <span><b>{{ 'targets.isAuthorized' | transloco }}</b><br /><span class="text-ink-muted">{{ 'targets.isAuthorizedHint' | transloco }}</span></span>
      </label>
      <div class="md:col-span-2 flex justify-end gap-2">
        <button type="button" class="btn" (click)="cancelled.emit()">{{ 'common.cancel' | transloco }}</button>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ 'common.save' | transloco }}</button>
      </div>
    </form>
  `,
})
export class TargetFormComponent implements OnInit {
  private readonly api = inject(TargetsApi);
  readonly projectId = input.required<string>();
  readonly target = input<Target | null>(null);
  readonly saved = output<Target>();
  readonly cancelled = output<void>();

  protected readonly environments: TargetEnvironment[] = ['Lab', 'Development', 'Staging', 'Production'];
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
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
    if (t) this.formAddEdit.patchValue(t);
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
