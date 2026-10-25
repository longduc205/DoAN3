import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/services/base-api.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, TranslocoPipe],
  template: `
    <div class="min-h-screen flex flex-col px-5 md:px-[5vw] py-7">
      <div class="flex items-center gap-2">
        <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26">
          <path d="M3 6.5l5 14 5-10 5 10 5-14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="13" cy="4" r="2.2" class="fill-accent" />
        </svg>
        <b class="text-[17px] font-semibold tracking-tight">WebSec AI</b>
      </div>

      <main class="flex-1 grid md:grid-cols-[1fr_440px] items-center gap-10 md:gap-16 py-10">
        <div>
          <p class="mono mb-4">{{ 'login.kicker' | transloco }}</p>
          <h1 class="text-4xl md:text-6xl font-semibold tracking-tight leading-none mb-5">{{ 'login.headline' | transloco }}</h1>
          <p class="text-ink-muted max-w-md hidden md:block">{{ 'login.sub' | transloco }}</p>
        </div>

        <div class="relative pt-24">
          <img src="/art/aurora-8.png" alt="" aria-hidden="true" class="absolute inset-x-0 top-0 h-64 w-full object-cover rounded-[28px]" />
          <form [formGroup]="form" (ngSubmit)="submit()" class="glass relative p-7 flex flex-col gap-4 rounded-[26px] bg-white/90" aria-labelledby="login-title">
            <h2 id="login-title" class="text-2xl font-semibold tracking-tight">{{ 'login.title' | transloco }}</h2>

            @if (error()) {
              <div role="alert" class="px-3 py-2.5 rounded-xl bg-danger/10 text-danger text-sm">{{ error()! | transloco }}</div>
            }

            <div>
              <label class="label" for="userName">{{ 'login.userName' | transloco }}</label>
              <input id="userName" class="input" formControlName="userName" autocomplete="username" />
              @if (form.controls.userName.touched && form.controls.userName.invalid) {
                <p class="field-error">{{ 'validation.required' | transloco }}</p>
              }
            </div>
            <div>
              <label class="label" for="password">{{ 'login.password' | transloco }}</label>
              <input id="password" type="password" class="input" formControlName="password" autocomplete="current-password" />
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <p class="field-error">{{ 'validation.required' | transloco }}</p>
              }
            </div>
            <button type="submit" class="btn btn-primary h-11" [disabled]="loading()">
              {{ (loading() ? 'common.loading' : 'login.submit') | transloco }}
            </button>
            <p class="mono">{{ 'login.devHint' | transloco }}</p>
          </form>
        </div>
      </main>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    userName: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const { userName, password } = this.form.getRawValue();
    this.auth.login(userName, password).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
