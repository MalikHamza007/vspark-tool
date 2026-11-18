import { Component, input } from '@angular/core';

/** Page masthead: condensed display title on a visible 12-column rule. */
@Component({
  selector: 'app-page-head',
  template: `
  <div class="relative mb-6 sm:mb-8 border-b-2 border-ink pb-4">
    <div class="pointer-events-none absolute inset-x-0 -bottom-[2px] h-2 grid grid-cols-12" aria-hidden="true">
      @for (c of cols; track c) { <span class="border-l-2 border-ink first:border-l-0"></span> }
    </div>
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="display text-[clamp(2.6rem,8vw,5.5rem)] text-balance">{{ title() }}</h1>
        @if (note()) { <p class="mt-2 max-w-2xl text-ink-2 text-[0.95rem]">{{ note() }}</p> }
      </div>
      <div class="flex flex-wrap gap-2"><ng-content /></div>
    </div>
  </div>`,
})
export class PageHead { title = input.required<string>(); note = input<string>(''); cols = Array.from({ length: 12 }, (_, i) => i); }
