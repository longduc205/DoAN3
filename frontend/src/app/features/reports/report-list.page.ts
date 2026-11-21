import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { DialogComponent } from '../../shared/components/dialog';
import { FOLDER_FRONT_PATH, FOLDER_STYLES, folderArt } from '../../shared/components/folder';
import { PageState } from '../../shared/components/page-state';
import { Project, Report, ReportStatus, ReportTemplate } from '../../shared/models/api.models';
import { ProjectsApi, ReportsApi } from '../api.services';

const STATUS_CLASS: Record<ReportStatus, string> = {
  Generating: 'text-run bg-run-bg', Ready: 'text-ok bg-ok-bg', Failed: 'text-danger bg-danger-bg',
};

// W11 Reports: list grouped by project + create dialog. Also embedded as the project "Reports" tab (projectId input).
@Component({
  selector: 'app-report-list',
  imports: [RouterLink, FormsModule, TranslocoPipe, DatePipe, PageState, DialogComponent],
  // Sheets peek out of the folder on hover / keyboard focus, like the canvas' .gf-sheet.
  styles: [FOLDER_STYLES, `
    .sheets { position: absolute; inset: 0; z-index: 5; pointer-events: none; clip-path: inset(-400px -400px 10px -400px); }
    .sheet { position: absolute; left: 34px; top: 96px; width: 272px; height: 184px; box-sizing: border-box; border-radius: 16px;
      padding: 11px 14px; pointer-events: auto; color: inherit; text-decoration: none;
      background: linear-gradient(180deg, #fff, #f2f2f0); box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.9), 0 0 0 0.5px rgb(0 0 0 / 0.1), 0 10px 26px -8px rgb(10 12 20 / 0.28);
      transform-origin: 50% 100%; transform: translate(0, calc(42px - var(--i) * 15px));
      transition: transform 0.75s cubic-bezier(0.34, 1.36, 0.5, 1) calc(var(--i) * 40ms); }
    .folder:hover .sheet, .folder:focus-within .sheet {
      transform: translate(calc((var(--i) - 1) * 10px), calc(-60px - var(--i) * 14px)) rotate(calc((var(--i) - 1) * 2.5deg)); }
    .sheet:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
    .sheet-head { display: flex; justify-content: space-between; gap: 10px; white-space: nowrap; }
    .sheet-name { overflow: hidden; text-overflow: ellipsis; font-size: 12.5px; font-weight: 600; }
    .sheet-meta { flex: none; font-family: var(--font-mono); font-size: 10px; color: rgb(24 24 27 / 0.62); }
    .lines { position: absolute; left: 14px; right: 14px; top: 40px; display: flex; flex-direction: column; gap: 9px; }
    .lines i { display: block; height: 5px; border-radius: 3px; background: rgb(24 24 27 / 0.08); }
    .lines i:first-child { height: 9px; margin-bottom: 4px; background: rgb(24 24 27 / 0.14); }
    @media (prefers-reduced-motion: reduce) { .sheet { transition: none; } }
  `],
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
            <section class="flex flex-wrap items-start gap-6">
              <div class="pt-12"><div class="folder-box">
                <div class="folder">
                  <div class="stage">
                    <div class="shadow" aria-hidden="true"></div>
                    <div class="back" aria-hidden="true"><img [src]="art(g.projectId)" alt="" width="364" height="296" /></div>
                    <div class="sheets">
                      @for (r of g.reports.slice(0, 3); track r.id; let i = $index) {
                        <a class="sheet" [style.--i]="i" [routerLink]="r.status === 'Ready' ? ['/reports', r.id] : null"
                          [attr.aria-label]="r.title" [attr.tabindex]="r.status === 'Ready' ? 0 : -1">
                          <span class="sheet-head"><span class="sheet-name">{{ r.title }}</span>
                            <span class="sheet-meta">{{ 'reportStatus.' + r.status | transloco }}</span></span>
                          <span class="lines" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
                        </a>
                      }
                    </div>
                    <div class="front">
                      <div class="tint" aria-hidden="true"></div>
                      <svg class="rim" viewBox="0 0 340 198" aria-hidden="true">
                        <path [attr.d]="frontPath" stroke="rgb(255 255 255 / 0.8)" stroke-width="2.4" />
                      </svg>
                      <div class="label">
                        <span class="title">{{ g.projectName }}</span>
                        <span class="meta">{{ 'reports.count' | transloco: { count: g.reports.length } }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div></div>
              <ul class="flex-1 min-w-[260px] flex flex-col gap-2 pt-12">
                @for (r of g.reports; track r.id) {
                  <li class="rounded-2xl bg-white/80 border border-line p-3 flex flex-wrap items-center gap-2">
                    @if (r.status === 'Ready') {
                      <a [routerLink]="['/reports', r.id]" class="font-medium hover:underline flex-1 min-w-0 truncate">{{ r.title }}</a>
                    } @else { <span class="font-medium flex-1 min-w-0 truncate">{{ r.title }}</span> }
                    <span class="px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap" [class]="statusClass[r.status]">{{ 'reportStatus.' + r.status | transloco }}</span>
                    <span class="mono w-full">{{ 'reportTemplate.' + r.template | transloco }} · {{ r.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ r.createdByName }}</span>
                    @if (r.status === 'Failed') {
                      <span class="text-sm text-danger">{{ r.errorSafe }}</span>
                      @if (canGenerate) { <button type="button" class="btn h-8" (click)="retry(r)">{{ 'common.retry' | transloco }}</button> }
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
  protected readonly frontPath = FOLDER_FRONT_PATH;
  protected readonly art = folderArt;

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
