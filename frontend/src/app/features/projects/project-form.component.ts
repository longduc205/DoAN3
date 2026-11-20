import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { Project, ProjectStatus } from '../../shared/models/api.models';
import { ProjectsApi } from '../api.services';

/** Add/edit project form (formAddEdit), rendered inside <app-dialog>. Passing a project switches to edit mode. */
@Component({
  selector: 'app-project-form',
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <form [formGroup]="formAddEdit" (ngSubmit)="save()" class="grid md:grid-cols-2 gap-4">
      @if (error()) {
        <div role="alert" class="md:col-span-2 px-3 py-2 rounded-xl bg-danger-bg text-danger text-sm">{{ error()! | transloco }}</div>
      }
      <div>
        <label class="label" for="p-name">{{ 'projects.name' | transloco }} *</label>
        <input id="p-name" class="input" formControlName="name" [attr.aria-invalid]="bad('name')" />
        @if (bad('name')) { <p class="field-error">{{ 'validation.required' | transloco }}</p> }
      </div>
      <div>
        <label class="label" for="p-code">{{ 'projects.code' | transloco }} *</label>
        <input id="p-code" class="input font-mono" formControlName="code" [attr.aria-invalid]="bad('code')" />
        @if (bad('code')) { <p class="field-error">{{ 'validation.code' | transloco }}</p> }
      </div>
      <div class="md:col-span-2">
        <label class="label" for="p-desc">{{ 'projects.description' | transloco }}</label>
        <textarea id="p-desc" class="input h-20 py-2" formControlName="description"></textarea>
      </div>
      @if (project()) {
        <div>
          <label class="label" for="p-status">{{ 'common.status' | transloco }}</label>
          <select id="p-status" class="input" formControlName="status">
            <option value="Active">{{ 'projectStatus.Active' | transloco }}</option>
            <option value="Archived">{{ 'projectStatus.Archived' | transloco }}</option>
          </select>
        </div>
      }
      @if (confirmDiscard()) {
        <div role="alert" class="md:col-span-2 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-warn-bg text-warn text-sm">
          <span>{{ 'common.discardChanges' | transloco }}</span>
          <span class="flex gap-2">
            <button type="button" class="btn h-8" (click)="confirmDiscard.set(false)">{{ 'common.keepEditing' | transloco }}</button>
            <button type="button" class="btn btn-danger h-8" (click)="cancelled.emit()">{{ 'common.discard' | transloco }}</button>
          </span>
        </div>
      }
      <div class="md:col-span-2 flex justify-end gap-2">
        <button type="button" class="btn" (click)="cancel()">{{ 'common.cancel' | transloco }}</button>
        <button type="submit" class="btn btn-primary" [disabled]="saving()">{{ 'common.save' | transloco }}</button>
      </div>
    </form>
  `,
})
export class ProjectFormComponent implements OnInit {
  private readonly api = inject(ProjectsApi);
  readonly project = input<Project | null>(null);
  readonly saved = output<Project>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmDiscard = signal(false);
  protected readonly formAddEdit = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    status: ['Active' as ProjectStatus],
  });

  ngOnInit(): void {
    const p = this.project();
    if (p) this.formAddEdit.patchValue({ code: p.code, name: p.name, description: p.description ?? '', status: p.status });
  }

  protected bad(name: 'code' | 'name'): boolean {
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
    const v = this.formAddEdit.getRawValue();
    const body = { ...v, description: v.description || null };
    const p = this.project();
    const req = p ? this.api.update({ ...body, id: p.id }) : this.api.create(body);
    req.subscribe({
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
