import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslocoPipe],
  styles: `
    .lg-card { animation: lg-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes lg-in { from { opacity: 0; transform: translateY(10px); } }
    @media (prefers-reduced-motion: reduce) { .lg-card { animation: none; } }
  `,
  template: `
    <div class="min-h-screen flex flex-col px-4 py-4 sm:px-7 sm:py-5">
      <header class="flex items-center gap-3">
        <span class="inline-flex items-center gap-2.5">
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 26 26">
            <path d="M3 6.5l5 14 5-10 5 10 5-14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
            <circle cx="13" cy="4" r="2.2" fill="currentColor" />
          </svg>
          <b class="text-[15px] font-semibold">WebSec AI</b>
        </span>
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 ring-1 ring-ink/10 text-xs font-medium text-ink-muted">
          <span aria-hidden="true" class="size-1.5 rounded-full bg-ok"></span>{{ 'login.lab' | transloco }}
        </span>
        <span class="ml-auto flex p-0.5 rounded-[9px] bg-ink/5" role="group" [attr.aria-label]="'login.language' | transloco">
          @for (l of langs; track l) {
            <button type="button" class="h-7 px-2.5 rounded-[7px] text-xs cursor-pointer" [attr.aria-pressed]="lang() === l"
              [class]="lang() === l ? 'bg-white font-semibold shadow-sm' : 'text-ink-muted'" (click)="setLang(l)">{{ l.toUpperCase() }}</button>
          }
        </span>
      </header>

      <main class="flex-1 flex flex-col items-center justify-center gap-[18px] py-8">
        <section class="lg-card glass w-full max-w-[400px] flex flex-col gap-4 rounded-3xl px-5 pt-6 pb-5 sm:px-7 sm:pt-7" aria-labelledby="login-title">
          <div class="flex flex-col items-center gap-2.5 pb-1 text-center">
            <svg aria-hidden="true" width="44" height="44" viewBox="0 0 26 26">
              <path d="M3 6.5l5 14 5-10 5 10 5-14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="13" cy="4" r="2.2" class="fill-accent" />
            </svg>
            <h1 id="login-title" class="m-0 text-[22px] font-semibold tracking-tight">{{ 'login.title' | transloco }}</h1>
            <p class="m-0 -mt-1.5 text-sm text-ink-muted">{{ 'login.sub' | transloco }}</p>
          </div>

          @if (error()) {
            <div role="alert" class="flex gap-2.5 px-3 py-2.5 rounded-xl bg-danger-bg text-danger text-[13px] leading-[19px]">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="flex-none mt-px">
                <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
              </svg>
              <b class="font-semibold">{{ error()! | transloco }}</b>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4" novalidate>
            <div>
              <label class="block mb-1.5 text-[13px] font-medium" for="userName">{{ 'login.userName' | transloco }}</label>
              <div class="lg-field">
                <input id="userName" formControlName="userName" autocomplete="username"
                  [attr.aria-invalid]="form.controls.userName.touched && form.controls.userName.invalid" />
              </div>
              @if (form.controls.userName.touched && form.controls.userName.invalid) {
                <p class="field-error">{{ 'validation.required' | transloco }}</p>
              }
            </div>

            <div>
              <span class="flex justify-between items-baseline gap-2">
                <label class="block mb-1.5 text-[13px] font-medium" for="password">{{ 'login.password' | transloco }}</label>
                <span class="text-xs text-ink-muted">{{ 'login.forgot' | transloco }} <span class="text-ink">{{ 'login.askAdmin' | transloco }}</span></span>
              </span>
              <div class="lg-field" [class.border-danger]="error()">
                <input id="password" [type]="showPw() ? 'text' : 'password'" formControlName="password" autocomplete="current-password"
                  [attr.aria-describedby]="error() ? 'pw-hint' : null"
                  [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid" />
                <button type="button" class="grid place-items-center flex-none size-[34px] rounded-[9px] text-ink-muted hover:text-ink cursor-pointer"
                  [attr.aria-label]="(showPw() ? 'login.hidePw' : 'login.showPw') | transloco" [attr.aria-pressed]="showPw()" (click)="showPw.set(!showPw())">
                  @if (showPw()) {
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                    </svg>
                  } @else {
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  }
                </button>
              </div>
              @if (error()) {
                <span id="pw-hint" class="block mt-1.5 text-xs text-danger">{{ 'login.pwCleared' | transloco }}</span>
              } @else if (form.controls.password.touched && form.controls.password.invalid) {
                <p class="field-error">{{ 'validation.required' | transloco }}</p>
              }
            </div>

            <label class="flex items-center gap-2 text-[13px] cursor-pointer">
              <input type="checkbox" class="check" formControlName="remember" />{{ 'login.remember' | transloco }}
            </label>

            <button type="submit" class="btn-key h-[46px] p-0 rounded-xl font-semibold" [disabled]="loading()" [attr.aria-busy]="loading()">
              @if (loading()) {
                <span aria-hidden="true" class="size-4 rounded-full border-2 border-white/35 border-t-white animate-spin"></span>{{ 'login.submitting' | transloco }}
              } @else {
                {{ 'login.submit' | transloco }}
              }
            </button>
          </form>

          <p class="m-0 pt-3 border-t border-line flex gap-2 text-xs leading-[18px] text-ink-muted">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-none mt-0.5">
              <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span>{{ 'login.securityNote' | transloco }}</span>
          </p>
        </section>
        <p class="m-0 text-[13px] text-ink-muted">{{ 'login.noAccount' | transloco }}</p>
      </main>

      <footer class="flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
        <span>{{ 'login.version' | transloco }}</span><span class="max-sm:hidden">{{ 'login.authorizedOnly' | transloco }}</span>
      </footer>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPw = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    userName: ['', Validators.required],
    password: ['', Validators.required],
    remember: [true],
  });

  private readonly transloco = inject(TranslocoService);
  protected readonly langs = ['vi', 'en'] as const;
  protected readonly lang = toSignal(this.transloco.langChanges$, { initialValue: this.transloco.getActiveLang() });

  protected setLang(l: string): void {
    this.transloco.setActiveLang(l);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { userName, password, remember } = this.form.getRawValue();
    this.auth.login(userName, password, remember).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.form.controls.password.reset();
        this.loading.set(false);
      },
    });
  }
}
