import { Injectable, signal } from '@angular/core';
export interface Toast { id: number; kind: 'ok' | 'err' | 'info'; text: string }
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;
  show(text: string, kind: Toast['kind'] = 'ok') {
    const id = ++this.n;
    this.toasts.update((t) => [...t, { id, kind, text }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), 4500);
  }
}
