import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { PageState, Pagination } from '../../shared/components/page-state';
import { PagingInfo, Project, ProjectStatus } from '../../shared/models/api.models';
import { ProjectsApi } from '../api.services';
import { TargetFormComponent } from '../targets/target-form.component';
import { ProjectFormComponent } from './project-form.component';

const ART = ['ember-11', 'dusk-5', 'verdant-7', 'aurora-29', 'glacier-2', 'aurora-3', 'dusk-17'];
const SORTS = {
  newest: { sortBy: 'createdDate', sortDirection: 'Desc' },
  updated: { sortBy: 'updatedDate', sortDirection: 'Desc' },
  name: { sortBy: 'name', sortDirection: 'Asc' },
} as const;
type SortKey = keyof typeof SORTS;
// Folder outlines from design/source/W03-Projects.dc.html (.gf-back / .gf-front), in the unscaled 340px box.
const BACK_PATH = 'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
const FRONT_PATH = 'M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z';

@Component({
  selector: 'app-project-list',
  imports: [RouterLink, ReactiveFormsModule, TranslocoPipe, DatePipe, PageState, Pagination, ProjectFormComponent, TargetFormComponent],
  styles: `
    .folder-box { position: relative; width: 265px; height: 254px; flex: none; }
    .folder { position: absolute; left: 0; top: 0; width: 340px; height: 326px; transform: scale(0.78); transform-origin: 0 0; isolation: isolate; --hinge: 0deg; }
    .folder:hover, .folder:focus-within { --hinge: -11deg; }
    .stage { position: absolute; left: 0; top: 54px; width: 340px; height: 272px; }
    .shadow { position: absolute; left: 18px; right: 18px; bottom: -6px; height: 60px; border-radius: 40px; background: rgb(16 18 24 / 0.3); filter: blur(22px); }
    .back { position: absolute; inset: 0; overflow: hidden; clip-path: path('${BACK_PATH}'); background: linear-gradient(180deg, rgb(243 243 244), rgb(227 227 230)); }
    .back img { position: absolute; left: -12px; top: -12px; width: 364px; height: 296px; max-width: none; object-fit: cover; }
    .front {
      position: absolute; left: 0; top: 74px; width: 340px; height: 198px; z-index: 10; clip-path: path('${FRONT_PATH}');
      backdrop-filter: blur(22px) saturate(1.5); transform-origin: 50% 100%; transform: perspective(760px) rotateX(var(--hinge));
      transition: transform 0.8s cubic-bezier(0.34, 1.36, 0.5, 1);
    }
    .tint { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(255 255 255 / 0.16) 0%, rgb(255 255 255 / 0.5) 42%, rgb(252 252 252 / 0.93) 100%); }
    .rim { position: absolute; inset: 0; width: 340px; height: 198px; fill: none; pointer-events: none; overflow: visible; }
    .hit { position: absolute; inset: 0; z-index: 1; }
    .hit:focus-visible { outline: none; }
    .hit:focus-visible ~ .label .title { text-decoration: underline; text-underline-offset: 4px; }
    .label { position: absolute; z-index: 2; left: 28px; bottom: 30px; display: flex; flex-direction: column; gap: 4px; max-width: 210px; pointer-events: none; }
    .title { font-size: 18px; font-weight: 500; line-height: 1.15; letter-spacing: -0.012em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.03em; color: rgb(20 20 22 / 0.62); white-space: nowrap; }
    .key { position: absolute; right: 22px; bottom: 22px; z-index: 12; }
    @media (prefers-reduced-motion: reduce) { .front { transition: none; } }
  `,
  template: `
    <div class="flex flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="page-title">{{ 'nav.projects' | transloco }}</h1>
          <p class="mt-1 text-sm text-ink-muted">
            {{ 'projects.subtitle' | transloco: { count: paging()?.totalItems ?? 0 } }}
            @if (needScope() > 0) {
              · <span class="font-semibold text-sev-medium">{{ 'projects.needScope' | transloco: { count: needScope() } }}</span>
            }
          </p>
        </div>
        <button type="button" class="btn btn-primary h-10 rounded-[10px] font-semibold" (click)="modal.set({ mode: 'add' })">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {{ 'projects.new' | transloco }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div role="group" [attr.aria-label]="'common.status' | transloco" class="flex p-[3px] rounded-[10px] bg-black/[.04]">
          @for (t of tabs; track t.key) {
            <button type="button" class="min-h-[34px] px-3 rounded-lg text-[13px] cursor-pointer"
              [class]="status() === t.value ? 'bg-white font-semibold' : 'text-ink-muted hover:text-ink'"
              [attr.aria-pressed]="status() === t.value" (click)="setStatus(t.value)">
              {{ t.key | transloco }}
              @if (status() === t.value && paging(); as p) { <span class="text-ink-muted">{{ p.totalItems }}</span> }
            </button>
          }
        </div>
        <form [formGroup]="formSearch" (ngSubmit)="load(1)" class="flex-[1_1_240px] min-w-0" role="search">
          <label class="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-line bg-white text-ink-muted">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" formControlName="keyword" class="flex-1 min-w-0 bg-transparent text-sm text-ink outline-none"
              [placeholder]="'projects.searchPh' | transloco" [attr.aria-label]="'projects.searchPh' | transloco" />
          </label>
        </form>
        <select #sortSel class="h-10 px-2.5 rounded-[10px] border border-line bg-white text-sm" [attr.aria-label]="'projects.sortLabel' | transloco"
          [value]="sort()" (change)="setSort(sortSel.value)">
          <option value="newest">{{ 'projects.sortNewest' | transloco }}</option>
          <option value="updated">{{ 'projects.sortUpdated' | transloco }}</option>
          <option value="name">{{ 'projects.sortName' | transloco }}</option>
        </select>
      </div>

      @if (modal(); as m) {
        <app-project-form [project]="m.project ?? null" (saved)="onSaved()" (cancelled)="modal.set(null)" />
      }
      @if (addTargetTo(); as p) {
        <p class="mono -mb-3">{{ p.code }} · {{ p.name }}</p>
        <app-target-form [projectId]="p.id" (saved)="onTargetSaved()" (cancelled)="addTargetTo.set(null)" />
      }
      @if (actionError()) {
        <div role="alert" class="px-4 py-3 rounded-xl bg-danger/10 text-danger text-sm">{{ actionError()! | transloco }}</div>
      }

      <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
        @if (items().length > 0) {
          <ul class="flex flex-wrap gap-x-6 gap-y-10 pt-12">
            @for (p of items(); track p.id) {
              <li class="flex flex-col gap-2.5 w-[265px]">
                <div class="folder-box">
                  <div class="folder">
                    <div class="stage">
                      <div class="shadow" aria-hidden="true"></div>
                      <div class="back" aria-hidden="true">
                        @if (p.status === 'Active') { <img [src]="art(p)" alt="" width="364" height="296" /> }
                      </div>
                      <div class="front">
                        <div class="tint" aria-hidden="true"></div>
                        <svg class="rim" viewBox="0 0 340 198" aria-hidden="true">
                          <defs>
                            <linearGradient [attr.id]="'rim-' + p.id" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0" stop-color="white" stop-opacity="0.95" />
                              <stop offset="0.35" stop-color="white" stop-opacity="0.35" />
                              <stop offset="1" stop-color="white" stop-opacity="0.12" />
                            </linearGradient>
                          </defs>
                          <path [attr.d]="frontPath" [attr.stroke]="'url(#rim-' + p.id + ')'" stroke-width="2.4" />
                        </svg>
                        <a class="hit" [routerLink]="['/projects', p.id]"
                          [attr.aria-label]="'projects.openFolder' | transloco: { name: p.name, count: p.targetCount }"></a>
                        <div class="label">
                          <span class="title">{{ p.name }}</span>
                          <span class="meta">
                            @if (p.status === 'Archived') {
                              {{ 'projects.archivedOn' | transloco: { date: (p.updatedDate ?? p.createdDate | date: 'dd/MM') } }}
                            } @else {
                              {{ p.code }} · {{ 'projects.targetCount' | transloco: { count: p.targetCount } }}
                            }
                          </span>
                        </div>
                      </div>
                      @if (p.status === 'Active') {
                        <button type="button" class="btn-key key size-[58px] p-0 rounded-[18px]"
                          [attr.aria-label]="'projects.addTarget' | transloco: { name: p.name }" (click)="addTargetTo.set(p)">
                          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 4.5v15M4.5 12h15" /></svg>
                        </button>
                      }
                    </div>
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
                  <span>
                    {{ 'projects.findingCount' | transloco: { count: p.findingCount } }} ·
                    @if (p.lastScanAt) {
                      {{ 'projects.lastScan' | transloco: { date: (p.lastScanAt | date: 'dd/MM/yyyy') } }}
                    } @else {
                      {{ 'projects.neverScanned' | transloco }}
                    }
                  </span>
                  @if (p.isScanning) {
                    <span class="px-2 py-0.5 rounded-full bg-run/10 text-run text-xs font-medium">{{ 'projects.scanning' | transloco }}</span>
                  }
                  @if (p.unauthorizedTargetCount > 0) {
                    <span class="px-2 py-0.5 rounded-full bg-sev-medium/15 text-sev-medium text-xs font-medium">{{ 'projects.needsScope' | transloco }}</span>
                  }
                </div>
                <div class="flex gap-3 text-xs">
                  <button type="button" class="text-ink-muted hover:text-ink hover:underline cursor-pointer" (click)="modal.set({ mode: 'edit', project: p })">{{ 'common.edit' | transloco }}</button>
                  <button type="button" class="text-ink-muted hover:text-danger hover:underline cursor-pointer" (click)="remove(p)">{{ 'common.delete' | transloco }}</button>
                </div>
              </li>
            }
          </ul>
          <app-pagination [paging]="paging()" (pageChange)="load($event)" />
        } @else if (!searched() && status() === null) {
          <div class="flex flex-col items-center gap-3.5 px-6 py-14 text-center rounded-2xl border border-line bg-white">
            <span class="size-[72px] rounded-[20px] grid place-items-center bg-black/5">
              <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v5M9.5 13.5h5" />
              </svg>
            </span>
            <h2 class="text-xl font-semibold">{{ 'projects.emptyTitle' | transloco }}</h2>
            <p class="max-w-[440px] text-sm leading-[22px] text-ink-muted">{{ 'projects.emptyBody' | transloco }}</p>
            <ol class="flex flex-wrap justify-center gap-2.5 text-[13px]">
              <li class="px-3 py-2 rounded-full bg-black/5 font-semibold">1 · {{ 'projects.step1' | transloco }}</li>
              <li class="px-3 py-2 rounded-full bg-black/[.03] text-ink-muted">2 · {{ 'projects.step2' | transloco }}</li>
              <li class="px-3 py-2 rounded-full bg-black/[.03] text-ink-muted">3 · {{ 'projects.step3' | transloco }}</li>
            </ol>
            <button type="button" class="btn btn-primary h-[42px] px-[18px] rounded-[10px] font-semibold" (click)="modal.set({ mode: 'add' })">{{ 'projects.createFirst' | transloco }}</button>
          </div>
        } @else {
          <div class="flex flex-col items-center gap-2.5 px-6 py-11 text-center rounded-2xl border border-line bg-white">
            <span class="size-14 rounded-full grid place-items-center bg-black/[.04] text-ink-muted">
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5M8.5 11h5" /></svg>
            </span>
            <h2 class="text-[17px] font-semibold">
              {{ (searched() ? 'projects.noResults' : 'projects.noResultsFilter') | transloco: { keyword: searched() } }}
            </h2>
            <p class="text-sm text-ink-muted">{{ 'projects.noResultsHint' | transloco }}</p>
            <button type="button" class="btn h-10 rounded-[10px]" (click)="clearFilters()">{{ 'projects.clearFilters' | transloco }}</button>
          </div>
        }
      </app-page-state>
    </div>
  `,
})
export class ProjectListPage implements OnInit {
  private readonly api = inject(ProjectsApi);
  /** Set by the /projects/new route. */
  readonly openCreate = input(false);

  protected readonly frontPath = FRONT_PATH;
  protected readonly tabs: { key: string; value: ProjectStatus | null }[] = [
    { key: 'projects.tabAll', value: null },
    { key: 'projects.tabActive', value: 'Active' },
    { key: 'projects.tabArchived', value: 'Archived' },
  ];

  protected readonly formSearch = inject(FormBuilder).nonNullable.group({ keyword: ['', Validators.maxLength(200)] });
  protected readonly status = signal<ProjectStatus | null>(null);
  protected readonly sort = signal<SortKey>('newest');
  /** Keyword of the last load, for the "no results" message. */
  protected readonly searched = signal('');
  protected readonly items = signal<Project[]>([]);
  protected readonly paging = signal<PagingInfo | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly modal = signal<{ mode: 'add' | 'edit'; project?: Project } | null>(null);
  protected readonly addTargetTo = signal<Project | null>(null);
  // shortcut: counts only the current page; add a workspace-wide total to the API if pages get large.
  protected readonly needScope = computed(() => this.items().reduce((n, p) => n + p.unauthorizedTargetCount, 0));

  ngOnInit(): void {
    if (this.openCreate()) this.modal.set({ mode: 'add' });
    this.load();
  }

  protected art(p: Project): string {
    let h = 0;
    for (const c of p.code) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return `/art/${ART[h % ART.length]}.png`;
  }

  protected setStatus(s: ProjectStatus | null): void {
    this.status.set(s);
    this.load(1);
  }

  protected setSort(value: string): void {
    if (!(value in SORTS)) return;
    this.sort.set(value as SortKey);
    this.load(1);
  }

  protected clearFilters(): void {
    this.formSearch.reset();
    this.status.set(null);
    this.load(1);
  }

  protected load(page = 1): void {
    this.loading.set(true);
    this.error.set(null);
    const keyword = this.formSearch.getRawValue().keyword.trim();
    this.api.getAll({ page, pageSize: 12, keyword, status: this.status(), ...SORTS[this.sort()] }).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.paging.set(res.paging);
        this.searched.set(keyword);
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

  protected onTargetSaved(): void {
    this.addTargetTo.set(null);
    this.load(this.paging()?.page ?? 1);
  }

  protected remove(p: Project): void {
    if (!confirm(`${p.code} – ${p.name}?`)) return;
    this.actionError.set(null);
    this.api.delete(p.id).subscribe({ next: () => this.load(), error: (err) => this.actionError.set(apiErrorMessage(err)) });
  }
}
