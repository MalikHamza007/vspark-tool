import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    @if (!auth.ready()) {
      <div class="min-h-screen grid place-items-center">
        <div class="text-center">
          <div class="display text-6xl">V<span class="text-teal">spark</span></div>
          <div class="mt-3 h-2 w-48 mx-auto border-2 border-ink overflow-hidden"><div class="h-full bg-sun animate-[band_1.2s_ease-out_infinite]"></div></div>
          <p class="meta mt-3">Restoring your session…</p>
        </div>
      </div>
    } @else { <router-outlet /> }
    <div class="fixed bottom-4 inset-x-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 sm:w-96" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="panel px-4 py-3 text-sm font-semibold flex gap-3 items-start" [style.box-shadow]="'4px 4px 0 0 ' + (t.kind === 'err' ? 'var(--color-red)' : t.kind === 'info' ? 'var(--color-sun)' : 'var(--color-teal)')">
          <span class="stamp !text-[0.65rem] shrink-0" [class]="t.kind === 'err' ? 'text-red' : t.kind === 'info' ? 'text-ink' : 'text-teal'">{{ t.kind === 'err' ? 'Error' : t.kind === 'info' ? 'Note' : 'Done' }}</span>
          <span>{{ t.text }}</span>
        </div>
      }
    </div>`,
})
export class App { auth = inject(AuthService); toast = inject(ToastService); }
