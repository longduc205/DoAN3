import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <div class="glass p-10 max-w-xl mx-auto mt-10 text-center flex flex-col gap-3 items-center">
      <span class="mono text-danger">403</span>
      <h1 class="page-title">{{ 'forbidden.title' | transloco }}</h1>
      <p class="text-ink-muted">{{ 'forbidden.body' | transloco }}</p>
      <a routerLink="/dashboard" class="btn btn-primary mt-2">{{ 'forbidden.back' | transloco }}</a>
    </div>
  `,
})
export class ForbiddenPage {}
