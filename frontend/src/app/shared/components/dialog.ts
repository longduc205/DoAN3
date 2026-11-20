import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * Modal built on the native <dialog>: showModal() gives focus trapping, Esc and inert background for free.
 * The parent owns visibility via [open]; Esc/backdrop just emits (closed).
 */
@Component({
  selector: 'app-dialog',
  template: `
    <dialog #dlg class="glass m-auto w-[min(560px,calc(100vw-32px))] p-0 bg-white/90 text-ink backdrop:bg-black/30"
      [attr.aria-labelledby]="titleId" (cancel)="$event.preventDefault(); closed.emit()" (click)="onBackdrop($event)">
      <div class="p-6 flex flex-col gap-4">
        <h2 [id]="titleId" class="text-lg font-semibold">{{ heading() }}</h2>
        <ng-content />
      </div>
    </dialog>
  `,
})
export class DialogComponent {
  private static seq = 0;
  readonly open = input(false);
  readonly heading = input.required<string>();
  readonly closed = output<void>();
  protected readonly titleId = `dlg-title-${++DialogComponent.seq}`;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open() && !el.open) el.showModal();
      else if (!this.open() && el.open) el.close();
    });
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.closed.emit();
  }
}
