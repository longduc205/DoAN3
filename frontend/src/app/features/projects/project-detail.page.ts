import { Component, inject, input, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { PageState } from '../../shared/components/page-state';
import { Project, Target } from '../../shared/models/api.models';
import { ProjectsApi, ScansApi, TargetsApi } from '../api.services';
import { TargetFormComponent } from '../targets/target-form.component';
import { TargetTableComponent } from '../targets/target-table.component';

@Component({
  selector: 'app-project-detail',
  imports: [RouterLink, TranslocoPipe, PageState, TargetFormComponent, TargetTableComponent],
  template: `
    <nav class="text-sm text-ink-muted mb-2"><a routerLink="/projects" class="hover:underline">{{ 'nav.projects' | transloco }}</a> /</nav>
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (project(); as p) {
        <div class="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h1 class="page-title">{{ p.name }}</h1>
            <p class="mono mt-1">{{ p.code }} · {{ 'projectStatus.' + p.status | transloco }}</p>
            @if (p.description) { <p class="text-ink-muted mt-2 max-w-2xl">{{ p.description }}</p> }
          </div>
          <div class="flex gap-2">
            <a [routerLink]="['/scans']" [queryParams]="{ projectId: p.id }" class="btn">{{ 'nav.scans' | transloco }}</a>
            <button type="button" class="btn btn-primary" (click)="targetModal.set({ mode: 'add' })">{{ 'targets.new' | transloco }}</button>
          </div>
        </div>

        @if (targetModal(); as m) {
          <app-target-form [projectId]="p.id" [target]="m.target ?? null" (saved)="onTargetSaved()" (cancelled)="targetModal.set(null)" />
        }
        @if (actionError()) {
          <div role="alert" class="mb-4 px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm">{{ actionError()! | transloco }}</div>
        }

        <section class="glass">
          <h2 class="font-semibold px-5 pt-4 pb-2">{{ 'nav.targets' | transloco }}</h2>
          <app-page-state [empty]="targets().length === 0" emptyKey="targets.empty">
            <app-target-table [targets]="targets()" (scan)="startScan($event)" (edit)="targetModal.set({ mode: 'edit', target: $event })" (remove)="removeTarget($event)" />
          </app-page-state>
        </section>
      }
    </app-page-state>
  `,
})
export class ProjectDetailPage implements OnInit {
  private readonly projectsApi = inject(ProjectsApi);
  private readonly targetsApi = inject(TargetsApi);
  private readonly scansApi = inject(ScansApi);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  protected readonly project = signal<Project | null>(null);
  protected readonly targets = signal<Target[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly targetModal = signal<{ mode: 'add' | 'edit'; target?: Target } | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.projectsApi.getById(this.id()).subscribe({
      next: (res) => {
        this.project.set(res.data);
        this.loading.set(false);
        this.loadTargets();
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected onTargetSaved(): void {
    this.targetModal.set(null);
    this.loadTargets();
  }

  protected startScan(t: Target): void {
    this.actionError.set(null);
    this.scansApi.create(t.id).subscribe({
      next: (res) => res.data && this.router.navigate(['/scans', res.data.id]),
      // Out-of-scope / unauthorized targets are rejected here (SCAN_SCOPE_REJECTED) before anything is queued.
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  protected removeTarget(t: Target): void {
    if (!confirm(`${t.name}?`)) return;
    this.targetsApi.delete(t.id).subscribe({ next: () => this.loadTargets(), error: (err) => this.actionError.set(apiErrorMessage(err)) });
  }

  private loadTargets(): void {
    this.targetsApi.getAll({ projectId: this.id(), pageSize: 100 }).subscribe({
      next: (res) => this.targets.set(res.data ?? []),
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }
}
