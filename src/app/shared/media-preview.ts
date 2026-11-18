import { Component, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PostsService } from '../core/posts.service';
import { friendlyError } from '../core/errors';

/** Renders a private-bucket file inside the app using a 60-second signed URL. */
@Component({
  selector: 'app-media-preview',
  template: `
  <div class="fixed inset-0 z-[90] bg-ink/70 grid place-items-center p-4" (click)="closed.emit()">
    <div class="panel w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" (click)="$event.stopPropagation()">
      <div class="flex items-center justify-between px-5 py-3 border-b-2 border-ink">
        <div class="min-w-0"><div class="font-semibold truncate">{{ name() }}</div><div class="text-xs text-ink-2">Private file · link expires in 60s</div></div>
        <div class="flex gap-2">
          <button class="btn-ghost !py-1.5" (click)="download()">Download</button>
          <button class="btn-ghost !py-1.5" (click)="closed.emit()" aria-label="Close">✕</button>
        </div>
      </div>
      <div class="p-4 overflow-auto bg-paper-2 min-h-60 grid place-items-center">
        @if (loading()) { <div class="text-ink-2 text-sm">Loading preview…</div> }
        @else if (err()) { <div class="text-red text-sm">{{ err() }}</div> }
        @else {
          @switch (kind()) {
            @case ('image') { <img [src]="url()" [alt]="name()" class="max-h-[70vh]" /> }
            @case ('pdf') { <iframe [src]="safe()" class="w-full h-[70vh] bg-white" title="PDF preview"></iframe> }
            @case ('text') { <pre class="w-full whitespace-pre-wrap text-sm bg-white p-4">{{ text() }}</pre> }
            @case ('csv') {
              <div class="w-full overflow-auto"><table class="text-sm w-full bg-white">
                @for (row of rows(); track $index; let i = $index) {
                  <tr [class]="i === 0 ? 'font-semibold bg-paper-2' : 'border-t-2 border-ink'">@for (c of row; track $index) { <td class="px-3 py-1.5">{{ c }}</td> }</tr>
                }
              </table></div>
            }
            @default { <div class="text-sm text-ink-2">No inline preview for this type — use Download.</div> }
          }
        }
      </div>
    </div>
  </div>`,
})
export class MediaPreview {
  path = input.required<string>(); name = input<string>('file'); type = input<string>('');
  closed = output<void>();
  private posts = inject(PostsService); private san = inject(DomSanitizer);
  loading = signal(true); err = signal(''); url = signal(''); safe = signal<SafeResourceUrl | null>(null);
  text = signal(''); rows = signal<string[][]>([]); kind = signal<'image' | 'pdf' | 'text' | 'csv' | 'other'>('other');

  async ngOnInit() {
    const t = this.type();
    this.kind.set(t.startsWith('image/') ? 'image' : t === 'application/pdf' ? 'pdf' : t === 'text/csv' ? 'csv' : t.startsWith('text/') ? 'text' : 'other');
    try {
      const u = await this.posts.signedUrl(this.path());
      if (!this.posts.isProjectSignedUrl(u)) throw new Error('Unexpected file URL');
      this.url.set(u);
      if (this.kind() === 'pdf') this.safe.set(this.san.bypassSecurityTrustResourceUrl(u));
      if (this.kind() === 'text' || this.kind() === 'csv') {
        const body = (await (await fetch(u)).text()).slice(0, 200_000);
        this.text.set(body);
        this.rows.set(body.split(/\r?\n/).filter(Boolean).slice(0, 200).map((l) => l.split(',')));
      }
    } catch (e) { this.err.set(friendlyError(e)); } finally { this.loading.set(false); }
  }
  async download() {
    try { window.open(await this.posts.signedUrl(this.path(), true), '_blank', 'noopener'); } catch (e) { this.err.set(friendlyError(e)); }
  }
}
