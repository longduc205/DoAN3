import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { apiErrorMessage } from '../../core/services/base-api.service';
import { SeverityBadge, VulnStatusBadge } from '../../shared/components/badges';
import { AiAdvice, AiContext, Vulnerability } from '../../shared/models/api.models';
import { AiApi, VulnerabilitiesApi } from '../api.services';

interface Turn { id: number; question: string; state: 'loading' | 'done' | 'error'; advice?: AiAdvice; error?: string; saved?: boolean; copied?: boolean }

const SUGGESTIONS = ['ai.suggestExplain', 'ai.suggestFix', 'ai.suggestVerify'];

// W10 AI Security Assistant (secondary entry; the main one is the panel on the vulnerability page).
// A vulnerability must be picked as context before asking. AI output is advisory: it can only be copied or saved as a labelled note.
// shortcut: the conversation lives in memory only (no ai_conversations table); persist it when history is needed.
@Component({
  selector: 'app-ai-assistant',
  imports: [FormsModule, RouterLink, TranslocoPipe, SeverityBadge, VulnStatusBadge],
  template: `
    <h1 class="sr-only">{{ 'nav.aiAssistant' | transloco }}</h1>
    <div class="grid lg:grid-cols-[360px_1fr] gap-4 items-start">
      <aside class="flex flex-col gap-4">
        <section class="glass p-5 flex flex-col gap-2.5">
          @if (selected(); as v) {
            <span class="text-[13px] font-medium text-ink-muted">{{ 'ai.analyzing' | transloco }}</span>
            <h2 class="text-lg font-semibold leading-snug">{{ v.title }}</h2>
            <div class="flex flex-wrap gap-2"><app-severity-badge [severity]="v.severity" /><app-vuln-status-badge [status]="v.status" /></div>
            <a [routerLink]="['/vulnerabilities', v.id]" class="self-start text-sm hover:underline">{{ 'ai.backToVuln' | transloco }}</a>
          }
          <label class="text-[13px] text-ink-muted" [class.pt-2]="selected()" [class.border-t]="selected()" [class.border-line]="selected()" for="ctx">
            {{ (selected() ? 'ai.changeContext' : 'ai.pickContext') | transloco }}</label>
          <select id="ctx" class="input" [ngModel]="vulnId()" (ngModelChange)="pick($event)">
            <option [ngValue]="null" disabled>{{ 'ai.pickContextPh' | transloco }}</option>
            @for (v of vulns(); track v.id) { <option [ngValue]="v.id">[{{ v.severity }}] {{ v.title }} · {{ v.projectName }}</option> }
          </select>
          @if (vulns().length === 0 && !loadingVulns()) { <p class="text-xs text-ink-muted">{{ 'ai.noContext' | transloco }}</p> }
        </section>

        @if (context(); as c) {
          <section class="glass p-5 flex flex-col gap-3">
            <h2 class="font-semibold">{{ 'ai.contextTitle' | transloco }}</h2>
            <ul class="flex flex-col gap-2.5 text-sm">
              @for (row of [
                { k: 'vulns.type', v: c.findingType + ' · ' + c.severity, mono: false },
                { k: 'ai.ctxUrl', v: c.url, mono: true },
                { k: 'ai.ctxEvidence', v: c.evidenceSummary, mono: true }
              ]; track row.k) {
                <li class="flex gap-2.5">
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="mt-0.5 shrink-0 text-ok"><path d="M5 12l5 5 9-10" /></svg>
                  <span class="min-w-0"><span class="block">{{ row.k | transloco }}</span>
                    <span class="block text-xs text-ink-muted break-all line-clamp-3" [class.font-mono]="row.mono">{{ row.v }}</span></span>
                </li>
              }
            </ul>
            <p class="flex gap-2.5 p-3 rounded-xl bg-danger-bg text-danger text-[13px]">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></svg>
              <span>{{ 'ai.neverSent' | transloco }}</span>
            </p>
          </section>
        }
      </aside>

      <section class="glass overflow-hidden flex flex-col min-h-[560px]" aria-live="polite">
        <header class="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line bg-white/40">
          <span aria-hidden="true" class="text-lg">✦</span>
          <span class="flex-1 min-w-0"><b class="block font-semibold">{{ 'ai.advisorTitle' | transloco }}</b>
            <span class="block text-xs text-ink-muted">{{ 'ai.onlyLeftData' | transloco }}</span></span>
          <span class="px-2.5 py-1 rounded-full bg-white ring-1 ring-line text-xs font-semibold">{{ 'ai.mayBeWrong' | transloco }}</span>
        </header>

        <div class="flex-1 flex flex-col gap-4 p-5">
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
                <article class="max-w-[95%] rounded-2xl rounded-bl-md bg-white/80 ring-1 ring-line p-4 text-sm flex flex-col gap-2">
                  <span class="self-start px-1.5 py-px rounded bg-ink/[.06] text-[11px] font-medium">✦ {{ 'ai.generatedTag' | transloco }}</span>
                  <p class="whitespace-pre-line">{{ t.advice!.content }}</p>
                  <p class="text-xs text-ink-muted">{{ 'ai.disclaimer' | transloco }} · <span class="font-mono">{{ t.advice!.provider }} · {{ t.advice!.model }}</span></p>
                  <div class="flex gap-2">
                    <button type="button" class="btn h-8" (click)="copy(t)">{{ (t.copied ? 'ai.copied' : 'ai.copy') | transloco }}</button>
                    <button type="button" class="btn h-8" [disabled]="t.saved" (click)="saveNote(t)">{{ (t.saved ? 'ai.noteSaved' : 'ai.saveNote') | transloco }}</button>
                  </div>
                </article>
              }
            }
          } @empty {
            <div class="flex flex-col items-center gap-1 pt-6 text-center">
              <h2 class="text-lg font-semibold">{{ (vulnId() ? 'ai.idleTitle' : 'ai.pickFirst') | transloco }}</h2>
              @if (vulnId()) {
                <p class="text-sm text-ink-muted">{{ 'ai.idleSub' | transloco }}</p>
                <div class="mt-4 w-full grid md:grid-cols-3 gap-3 text-left">
                  @for (s of suggestions; track s) {
                    <button type="button" class="rounded-2xl ring-1 ring-line bg-white/70 p-4 text-left cursor-pointer hover:bg-white" (click)="askSuggestion(s)">
                      <b class="block text-sm font-semibold">{{ s + 'Title' | transloco }}</b>
                      <span class="block mt-1 text-xs text-ink-muted">{{ s + 'Sub' | transloco }}</span>
                    </button>
                  }
                </div>
              }
            </div>
          }
          @if (actionError()) { <div role="alert" class="px-3 py-2 rounded-xl bg-danger-bg text-danger text-sm">{{ actionError()! | transloco }}</div> }
        </div>

        <form class="flex items-center gap-3 px-5 py-4 border-t border-line" (ngSubmit)="ask(draft())">
          <label class="flex-1 min-w-0 flex items-center gap-2 h-12 px-3 rounded-xl border border-line bg-white/85 focus-within:border-focus">
            @if (selected(); as v) { <span class="max-w-[30%] truncate px-2 py-0.5 rounded-md bg-ink/[.06] font-mono text-xs font-semibold">{{ v.findingType }}</span> }
            <span class="sr-only">{{ 'ai.questionLabel' | transloco }}</span>
            <input id="question" name="question" class="flex-1 min-w-0 bg-transparent text-sm outline-none" maxlength="1000" autocomplete="off" [disabled]="!vulnId()"
              [placeholder]="'ai.questionPh' | transloco" [ngModel]="draft()" (ngModelChange)="draft.set($event)" />
          </label>
          <button type="submit" class="btn-key size-12 p-0 rounded-xl" [disabled]="!vulnId() || !draft().trim() || busy()" [attr.aria-label]="'vulns.send' | transloco">
            <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></svg>
          </button>
        </form>
      </section>
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
