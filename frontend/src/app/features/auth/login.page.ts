import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslocoPipe],
  styles: `
    .a-in { opacity: 0; filter: blur(4px); transform: translateY(12px); animation: fade-slide-in 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
    .a-right { opacity: 0; filter: blur(6px); transform: translateX(28px); animation: slide-right-in 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s forwards; }
    .a-card { opacity: 0; filter: blur(6px); transform: translateY(18px) scale(0.96); animation: card-in 0.8s cubic-bezier(0.34, 1.36, 0.5, 1) forwards; }
    @keyframes fade-slide-in { to { opacity: 1; filter: blur(0); transform: translateY(0); } }
    @keyframes slide-right-in { to { opacity: 1; filter: blur(0); transform: translateX(0); } }
    @keyframes card-in { to { opacity: 1; filter: blur(0); transform: translateY(0) scale(1); } }
    @media (prefers-reduced-motion: reduce) {
      .a-in, .a-right, .a-card { animation: none; opacity: 1; filter: none; transform: none; }
    }
  `,
  template: `
    <div class="min-h-screen flex">
      <section class="flex-1 min-w-0 flex flex-col px-5 py-5 md:px-10 md:py-7">
        <div class="a-in flex items-center justify-between gap-4">
          <span class="inline-flex items-center gap-2.5">
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26">
              <path d="M3 6.5l5 14 5-10 5 10 5-14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="13" cy="4" r="2.2" class="fill-accent" />
            </svg>
            <b class="text-[17px] font-semibold tracking-tight">WebSec AI</b>
          </span>
          <span class="mono inline-flex items-center gap-2">
            <span aria-hidden="true" class="size-[7px] rounded-full bg-ok"></span>{{ 'login.systemOk' | transloco }}
          </span>
        </div>

        <main class="flex-1 flex items-center justify-center py-10">
          <div class="w-full max-w-[420px] flex flex-col gap-[22px]">
            <h1 class="a-in [animation-delay:.1s] m-0 text-[38px] md:text-5xl leading-[1.08] font-light tracking-[-0.045em]">
              {{ 'login.welcome' | transloco }} <b class="font-semibold">{{ 'login.welcomeBold' | transloco }}</b>
            </h1>
            <p class="a-in [animation-delay:.2s] -mt-2 text-[15px] leading-relaxed text-ink-muted">{{ 'login.sub' | transloco }}</p>

            @if (error()) {
              <div role="alert" class="a-in flex gap-2.5 px-3.5 py-3 rounded-2xl bg-danger/10 text-danger text-sm leading-[21px]">
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="flex-none mt-0.5">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
                </svg>
                <b class="font-semibold">{{ error()! | transloco }}</b>
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-[18px]" novalidate>
              <div class="a-in [animation-delay:.3s]">
                <label class="block mb-2 text-[13px] font-medium text-ink-muted" for="userName">{{ 'login.userName' | transloco }}</label>
                <div class="field-glass">
                  <input id="userName" formControlName="userName" autocomplete="username" [placeholder]="'login.userNamePh' | transloco"
                    [attr.aria-invalid]="form.controls.userName.touched && form.controls.userName.invalid" />
                </div>
                @if (form.controls.userName.touched && form.controls.userName.invalid) {
                  <p class="field-error">{{ 'validation.required' | transloco }}</p>
                }
              </div>

              <div class="a-in [animation-delay:.4s]">
                <label class="block mb-2 text-[13px] font-medium text-ink-muted" for="password">{{ 'login.password' | transloco }}</label>
                <div class="field-glass" [class.border-danger]="error()">
                  <input id="password" [type]="showPw() ? 'text' : 'password'" formControlName="password" autocomplete="current-password"
                    [placeholder]="'login.passwordPh' | transloco" [attr.aria-describedby]="error() ? 'pw-hint' : null"
                    [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid" />
                  <button type="button" class="grid place-items-center size-10 mr-1.5 rounded-xl text-ink-muted hover:text-ink hover:bg-ink/5 cursor-pointer"
                    [attr.aria-label]="(showPw() ? 'login.hidePw' : 'login.showPw') | transloco" [attr.aria-pressed]="showPw()" (click)="showPw.set(!showPw())">
                    @if (showPw()) {
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.2 3.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </svg>
                    } @else {
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    }
                  </button>
                </div>
                @if (error()) {
                  <span id="pw-hint" class="block mt-1.5 text-[13px] text-danger">{{ 'login.pwCleared' | transloco }}</span>
                } @else if (form.controls.password.touched && form.controls.password.invalid) {
                  <p class="field-error">{{ 'validation.required' | transloco }}</p>
                }
              </div>

              <div class="a-in [animation-delay:.5s] flex flex-wrap items-center justify-between gap-3 text-sm">
                <label class="inline-flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" class="check" formControlName="remember" />{{ 'login.remember' | transloco }}
                </label>
                <span class="text-ink-muted">{{ 'login.forgot' | transloco }} <b class="font-medium text-ink">{{ 'login.askAdmin' | transloco }}</b></span>
              </div>

              <button type="submit" class="btn-key a-in [animation-delay:.6s]" [disabled]="loading()" [attr.aria-busy]="loading()">
                @if (loading()) {
                  {{ 'login.submitting' | transloco }}
                } @else {
                  {{ 'login.submit' | transloco }}<span aria-hidden="true">→</span>
                }
              </button>
            </form>

            <div class="a-in [animation-delay:.7s] flex items-center gap-3.5">
              <span class="flex-1 h-px bg-line"></span><span class="mono">{{ 'login.sessionSecurity' | transloco }}</span><span class="flex-1 h-px bg-line"></span>
            </div>
            <p class="a-in [animation-delay:.7s] -mt-1.5 text-center text-[13px] leading-relaxed text-ink-muted">
              {{ 'login.securityNote' | transloco }}<br />
              {{ 'login.noAccount' | transloco }} <b class="font-medium text-ink">{{ 'login.noAccountBold' | transloco }}</b>
            </p>
            <p class="mono text-center">{{ 'login.devHint' | transloco }}</p>
          </div>
        </main>

        <p class="mono m-0 flex flex-wrap justify-between gap-3">
          <span>© 2026 WEBSEC AI</span><span>{{ 'login.authorizedOnly' | transloco }}</span>
        </p>
      </section>

      <section class="hidden md:block flex-[1.05] min-w-0 relative" [attr.aria-label]="'login.heroLabel' | transloco">
        <div class="a-right absolute inset-[14px] left-0 rounded-[30px] overflow-hidden shadow-[0_0_0_.5px_rgb(0_0_0/.1),0_30px_60px_-30px_rgb(10_12_20/.45)]">
          <img src="/art/aurora-8.png" alt="" width="720" height="900" class="size-full object-cover" />
          <div class="absolute inset-0 bg-linear-to-b from-transparent from-45% to-black/30"></div>
        </div>
        <p class="a-in [animation-delay:.6s] absolute left-10 top-10 right-10 z-[1] max-w-[380px] text-white text-[15px] leading-normal [text-shadow:0_1px_12px_rgb(0_0_0/.35)]">
          {{ 'login.quote' | transloco }}
        </p>
        <div class="absolute left-0 right-[14px] bottom-11 z-[1] flex justify-center gap-3.5 px-8">
          @for (c of cards; track c.key; let i = $index) {
            <div class="glass a-card w-[300px] flex gap-3 items-start p-4 rounded-3xl text-[13px] leading-snug" [class]="c.hide"
              [style.animation-delay]="1 + i * 0.2 + 's'">
              <span class="flex-none size-10 rounded-[14px] grid place-items-center text-[13px] font-semibold" [class]="c.avatar">{{ c.badge }}</span>
              <span>
                <b class="font-semibold">{{ 'login.cards.' + c.key + '.title' | transloco }}</b><br />
                <span class="mono">{{ 'login.cards.' + c.key + '.meta' | transloco }}</span><br />
                <span class="text-ink/80">{{ 'login.cards.' + c.key + '.body' | transloco }}</span>
              </span>
            </div>
          }
        </div>
      </section>
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

  // Decorative activity cards from the design; narrower screens show fewer of them.
  protected readonly cards = [
    { key: 'scan', badge: '#128', avatar: 'bg-sky-100 text-sky-800', hide: '' },
    { key: 'dev', badge: 'PL', avatar: 'bg-green-100 text-green-800', hide: 'max-xl:hidden' },
    { key: 'ai', badge: 'AI', avatar: 'bg-ink text-white', hide: 'max-2xl:hidden' },
  ];

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { userName, password, remember } = this.form.getRawValue();
    this.auth.login(userName, password, remember).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.form.controls.password.reset();
        this.loading.set(false);
      },
    });
  }
}
