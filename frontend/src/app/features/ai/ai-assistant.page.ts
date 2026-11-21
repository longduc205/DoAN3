import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge } from '../../shared/components/badges';
import { AiAdvice, AiContext, Vulnerability } from '../../shared/models/api.models';
import { AiApi, VulnerabilitiesApi } from '../api.services';

interface Turn { id: number; question: string; state: 'loading' | 'done' | 'error'; advice?: AiAdvice; error?: string; saved?: boolean; copied?: boolean }

const SUGGESTIONS = ['ai.suggestExplain', 'ai.suggestFix', 'ai.suggestVerify'];

// W10 AI Security Assistant (secondary entry; the main one is the panel on the vulnerability page).
// A vulnerability must be picked as context before asking. AI output is advisory: it can only be copied or saved as a labelled note.
// shortcut: the conversation lives in memory only (no ai_conversations table); persist it when history is needed.
@Component({
  selector: 'app-ai-assistant',
  imports: [FormsModule, RouterLink, TranslocoPipe, SeverityBadge],
  template: `
    <div class="flex flex-col gap-5">
      <div>
        <h1 class="page-title">{{ 'nav.aiAssistant' | transloco }}</h1>
        <p class="mt-1 text-sm text-ink-muted">{{ 'ai.assistantSubtitle' | transloco }}</p>
      </div>

      <div class="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
        <aside class="glass p-5 flex flex-col gap-4">
          <div>
            <label class="label" for="ctx">{{ 'ai.pickContext' | transloco }}</label>
            <select id="ctx" class="input" [ngModel]="vulnId()" (ngModelChange)="pick($event)">
              <option [ngValue]="null" disabled>{{ 'ai.pickContextPh' | transloco }}</option>
              @for (v of vulns(); track v.id) { <option [ngValue]="v.id">[{{ v.severity }}] {{ v.title }} · {{ v.projectName }} / {{ v.targetName }}</option> }
            </select>
            @if (vulns().length === 0 && !loadingVulns()) { <p class="text-xs text-ink-muted mt-1">{{ 'ai.noContext' | transloco }}</p> }
          </div>
          @if (selected(); as v) {
            <div class="flex flex-wrap items-center gap-2">
              <app-severity-badge [severity]="v.severity" />
              <a [routerLink]="['/vulnerabilities', v.id]" class="text-sm underline">{{ 'ai.backToVuln' | transloco }}</a>
            </div>
          }
          @if (context(); as c) {
            <section class="flex flex-col gap-2">
              <h2 class="text-sm font-semibold">{{ 'ai.contextTitle' | transloco }}</h2>
              <dl class="rounded-xl bg-white/70 p-3 text-xs flex flex-col gap-1">
                <div><dt class="inline text-ink-muted">{{ 'vulns.type' | transloco }}: </dt><dd class="inline">{{ c.findingType }}</dd></div>
                <div><dt class="inline text-ink-muted">URL: </dt><dd class="inline break-all">{{ c.url }}</dd></div>
                <div><dt class="inline text-ink-muted">{{ 'vulns.severity' | transloco }}: </dt><dd class="inline">{{ c.severity }}</dd></div>
                <div><dt class="text-ink-muted">{{ 'vulns.evidence' | transloco }}:</dt><dd class="font-mono whitespace-pre-wrap break-all">{{ c.evidenceSummary }}</dd></div>
              </dl>
              <p class="text-xs text-ink-muted">{{ 'ai.neverSent' | transloco }}</p>
            </section>
          }
        </aside>

        <section class="glass p-5 flex flex-col gap-4 min-h-[480px]" aria-live="polite">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold">{{ 'ai.panelTitle' | transloco }}</h2>
            <span class="mono px-1.5 border border-line rounded">{{ 'ai.generatedTag' | transloco }}</span>
          </div>
          <p class="text-xs text-ink-muted">{{ 'ai.disclaimer' | transloco }}</p>

          <div class="flex-1 flex flex-col gap-4">
            @for (t of turns(); track t.id) {
              <div class="self-end max-w-[85%] rounded-2xl rounded-br-md bg-ink text-white px-4 py-2 text-sm whitespace-pre-line">{{ t.question }}</div>
              @switch (t.state) {
                @case ('loading') {
                  <div class="flex items-center gap-3 text-sm text-ink-muted" role="status">
                    <span>{{ 'ai.loadingLong' | transloco }}</span>
                    <button type="button" class="btn h-8" (click)="stop(t)">{{ 'ai.stop' | transloco }}</button>
                  </div>
                }
                @case ('error') {
                  <div role="alert" class="rounded-xl bg-danger-bg text-danger text-sm p-3 flex flex-wrap items-center gap-3">
                    <span class="flex-1">{{ t.error! | transloco }} {{ 'ai.nothingChanged' | transloco }}</span>
                    <button type="button" class="btn h-8" (click)="retry(t)">{{ 'common.retry' | transloco }}</button>
                  </div>
                }
                @case ('done') {
                  <article class="max-w-[95%] rounded-2xl rounded-bl-md bg-sev-info-bg border border-line p-4 text-sm flex flex-col gap-2">
                    <span class="mono px-1.5 border border-line rounded self-start">{{ 'ai.generatedTag' | transloco }}</span>
                    <p class="whitespace-pre-line">{{ t.advice!.content }}</p>
                    <p class="mono">{{ t.advice!.provider }} · {{ t.advice!.model }}</p>
                    <div class="flex gap-2">
                      <button type="button" class="btn h-8" (click)="copy(t)">{{ (t.copied ? 'ai.copied' : 'ai.copy') | transloco }}</button>
                      <button type="button" class="btn h-8" [disabled]="t.saved" (click)="saveNote(t)">{{ (t.saved ? 'ai.noteSaved' : 'ai.saveNote') | transloco }}</button>
                    </div>
                  </article>
                }
              }
            } @empty {
              <div class="flex flex-col gap-3 items-start">
                <p class="text-sm">{{ (vulnId() ? 'ai.emptyPrompt' : 'ai.pickFirst') | transloco }}</p>
                @if (vulnId()) {
                  <div class="flex flex-wrap gap-2">
                    @for (s of suggestions; track s) {
                      <button type="button" class="btn h-9" (click)="askSuggestion(s)">{{ s | transloco }}</button>
                    }
                  </div>
                }
              </div>
            }
          </div>
          @if (actionError()) { <div role="alert" class="px-3 py-2 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }

          <form class="flex flex-col gap-2 border-t border-line pt-4" (ngSubmit)="ask(draft())">
            <label class="sr-only" for="question">{{ 'ai.questionLabel' | transloco }}</label>
            <textarea id="question" name="question" class="input h-20 py-2" maxlength="1000" [disabled]="!vulnId()"
              [placeholder]="'ai.questionLabel' | transloco" [ngModel]="draft()" (ngModelChange)="draft.set($event)"
              (keydown.enter)="onEnter($event)"></textarea>
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-ink-muted">{{ 'ai.readOnlyNote' | transloco }}</span>
              <button type="submit" class="btn btn-primary" [disabled]="!vulnId() || !draft().trim() || busy()">{{ 'vulns.send' | transloco }}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  `,
})
export class AiAssistantPage implements OnInit {
  private readonly aiApi = inject(AiApi);
  private readonly vulnApi = inject(VulnerabilitiesApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  protected readonly suggestions = SUGGESTIONS;

  /** Optional ?vulnerabilityId= from the vulnerability page. */
  readonly vulnerabilityId = input<string | undefined>(undefined);
  protected readonly vulns = signal<Vulnerability[]>([]);
  protected readonly loadingVulns = signal(true);
  protected readonly vulnId = signal<string | null>(null);
  protected readonly context = signal<AiContext | null>(null);
  protected readonly turns = signal<Turn[]>([]);
  protected readonly draft = signal('');
  protected readonly actionError = signal<string | null>(null);
  protected readonly selected = computed(() => this.vulns().find((v) => v.id === this.vulnId()) ?? null);
  protected readonly busy = computed(() => this.turns().some((t) => t.state === 'loading'));
  private seq = 0;
  private pending: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.pending?.unsubscribe());
  }

  ngOnInit(): void {
    this.vulnApi.getAll({ pageSize: 100, isOpen: true, sortBy: 'severity', sortDirection: 'Desc' }).subscribe({
      next: (r) => {
        this.vulns.set(r.data ?? []);
        this.loadingVulns.set(false);
        const id = this.vulnerabilityId();
        if (id && this.vulns().some((v) => v.id === id)) this.pick(id);
      },
      error: (err) => {
        this.actionError.set(apiErrorMessage(err));
        this.loadingVulns.set(false);
      },
    });
  }

  protected pick(id: string): void {
    this.pending?.unsubscribe();
    this.vulnId.set(id);
    this.turns.set([]); // a new context starts a new conversation
    this.context.set(null);
    this.aiApi.getContext({ vulnerabilityId: id }).subscribe({ next: (r) => this.context.set(r.data), error: (err) => this.actionError.set(apiErrorMessage(err)) });
  }

  protected onEnter(e: Event): void {
    const k = e as KeyboardEvent;
    if (k.shiftKey || k.isComposing) return; // Shift+Enter = newline; don't submit mid-IME composition (Vietnamese input)
    k.preventDefault();
    this.ask(this.draft());
  }

  protected ask(question: string): void {
    const q = question.trim();
    const id = this.vulnId();
    if (!q || !id || this.busy()) return;
    this.draft.set('');
    const turn: Turn = { id: ++this.seq, question: q, state: 'loading' };
    this.turns.update((list) => [...list, turn]);
    this.run(turn, id);
  }

  protected askSuggestion(key: string): void {
    this.ask(this.transloco.translate(key));
  }

  protected stop(t: Turn): void {
    this.pending?.unsubscribe();
    this.patch(t.id, { state: 'error', error: 'ai.stopped' });
  }

  protected retry(t: Turn): void {
    const id = this.vulnId();
    if (!id || this.busy()) return;
    this.patch(t.id, { state: 'loading', error: undefined });
    this.run(t, id);
  }

  protected copy(t: Turn): void {
    navigator.clipboard?.writeText(t.advice?.content ?? '').then(() => this.patch(t.id, { copied: true }), () => undefined);
  }

  /** D5: AI output can only become a labelled comment on the vulnerability; it never changes status or severity. */
  protected saveNote(t: Turn): void {
    const id = this.vulnId();
    if (!id || !t.advice) return;
    this.vulnApi.addComment(id, t.advice.content, true).subscribe({
      next: () => this.patch(t.id, { saved: true }),
      error: (err) => this.actionError.set(apiErrorMessage(err)),
    });
  }

  private run(t: Turn, vulnerabilityId: string): void {
    this.pending = this.aiApi.ask(vulnerabilityId, t.question).subscribe({
      next: (r) => this.patch(t.id, r.data ? { state: 'done', advice: r.data } : { state: 'error', error: 'errors.unknown' }),
      error: (err) => this.patch(t.id, { state: 'error', error: apiErrorMessage(err) }),
    });
  }

  private patch(id: number, change: Partial<Turn>): void {
    this.turns.update((list) => list.map((x) => (x.id === id ? { ...x, ...change } : x)));
  }
}
