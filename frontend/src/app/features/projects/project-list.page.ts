import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { PageState, Pagination } from '../../shared/components/page-state';
import { PagingInfo, Project } from '../../shared/models/api.models';
import { ProjectsApi } from '../api.services';
import { ProjectFormComponent } from './project-form.component';

@Component({
  selector: 'app-project-list',
  imports: [RouterLink, ReactiveFormsModule, TranslocoPipe, DatePipe, PageState, Pagination, ProjectFormComponent],
  template: `
    <div class="flex flex-wrap items-end justify-between gap-4 mb-5">
      <h1 class="page-title">{{ 'nav.projects' | transloco }}</h1>
      <div class="flex gap-2">
        <form [formGroup]="formSearch" (ngSubmit)="search()" class="flex gap-2">
          <input class="input w-56" formControlName="keyword" [placeholder]="'common.search' | transloco" [attr.aria-label]="'common.search' | transloco" />
        </form>
        <button type="button" class="btn btn-primary" (click)="modal.set({ mode: 'add' })">{{ 'projects.new' | transloco }}</button>
      </div>
    </div>

    @if (modal(); as m) {
      <app-project-form [project]="m.project ?? null" (saved)="onSaved()" (cancelled)="modal.set(null)" />
    }

    <section class="glass">
      <app-page-state [loading]="loading()" [error]="error()" [empty]="items().length === 0" emptyKey="projects.empty" (retry)="load()">
        <table class="table">
          <thead>
            <tr><th>{{ 'projects.code' | transloco }}</th><th>{{ 'projects.name' | transloco }}</th>
              <th>{{ 'common.status' | transloco }}</th><th>{{ 'common.createdDate' | transloco }}</th><th></th></tr>
          </thead>
          <tbody>
            @for (p of items(); track p.id) {
              <tr>
                <td class="mono">{{ p.code }}</td>
                <td><a [routerLink]="['/projects', p.id]" class="font-medium hover:underline">{{ p.name }}</a></td>
                <td>{{ 'projectStatus.' + p.status | transloco }}</td>
                <td>{{ p.createdDate | date: 'short' }}</td>
                <td class="text-right whitespace-nowrap">
                  <button type="button" class="btn h-8" (click)="modal.set({ mode: 'edit', project: p })">{{ 'common.edit' | transloco }}</button>
                  <button type="button" class="btn btn-danger h-8 ml-1" (click)="remove(p)">{{ 'common.delete' | transloco }}</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
        <app-pagination [paging]="paging()" (pageChange)="load($event)" />
      </app-page-state>
    </section>
  `,
})
export class ProjectListPage implements OnInit {
  private readonly api = inject(ProjectsApi);
  /** Set by the /projects/new route. */
  readonly openCreate = input(false);

  protected readonly formSearch = inject(FormBuilder).nonNullable.group({ keyword: ['', Validators.maxLength(200)] });
  protected readonly items = signal<Project[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<{ mode: 'add' | 'edit'; project?: Project } | null>(null);

  ngOnInit(): void {
    if (this.openCreate()) this.modal.set({ mode: 'add' });
    this.load();
  }

  protected search(): void {
    this.load(1);
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll({ page, pageSize: 10, keyword: this.formSearch.getRawValue().keyword }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.paging.set(res.paging);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected onSaved(): void {
    this.modal.set(null);
    this.load(this.paging()?.page ?? 1);
  }

  protected remove(p: Project): void {
    if (!confirm(`${p.code} – ${p.name}?`)) return;
    this.api.delete(p.id).subscribe({ next: () => this.load(), error: (err) => this.error.set(apiErrorMessage(err)) });
  }
}
