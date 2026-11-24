import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, VulnStatusBadge } from '../../shared/components/badges';
import { DialogComponent } from '../../shared/components/dialog';
import { PageState } from '../../shared/components/page-state';
import { UserLookup, VulnerabilityComment, VulnerabilityDetail, VulnerabilityHistory, VulnerabilityStatus } from '../../shared/models/api.models';
import { VulnerabilitiesApi } from '../api.services';

const CLOSE_AS: VulnerabilityStatus[] = ['FalsePositive', 'AcceptedRisk'];
const LIFECYCLE: VulnerabilityStatus[] = ['Open', 'Triaged', 'Assigned', 'InProgress', 'PendingVerification', 'Resolved'];
// Mirrors VulnerabilityStateMachine.RequiresReason on the server (which enforces it).
const NEEDS_REASON: VulnerabilityStatus[] = ['PendingVerification', 'Resolved', 'Reopened', 'FalsePositive', 'AcceptedRisk'];

// W09 Vulnerability detail (the AI panel lives on /ai-assistant, W10). Buttons come from allowedTransitions, so the UI never offers a move the server rejects.
@Component({
  selector: 'app-vuln-detail',
  imports: [FormsModule, RouterLink, TranslocoPipe, DatePipe, PageState, SeverityBadge, VulnStatusBadge, DialogComponent],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (vuln(); as v) {
        <div class="flex flex-col gap-4">
          <section class="glass p-5 flex flex-col gap-4">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <h1 class="page-title">{{ v.title }}</h1>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                  <app-severity-badge [severity]="v.severity" />
                  <app-vuln-status-badge [status]="v.status" />
                  @if (v.isReappeared) { <b class="font-semibold text-warn">{{ 'vulns.reappeared' | transloco }}</b> }
                  <span>{{ v.projectName }} · <span class="font-mono">{{ host() }}</span></span>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                @if (closeOptions().length > 0) {
                  <button type="button" class="btn h-10" (click)="openClose()">{{ 'vulns.closeWithReason' | transloco }}</button>
                }
                @for (to of mainTransitions(); track to) {
                  <button type="button" class="btn h-10" [class]="to === 'Reopened' ? 'border-danger/40 text-danger hover:bg-danger-bg' : to === primary() ? 'btn-primary font-semibold' : ''"
                    (click)="startTransition(to)">
                    @if (to === primary()) {
                      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12l5 5 9-10" /></svg>
                    }
                    {{ 'vulns.to_' + to | transloco }}</button>
                }
              </div>
            </div>
            <ol class="grid grid-cols-3 md:grid-cols-6 gap-2" [attr.aria-label]="'vulns.lifecycle' | transloco">
              @for (st of lifecycle; track st; let i = $index) {
                <li class="flex flex-col gap-1.5 text-xs" [attr.aria-current]="v.status === st ? 'step' : null">
                  <span aria-hidden="true" class="h-1 rounded-full" [class]="v.status === st ? 'bg-accent' : i < stepIndex() ? 'bg-ink' : 'bg-ink/10'"></span>
                  <span [class]="v.status === st ? 'font-semibold' : i < stepIndex() ? '' : 'text-ink-muted'">{{ 'vulnStatus.' + st | transloco }}</span>
                </li>
              }
            </ol>
          </section>
          @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }
          @if (v.closeReason && (v.status === 'FalsePositive' || v.status === 'AcceptedRisk' || v.status === 'Reopened')) {
            <p class="px-4 py-3 rounded-xl bg-sev-info-bg text-sm"><b>{{ 'vulnStatus.' + v.status | transloco }}:</b> {{ v.closeReason }}
              @if (v.reviewAt) { · {{ 'vulns.reviewOn' | transloco: { date: (v.reviewAt | date: 'dd/MM/yyyy') } }} }</p>
          }

          <div class="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
            <div class="flex flex-col gap-4 min-w-0">
              <section class="glass p-5 flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h2 class="font-semibold">{{ 'vulns.evidence' | transloco }}</h2>
                  @if (v.latestFinding?.evidenceRedacted) {
                    <span class="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                      {{ 'vulns.redacted' | transloco }}</span>
                  }
                </div>
                @if (v.latestFinding; as f) {
                  <pre class="rounded-2xl bg-[#121519] text-white/90 p-4 font-mono text-xs leading-5 whitespace-pre-wrap break-all"><span class="text-[#ff8a65]">{{ f.url }}</span>
{{ f.evidenceSummary }}</pre>
                } @else {
                  <p class="text-sm text-ink-muted">{{ 'vulns.noEvidence' | transloco }}</p>
                }
              </section>

              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'vulns.comments' | transloco }} <span class="ml-1 text-sm font-normal text-ink-muted">{{ comments().length }}</span></h2>
                @for (c of comments(); track c.id) {
                  <article class="flex gap-3">
                    <span aria-hidden="true" class="grid place-items-center size-8 shrink-0 rounded-full bg-sev-medium-bg text-sev-medium text-[11px] font-bold">{{ initials(c.userName) }}</span>
                    <div class="flex-1 min-w-0 rounded-2xl p-3 text-sm" [class]="c.isAiNote ? 'bg-white/70 border border-line' : 'bg-ink/[.04]'">
                      <div class="flex flex-wrap gap-2 items-center mb-1">
                        <b class="font-semibold">{{ c.userName }}</b>
                        @if (c.isAiNote) { <span class="px-1.5 py-px rounded bg-ink/[.06] text-[11px] font-medium">✦ {{ 'ai.generatedTag' | transloco }}</span> }
                        <span class="text-xs text-ink-muted">{{ c.createdAt | date: 'dd/MM HH:mm' }}</span>
                      </div>
                      <p class="whitespace-pre-line">{{ c.content }}</p>
                    </div>
                  </article>
                } @empty {
                  <p class="text-sm text-ink-muted">{{ 'vulns.noComments' | transloco }}</p>
                }
                <form class="flex items-end gap-2" (ngSubmit)="addComment()">
                  <label class="sr-only" for="new-comment">{{ 'vulns.addComment' | transloco }}</label>
                  <textarea id="new-comment" name="comment" class="input flex-1 h-14 py-2" [ngModel]="newComment()" (ngModelChange)="newComment.set($event)"
                    [placeholder]="'vulns.addComment' | transloco"></textarea>
                  <button type="submit" class="btn btn-primary size-11 p-0 rounded-xl" [disabled]="!newComment().trim()" [attr.aria-label]="'vulns.send' | transloco">
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg>
                  </button>
                </form>
              </section>

              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'vulns.history' | transloco }}</h2>
                <ol class="flex flex-col gap-2.5">
                  @for (h of history(); track h.id) {
                    <li class="flex gap-3 text-sm">
                      <span aria-hidden="true" class="mt-1.5 size-2 shrink-0 rounded-full" [class]="h.changedByName ? 'bg-ink' : 'bg-run'"></span>
                      <span>
                        @if (h.oldStatus && h.newStatus && h.oldStatus !== h.newStatus) {
                          {{ 'vulnStatus.' + h.oldStatus | transloco }} → <b class="font-semibold">{{ 'vulnStatus.' + h.newStatus | transloco }}</b> ·
                        }
                        {{ h.summary }}
                        <span class="text-ink-muted"> · {{ h.createdAt | date: 'dd/MM HH:mm' }} · {{ h.changedByName ?? ('vulns.system' | transloco) }}</span>
                      </span>
                    </li>
                  }
                </ol>
              </section>
            </div>

            <aside class="flex flex-col gap-4">
              <section class="glass p-5 flex flex-col gap-3">
                <div>
                  <label class="block mb-1.5 text-[13px] text-ink-muted" for="assign-to">{{ 'vulns.assignee' | transloco }}</label>
                  @if (canTriage && isOpen()) {
                    <div class="flex gap-2">
                      <select id="assign-to" class="input" [ngModel]="assigneeId() ?? v.assigneeId" (ngModelChange)="assigneeId.set($event)" (focus)="loadAssignees()">
                        <option [ngValue]="null" disabled>{{ v.assigneeName ?? ('vulns.pickAssignee' | transloco) }}</option>
                        @if (v.assigneeId && assignees().length === 0) { <option [ngValue]="v.assigneeId">{{ v.assigneeName }}</option> }
                        @for (u of assignees(); track u.id) { <option [ngValue]="u.id">{{ u.fullName }} ({{ u.role }})</option> }
                      </select>
                      @if (assigneeId() && assigneeId() !== v.assigneeId) {
                        <button type="button" class="btn" (click)="assign()">{{ 'vulns.assign' | transloco }}</button>
                      }
                    </div>
                  } @else {
                    <p id="assign-to" class="text-sm">{{ v.assigneeName ?? ('vulns.unassigned' | transloco) }}</p>
                  }
                </div>
                <dl class="grid grid-cols-[124px_1fr] gap-x-3 gap-y-2 pt-3 border-t border-line text-[13px]">
                  <dt class="text-ink-muted">{{ 'vulns.type' | transloco }}</dt><dd class="break-all">{{ v.findingType }}</dd>
                  <dt class="text-ink-muted">{{ 'vulns.firstSeen' | transloco }}</dt><dd>{{ v.firstDetectedAt | date: 'dd/MM/yyyy' }}</dd>
                  <dt class="text-ink-muted">{{ 'vulns.lastSeen' | transloco }}</dt><dd>{{ v.lastDetectedAt | date: 'dd/MM/yyyy' }}</dd>
                  <dt class="text-ink-muted">{{ 'vulns.detected' | transloco }}</dt><dd>{{ 'vulns.inScans' | transloco: { count: v.occurrences } }}</dd>
                  <dt class="text-ink-muted">URL</dt><dd class="font-mono break-all">{{ v.url }}</dd>
                </dl>
              </section>

              @if (canAi) {
                <section class="glass p-5 flex flex-col gap-3">
                  <h2 class="flex items-center gap-2 font-semibold"><span aria-hidden="true">✦</span>{{ 'ai.advisorTitle' | transloco }}</h2>
                  <p class="text-sm text-ink-muted">{{ 'ai.advisorBody' | transloco }}</p>
                  <a routerLink="/ai-assistant" [queryParams]="{ vulnerabilityId: v.id }" class="btn-key h-12 p-0 rounded-xl font-semibold">{{ 'ai.analyze' | transloco }}</a>
                </section>
              }
            </aside>
          </div>
        </div>

        <app-dialog [open]="!!pending()" [heading]="pending() ? ((closing() ? 'vulns.closeWithReason' : 'vulns.to_' + pending()) | transloco) : ''" (closed)="pending.set(null)">
          <form class="flex flex-col gap-3" (ngSubmit)="confirmTransition()">
            @if (closing()) {
              <fieldset class="grid gap-2">
                <legend class="label">{{ 'vulns.closeAs' | transloco }}</legend>
                @for (o of closeOptions(); track o) {
                  <label class="flex items-start gap-2.5 rounded-xl border p-3 text-sm cursor-pointer" [class]="pending() === o ? 'border-ink bg-white' : 'border-line'">
                    <input type="radio" name="closeAs" class="mt-0.5 accent-ink" [value]="o" [ngModel]="pending()" (ngModelChange)="pending.set($event)" />
                    <span><b class="font-medium">{{ 'vulnStatus.' + o | transloco }}</b><br /><span class="text-ink-muted">{{ 'vulns.closeHint_' + o | transloco }}</span></span>
                  </label>
                }
              </fieldset>
            }
            <label class="label" for="reason">{{ 'vulns.reason' | transloco }} *</label>
            <textarea id="reason" name="reason" class="input h-24 py-2" required aria-describedby="reason-hint" [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
            @if (minReason() > 0) {
              <p id="reason-hint" class="text-xs" [class]="reason().trim().length < minReason() ? 'text-warn' : 'text-ok'">
                {{ 'vulns.reasonMin' | transloco: { min: minReason(), count: reason().trim().length } }}</p>
            }
            @if (pending() === 'AcceptedRisk') {
              <label class="label" for="review">{{ 'vulns.reviewDate' | transloco }} *</label>
              <input id="review" name="review" type="date" class="input" required [ngModel]="reviewAt()" (ngModelChange)="reviewAt.set($event)" />
            }
            @if (closing()) { <p class="text-xs text-ink-muted">{{ 'vulns.fingerprintNote' | transloco }}</p> }
            <div class="flex justify-end gap-2">
              <button type="button" class="btn" (click)="pending.set(null)">{{ 'common.cancel' | transloco }}</button>
              <button type="submit" class="btn btn-primary" [disabled]="reason().trim().length < Math.max(1, minReason()) || (pending() === 'AcceptedRisk' && !reviewAt())">{{ 'common.save' | transloco }}</button>
            </div>
          </form>
        </app-dialog>
      }
    </app-page-state>
  `,
})
export class VulnDetailPage implements OnInit {
  private readonly api = inject(VulnerabilitiesApi);
  private readonly auth = inject(AuthService);
  protected readonly canTriage = this.auth.hasPermission('Vulnerability.Triage');
  protected readonly canAi = this.auth.hasPermission('AI.Ask');
  protected readonly lifecycle = LIFECYCLE;

  readonly id = input.required<string>();
  protected readonly vuln = signal<VulnerabilityDetail | null>(null);
  protected readonly comments = signal<VulnerabilityComment[]>([]);
  protected readonly history = signal<VulnerabilityHistory[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly newComment = signal('');
  protected readonly pending = signal<VulnerabilityStatus | null>(null);
  protected readonly reason = signal('');
  protected readonly reviewAt = signal('');
  protected readonly Math = Math;
  /** Same rule as the server (VulnerabilityService.MinCloseReason): closing without a fix needs a real justification. */
  protected readonly minReason = computed(() => (this.pending() === 'FalsePositive' || this.pending() === 'AcceptedRisk' ? 20 : 0));
  protected readonly assignees = signal<UserLookup[]>([]);
  protected readonly assigneeId = signal<string | null>(null);
  /** FP / Accepted Risk sit behind one "close with reason" button (W09); the rest are direct buttons. */
  protected readonly closeOptions = computed(() => (this.vuln()?.allowedTransitions ?? []).filter((t) => CLOSE_AS.includes(t)));
  protected readonly mainTransitions = computed(() => (this.vuln()?.allowedTransitions ?? []).filter((t) => !CLOSE_AS.includes(t)));
  protected readonly primary = computed(() => [...this.mainTransitions()].reverse().find((t) => t !== 'Reopened') ?? null);
  protected readonly closing = computed(() => CLOSE_AS.includes(this.pending() ?? 'Open'));
  protected readonly host = computed(() => {
    try { return new URL(this.vuln()?.targetBaseUrl ?? '').host; } catch { return this.vuln()?.targetBaseUrl ?? ''; }
  });
  protected readonly stepIndex = computed(() => LIFECYCLE.indexOf(this.vuln()?.status ?? 'Open'));
  protected readonly isOpen = computed(() => !['Resolved', 'FalsePositive', 'AcceptedRisk'].includes(this.vuln()?.status ?? 'Resolved'));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getById(this.id()).subscribe({
      next: (res) => {
        this.vuln.set(res.data);
        this.loading.set(false);
        this.loadSide();
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  protected openClose(): void {
    this.startTransition(this.closeOptions()[0]);
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
  }

  protected startTransition(to: VulnerabilityStatus): void {
    if (NEEDS_REASON.includes(to)) {
      this.reason.set('');
      this.reviewAt.set('');
      this.pending.set(to);
    } else {
      this.apply(to);
    }
  }

  protected confirmTransition(): void {
    const to = this.pending();
    if (!to) return;
    this.pending.set(null);
    this.apply(to, this.reason().trim(), this.reviewAt() ? new Date(this.reviewAt()).toISOString() : null);
  }

  protected loadAssignees(): void {
    if (this.assignees().length === 0) this.api.getAssignees().subscribe({ next: (r) => this.assignees.set(r.data ?? []) });
  }

  protected assign(): void {
    const to = this.assigneeId();
    if (!to) return;
    this.actionError.set(null);
    this.api.assign([this.id()], to).subscribe({ next: () => this.load(), error: (err) => this.actionError.set(apiErrorMessage(err)) });
  }

  protected addComment(): void {
    const text = this.newComment().trim();
    if (!text) return;
    this.api.addComment(this.id(), text).subscribe({
      next: (r) => { if (r.data) this.comments.update((c) => [...c, r.data!]); this.newComment.set(''); },
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  private apply(to: VulnerabilityStatus, reason: string | null = null, reviewAt: string | null = null): void {
    this.actionError.set(null);
    this.api.updateStatus({ id: this.id(), status: to, reason, reviewAt }).subscribe({
      next: (r) => { this.vuln.set(r.data); this.loadSide(); },
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  private loadSide(): void {
    this.api.getComments(this.id()).subscribe({ next: (r) => this.comments.set(r.data ?? []) });
    this.api.getHistory(this.id()).subscribe({ next: (r) => this.history.set(r.data ?? []) });
  }
}
