import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-coming-later',
  imports: [TranslocoPipe],
  template: `
    <h1 class="page-title mb-4">{{ titleKey() | transloco }}</h1>
    <div class="glass p-8 text-ink-muted">{{ 'common.comingLater' | transloco }}</div>
  `,
})
export class ComingLaterPage {
  readonly titleKey = input('');
}
