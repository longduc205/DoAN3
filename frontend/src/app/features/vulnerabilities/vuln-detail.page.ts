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
import {
  AiAdvice, AiContext, UserLookup, VulnerabilityComment, VulnerabilityDetail, VulnerabilityHistory, VulnerabilityStatus,
} from '../../shared/models/api.models';
import { AiApi, VulnerabilitiesApi } from '../api.services';

const LIFECYCLE: VulnerabilityStatus[] = ['Open', 'Triaged', 'Assigned', 'InProgress', 'PendingVerification', 'Resolved'];
// Mirrors VulnerabilityStateMachine.RequiresReason on the server (which enforces it).
const NEEDS_REASON: VulnerabilityStatus[] = ['PendingVerification', 'Resolved', 'Reopened', 'FalsePositive', 'AcceptedRisk'];
type AiState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'done'; advice: AiAdvice };

// W09 Vulnerability detail + W10 AI panel. Buttons come from allowedTransitions, so the UI never offers a move the server rejects.
@Component({
  selector: 'app-vuln-detail',
  imports: [FormsModule, RouterLink, TranslocoPipe, DatePipe, PageState, SeverityBadge, VulnStatusBadge, DialogComponent],
  template: `
    <app-page-state [loading]="loading()" [error]="error()" (retry)="load()">
      @if (vuln(); as v) {
        <div class="flex flex-col gap-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <app-severity-badge [severity]="v.severity" />
                <app-vuln-status-badge [status]="v.status" [reappeared]="v.isReappeared" />
              </div>
              <h1 class="page-title mt-2">{{ v.title }}</h1>
              <p class="mono mt-1 break-all">{{ v.projectName }} · {{ v.targetName }} · {{ v.url }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              @for (to of v.allowedTransitions; track to) {
                <button type="button" class="btn h-10" [class.btn-primary]="isPrimary(to)" (click)="startTransition(to)">{{ 'vulns.to_' + to | transloco }}</button>
              }
            </div>
          </div>
          @if (actionError()) { <div role="alert" class="px-4 py-3 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }

          <ol class="flex flex-wrap gap-1.5" [attr.aria-label]="'vulns.lifecycle' | transloco">
            @for (s of lifecycle; track s; let i = $index) {
              <li class="px-3 py-1.5 rounded-full text-xs" [attr.aria-current]="v.status === s ? 'step' : null"
                [class]="v.status === s ? 'bg-ink text-white font-semibold' : i < stepIndex() ? 'bg-ok-bg text-ok' : 'bg-black/5 text-ink-muted'">{{ 'vulnStatus.' + s | transloco }}</li>
            }
          </ol>
          @if (v.closeReason && (v.status === 'FalsePositive' || v.status === 'AcceptedRisk' || v.status === 'Reopened')) {
            <p class="px-4 py-3 rounded-xl bg-sev-info-bg text-sm"><b>{{ 'vulnStatus.' + v.status | transloco }}:</b> {{ v.closeReason }}
              @if (v.reviewAt) { · {{ 'vulns.reviewOn' | transloco: { date: (v.reviewAt | date: 'dd/MM/yyyy') } }} }</p>
          }

          <div class="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
            <div class="flex flex-col gap-5 min-w-0">
              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'vulns.evidence' | transloco }}</h2>
                @if (v.latestFinding; as f) {
                  <pre class="rounded-xl bg-ink text-white/90 p-4 text-xs whitespace-pre-wrap break-all">{{ f.evidenceSummary }}</pre>
                  @if (f.evidenceRedacted) { <p class="mono">{{ 'vulns.redacted' | transloco }}</p> }
                }
                <dl class="grid grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                  <div><dt class="text-xs text-ink-muted">{{ 'vulns.type' | transloco }}</dt><dd class="break-all">{{ v.findingType }}</dd></div>
                  <div><dt class="text-xs text-ink-muted">{{ 'vulns.firstSeen' | transloco }}</dt><dd>{{ v.firstDetectedAt | date: 'dd/MM/yyyy' }}</dd></div>
                  <div><dt class="text-xs text-ink-muted">{{ 'vulns.lastSeen' | transloco }}</dt><dd>{{ v.lastDetectedAt | date: 'dd/MM/yyyy' }}</dd></div>
                  <div><dt class="text-xs text-ink-muted">{{ 'vulns.occurrences' | transloco }}</dt><dd>{{ v.occurrences }}</dd></div>
                </dl>
              </section>

              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'vulns.comments' | transloco }}</h2>
                @for (c of comments(); track c.id) {
                  <article class="rounded-xl p-3 text-sm" [class]="c.isAiNote ? 'bg-sev-info-bg border border-line' : 'bg-white/70'">
                    <div class="flex flex-wrap gap-2 items-center mb-1">
                      <b class="font-medium">{{ c.userName }}</b>
                      @if (c.isAiNote) { <span class="mono px-1.5 border border-line rounded">{{ 'ai.generatedTag' | transloco }}</span> }
                      <span class="mono">{{ c.createdAt | date: 'dd/MM HH:mm' }}</span>
                    </div>
                    <p class="whitespace-pre-line">{{ c.content }}</p>
                  </article>
                } @empty {
                  <p class="text-sm text-ink-muted">{{ 'vulns.noComments' | transloco }}</p>
                }
                <form class="flex flex-col gap-2" (ngSubmit)="addComment()">
                  <label class="sr-only" for="new-comment">{{ 'vulns.addComment' | transloco }}</label>
                  <textarea id="new-comment" name="comment" class="input h-20 py-2" [ngModel]="newComment()" (ngModelChange)="newComment.set($event)"
                    [placeholder]="'vulns.addComment' | transloco"></textarea>
                  <button type="submit" class="btn self-end" [disabled]="!newComment().trim()">{{ 'vulns.send' | transloco }}</button>
                </form>
              </section>

              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'vulns.history' | transloco }}</h2>
                <ol class="flex flex-col gap-3 border-l-2 border-line pl-4">
                  @for (h of history(); track h.id) {
                    <li class="text-sm">
                      <div class="flex flex-wrap gap-2 items-center">
                        @if (h.oldStatus && h.newStatus && h.oldStatus !== h.newStatus) {
                          <span>{{ 'vulnStatus.' + h.oldStatus | transloco }} → <b>{{ 'vulnStatus.' + h.newStatus | transloco }}</b></span>
                        }
                        <span class="mono">{{ h.createdAt | date: 'dd/MM HH:mm' }} · {{ h.changedByName ?? ('vulns.system' | transloco) }}</span>
                      </div>
                      <p class="text-ink-muted">{{ h.summary }}</p>
                    </li>
                  }
                </ol>
              </section>
            </div>

            <aside class="flex flex-col gap-5">
              <section class="glass p-5 flex flex-col gap-3">
                <h2 class="font-semibold">{{ 'vulns.assignee' | transloco }}</h2>
                <p class="text-sm">{{ v.assigneeName ?? ('vulns.unassigned' | transloco) }}</p>
                @if (canTriage && isOpen()) {
                  <div class="flex gap-2">
                    <label class="sr-only" for="assign-to">{{ 'vulns.assignTo' | transloco }}</label>
                    <select id="assign-to" class="input" [ngModel]="assigneeId()" (ngModelChange)="assigneeId.set($event)" (focus)="loadAssignees()">
                      <option [ngValue]="null" disabled>{{ 'vulns.pickAssignee' | transloco }}</option>
                      @for (u of assignees(); track u.id) { <option [ngValue]="u.id">{{ u.fullName }} · {{ u.role }}</option> }
                    </select>
                    <button type="button" class="btn" [disabled]="!assigneeId()" (click)="assign()">{{ 'vulns.assign' | transloco }}</button>
                  </div>
                }
              </section>

              @if (canAi) {
                <section class="glass p-5 flex flex-col gap-3" aria-live="polite">
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="font-semibold">{{ 'ai.panelTitle' | transloco }}</h2>
                    <span class="mono px-1.5 border border-line rounded">{{ 'ai.generatedTag' | transloco }}</span>
                  </div>
                  <p class="text-xs text-ink-muted">{{ 'ai.disclaimer' | transloco }}</p>
                  <a routerLink="/ai-assistant" [queryParams]="{ vulnerabilityId: v.id }" class="text-sm underline self-start">{{ 'ai.openAssistant' | transloco }}</a>
                  @if (aiContext(); as c) {
                    <details class="rounded-xl bg-white/70 p-3 text-xs">
                      <summary class="cursor-pointer font-medium">{{ 'ai.contextTitle' | transloco }}</summary>
                      <dl class="mt-2 flex flex-col gap-1">
                        <div><dt class="inline text-ink-muted">{{ 'vulns.type' | transloco }}: </dt><dd class="inline">{{ c.findingType }}</dd></div>
                        <div><dt class="inline text-ink-muted">URL: </dt><dd class="inline break-all">{{ c.url }}</dd></div>
                        <div><dt class="inline text-ink-muted">{{ 'vulns.severity' | transloco }}: </dt><dd class="inline">{{ c.severity }}</dd></div>
                        <div><dt class="text-ink-muted">{{ 'vulns.evidence' | transloco }}:</dt><dd class="font-mono whitespace-pre-wrap break-all">{{ c.evidenceSummary }}</dd></div>
                      </dl>
                      <p class="mt-2 text-ink-muted">{{ 'ai.neverSent' | transloco }}</p>
                    </details>
                  }
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn btn-primary" [disabled]="ai().kind === 'loading'" (click)="askAi('explain')">{{ 'ai.explain' | transloco }}</button>
                    <button type="button" class="btn" [disabled]="ai().kind === 'loading'" (click)="askAi('remediate')">{{ 'ai.remediate' | transloco }}</button>
                  </div>
                  @switch (ai().kind) {
                    @case ('loading') { <p class="text-sm text-ink-muted" role="status">{{ 'ai.loading' | transloco }}</p> }
                    @case ('error') {
                      <div role="alert" class="rounded-xl bg-danger-bg text-danger text-sm p-3">{{ aiError() | transloco }}</div>
                    }
                    @case ('done') {
                      @if (aiAdvice(); as a) {
                        <div class="rounded-xl bg-sev-info-bg border border-line p-3 text-sm flex flex-col gap-2">
                          <p class="whitespace-pre-line">{{ a.content }}</p>
                          <p class="mono">{{ a.provider }} · {{ a.model }}</p>
                          <div class="flex gap-2">
                            <button type="button" class="btn h-8" (click)="copy(a.content)">{{ (copied() ? 'ai.copied' : 'ai.copy') | transloco }}</button>
                            <button type="button" class="btn h-8" [disabled]="savedNote()" (click)="saveNote(a.content)">
                              {{ (savedNote() ? 'ai.noteSaved' : 'ai.saveNote') | transloco }}</button>
                          </div>
                        </div>
                      }
                    }
                  }
                </section>
              }
            </aside>
          </div>
        </div>

        <app-dialog [open]="!!pending()" [heading]="pending() ? ('vulns.to_' + pending() | transloco) : ''" (closed)="pending.set(null)">
          <form class="flex flex-col gap-3" (ngSubmit)="confirmTransition()">
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
  private readonly aiApi = inject(AiApi);
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
  protected readonly aiContext = signal<AiContext | null>(null);
  protected readonly ai = signal<AiState>({ kind: 'idle' });
  protected readonly aiAdvice = computed(() => { const s = this.ai(); return s.kind === 'done' ? s.advice : null; });
  protected readonly aiError = computed(() => { const s = this.ai(); return s.kind === 'error' ? s.message : ''; });
  protected readonly savedNote = signal(false);
  protected readonly copied = signal(false);
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

  protected isPrimary(to: VulnerabilityStatus): boolean {
    return to !== 'FalsePositive' && to !== 'AcceptedRisk' && to !== 'Reopened';
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

  protected askAi(kind: 'explain' | 'remediate'): void {
    this.ai.set({ kind: 'loading' });
    this.savedNote.set(false);
    const ref = { vulnerabilityId: this.id() };
    (kind === 'explain' ? this.aiApi.explain(ref) : this.aiApi.suggestRemediation(ref)).subscribe({
      next: (r) => this.ai.set(r.data ? { kind: 'done', advice: r.data } : { kind: 'error', message: 'errors.unknown' }),
      error: (err) => this.ai.set({ kind: 'error', message: apiErrorMessage(err) }),
    });
  }

  /** D5: the AI result can only become a labelled comment; it never changes status or severity. */
  protected saveNote(content: string): void {
    this.api.addComment(this.id(), content, true).subscribe({
      next: (r) => { if (r.data) this.comments.update((c) => [...c, r.data!]); this.savedNote.set(true); },
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  protected copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.copied.set(true), () => undefined);
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
    if (this.canAi && !this.aiContext()) this.aiApi.getContext({ vulnerabilityId: this.id() }).subscribe({ next: (r) => this.aiContext.set(r.data) });
  }
}
