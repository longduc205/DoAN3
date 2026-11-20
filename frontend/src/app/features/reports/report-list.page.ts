import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { Project, Report, ReportStatus, ReportTemplate } from '../../shared/models/api.models';
import { ProjectsApi, ReportsApi } from '../api.services';

const STATUS_CLASS: Record<ReportStatus, string> = {
  Generating: 'text-run bg-run-bg', Ready: 'text-ok bg-ok-bg', Failed: 'text-danger bg-danger-bg',
};

// W11 Reports: list grouped by project + create dialog. Also embedded as the project "Reports" tab (projectId input).
// shortcut: plain glass groups instead of the canvas' animated folder/sheet cards.
@Component({
  selector: 'app-report-list',
  imports: [RouterLink, FormsModule, TranslocoPipe, DatePipe, PageState, DialogComponent],
  template: `
    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        @if (!projectId()) {
          <div>
            <h1 class="page-title">{{ 'nav.reports' | transloco }}</h1>
            <p class="mt-1 text-sm text-ink-muted">{{ 'reports.subtitle' | transloco }}</p>
          </div>
        } @else { <span></span> }
        @if (canGenerate) {
          <button type="button" class="btn btn-primary h-10 rounded-[10px] font-semibold" (click)="openCreate()">{{ 'reports.new' | transloco }}</button>
        }
      </div>
      @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }

      <app-page-state [loading]="loading()" [error]="error()" [empty]="items().length === 0" emptyKey="reports.empty" (retry)="load()">
        <div class="flex flex-col gap-5">
          @for (g of groups(); track g.projectId) {
            <section class="glass p-5 flex flex-col gap-3">
              @if (!projectId()) { <h2 class="font-semibold">{{ g.projectName }}</h2> }
              <ul class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                @for (r of g.reports; track r.id) {
                  <li class="rounded-2xl bg-white/80 border border-line p-4 flex flex-col gap-2">
                    <div class="flex items-start justify-between gap-2">
                      @if (r.status === 'Ready') {
                        <a [routerLink]="['/reports', r.id]" class="font-medium hover:underline">{{ r.title }}</a>
                      } @else {
                        <span class="font-medium">{{ r.title }}</span>
                      }
                      <span class="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" [class]="statusClass[r.status]">{{ 'reportStatus.' + r.status | transloco }}</span>
                    </div>
                    <p class="mono">{{ 'reportTemplate.' + r.template | transloco }} · {{ r.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ r.createdByName }}</p>
                    @if (r.status === 'Failed') {
                      <p class="text-sm text-danger">{{ r.errorSafe }}</p>
                      @if (canGenerate) { <button type="button" class="btn h-8 self-start" (click)="retry(r)">{{ 'common.retry' | transloco }}</button> }
                    }
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      </app-page-state>

      <app-dialog [open]="createOpen()" [heading]="'reports.new' | transloco" (closed)="createOpen.set(false)">
        <form class="flex flex-col gap-4" (ngSubmit)="create()">
          @if (createError()) { <div role="alert" class="px-3 py-2 rounded-xl bg-danger-bg text-danger text-sm">{{ createError()! | transloco }}</div> }
          @if (!projectId()) {
            <div>
              <label class="label" for="r-project">{{ 'reports.project' | transloco }} *</label>
              <select id="r-project" name="project" class="input" required [ngModel]="formProject()" (ngModelChange)="formProject.set($event)">
                <option [ngValue]="null" disabled>{{ 'reports.pickProject' | transloco }}</option>
                @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
              </select>
            </div>
          }
          <fieldset class="flex flex-col gap-2">
            <legend class="label">{{ 'reports.template' | transloco }}</legend>
            @for (t of templates; track t) {
              <label class="flex items-start gap-2 text-sm rounded-xl border border-line bg-white/70 p-3 cursor-pointer">
                <input type="radio" name="template" class="mt-0.5" [value]="t" [ngModel]="formTemplate()" (ngModelChange)="formTemplate.set($event)" />
                <span><b class="font-medium">{{ 'reportTemplate.' + t | transloco }}</b><br /><span class="text-ink-muted">{{ 'reportTemplate.hint_' + t | transloco }}</span></span>
              </label>
            }
          </fieldset>
          <div>
            <label class="label" for="r-title">{{ 'reports.title' | transloco }}</label>
            <input id="r-title" name="title" class="input" maxlength="200" [placeholder]="'reports.titlePh' | transloco" [ngModel]="formTitle()" (ngModelChange)="formTitle.set($event)" />
          </div>
          <p class="text-xs text-ink-muted">{{ 'reports.systemOnly' | transloco }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn" (click)="createOpen.set(false)">{{ 'common.cancel' | transloco }}</button>
            <button type="submit" class="btn btn-primary" [disabled]="creating() || !targetProject()">{{ 'reports.generate' | transloco }}</button>
          </div>
        </form>
      </app-dialog>
    </div>
  `,
})
export class ReportListPage implements OnInit {
  private readonly api = inject(ReportsApi);
  private readonly projectsApi = inject(ProjectsApi);
  private readonly router = inject(Router);
  protected readonly canGenerate = inject(AuthService).hasPermission('Report.Generate');
  protected readonly statusClass = STATUS_CLASS;
  protected readonly templates: ReportTemplate[] = ['Executive', 'Technical'];

  readonly projectId = input<string | undefined>(undefined);
  protected readonly items = signal<Report[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly createError = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly projects = signal<Project[]>([]);
  protected readonly formProject = signal<string | null>(null);
  protected readonly formTemplate = signal<ReportTemplate>('Technical');
  protected readonly formTitle = signal('');
  protected readonly targetProject = computed(() => this.projectId() ?? this.formProject());
  protected readonly groups = computed(() => {
    const map = new Map<string, { projectId: string; projectName: string; reports: Report[] }>();
    for (const r of this.items()) {
      const g = map.get(r.projectId) ?? { projectId: r.projectId, projectName: r.projectName, reports: [] };
      g.reports.push(r);
      map.set(r.projectId, g);
    }
    return [...map.values()];
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getAll({ pageSize: 100, projectId: this.projectId() }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected openCreate(): void {
    this.createError.set(null);
    this.formTitle.set('');
    this.createOpen.set(true);
    if (!this.projectId() && this.projects().length === 0)
      this.projectsApi.getAll({ pageSize: 100, status: 'Active' }).subscribe({ next: (r) => this.projects.set(r.data ?? []) });
  }

  protected create(): void {
    const projectId = this.targetProject();
    if (!projectId) return;
    this.creating.set(true);
    this.createError.set(null);
    this.api.create({ projectId, template: this.formTemplate(), title: this.formTitle().trim() || null }).subscribe({
      next: (r) => {
        this.creating.set(false);
        this.createOpen.set(false);
        if (r.data?.status === 'Ready') this.router.navigate(['/reports', r.data.id]);
        else this.load();
      },
      // "No data" (no scans yet) comes back as a validation message and is shown inside the dialog (W11).
      error: (err) => {
        this.creating.set(false);
        this.createError.set(apiErrorMessage(err));
      },
    });
  }

  protected retry(r: Report): void {
    this.actionError.set(null);
    this.api.retry(r.id).subscribe({ next: () => this.load(), error: (err) => this.actionError.set(apiErrorMessage(err)) });
  }
}
