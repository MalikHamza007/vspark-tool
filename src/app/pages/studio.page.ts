import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { friendlyError } from '../core/errors';
import { CaptionOption, PLATFORMS, Platform, Post, TONES } from '../core/models';
import { PostsService } from '../core/posts.service';
import { ToastService } from '../core/toast.service';
import { PostForm } from '../shared/post-form';

const IDEAS = ['Launching our new cold brew with oat milk this Friday', 'Behind the scenes of a product photoshoot', 'Weekend flash sale: 30% off all hoodies', 'Hiring a junior designer — remote friendly'];

@Component({
  selector: 'app-studio',
  imports: [ReactiveFormsModule, PostForm],
  template: `
  <header class="mb-6">
    <h1 class="display text-[clamp(2.6rem,8vw,5rem)]">Caption Studio</h1>
    <p class="text-ink-2 text-sm">Describe your post, let Gemini draft options, then pick one to schedule.</p>
  </header>
  <div class="grid xl:grid-cols-5 gap-6">
    <section class="xl:col-span-2 space-y-4">
      <form [formGroup]="form" (ngSubmit)="generate()" class="panel p-5 space-y-4">
        <div>
          <label class="label" for="pr">What is the post about?</label>
          <textarea id="pr" rows="4" class="input" formControlName="prompt" placeholder="e.g. Launching our new cold brew with oat milk this Friday"></textarea>
          @if (form.controls.prompt.touched && form.controls.prompt.invalid) { <p class="err">3–1000 characters</p> }
          <div class="flex flex-wrap gap-1.5 mt-2">
            @for (i of ideas; track i) { <button type="button" class="chip bg-paper-2 text-ink-2 hover:bg-teal-wash hover:text-teal-ink" (click)="form.patchValue({ prompt: i })">{{ i.slice(0, 28) }}…</button> }
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="pf">Platform</label>
            <select id="pf" class="input" formControlName="platform">@for (p of platforms; track p.id) { <option [value]="p.id">{{ p.label }}</option> }</select></div>
          <div><label class="label" for="tn">Tone</label>
            <select id="tn" class="input capitalize" formControlName="tone">@for (t of tones; track t) { <option [value]="t">{{ t }}</option> }</select></div>
        </div>
        <button class="btn-primary w-full" [disabled]="loading()">{{ loading() ? 'Gemini is writing…' : 'Generate 3 captions' }}</button>
      </form>
      @if (meta()) { <p class="text-xs text-ink-3 px-1">{{ meta() }}</p> }
    </section>

    <section class="xl:col-span-3 space-y-4">
      @if (loading()) {
        @for (i of [1,2,3]; track i) { <div class="panel p-5 animate-pulse space-y-3"><div class="h-3 bg-ink/15 w-3/4"></div><div class="h-3 bg-ink/15"></div><div class="h-3 bg-paper-2 w-1/2"></div></div> }
      } @else if (error()) {
        <div class="panel p-6 border-red bg-red-wash">
          <div class="font-semibold text-red">Couldn't generate captions</div>
          <p class="text-sm text-red mt-1">{{ error() }}</p>
          <button class="btn-danger mt-3" (click)="generate()">Retry</button>
        </div>
      } @else if (!options().length) {
        <div class="panel p-10 text-center text-ink-2">
          
          <div class="display text-5xl text-ink mb-2">No proofs yet</div>
          <p class="text-sm">Write a short prompt and hit generate — you'll get 3 options with hashtags.</p>
        </div>
      } @else {
        @for (o of options(); track $index; let i = $index) {
          <article class="panel p-5 transition relative" [class]="selected() === i ? 'plate !bg-sun-wash' : ''">
            <div class="flex items-start justify-between gap-3">
              <span class="display-md text-xl">Proof {{ i + 1 }}</span>
              <div class="flex gap-2">
                <button class="btn-ghost !py-1 !px-3" (click)="copy(o)">Copy</button>
                <button class="btn-primary !py-1 !px-3" (click)="choose(i)">{{ selected() === i ? 'Selected ✓' : 'Use this' }}</button>
              </div>
            </div>
            <p class="mt-3 whitespace-pre-line text-[1.05rem] leading-relaxed relative">@if (selected() === i) { <span class="absolute -top-10 right-0 stamp text-teal !text-lg animate-[slam_.35s_cubic-bezier(.2,.8,.2,1)]" style="transform:rotate(-6deg)">Picked</span> }{{ o.caption }}</p>
            <div class="mt-3 flex flex-wrap gap-1.5">@for (h of o.hashtags; track h) { <span class="chip text-teal-ink">{{ h }}</span> }</div>
          </article>
        }
      }

      @if (draft(); as d) {
        <div class="panel p-5" id="schedule">
          <h2 class="display-md text-2xl mb-3">Schedule &amp; save</h2>
          <app-post-form [initial]="d" (saved)="done($event)" />
        </div>
      }
    </section>
  </div>`,
})
export class StudioPage {
  private posts = inject(PostsService); private toast = inject(ToastService); private router = inject(Router);
  platforms = PLATFORMS; tones = TONES; ideas = IDEAS;
  form = inject(FormBuilder).nonNullable.group({
    prompt: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(1000)]],
    platform: ['instagram' as Platform], tone: ['friendly'],
  });
  loading = signal(false); error = signal(''); options = signal<CaptionOption[]>([]); selected = signal<number | null>(null);
  draft = signal<Partial<Post> | null>(null); meta = signal(''); private lastPrompt = '';

  async generate() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.loading.set(true); this.error.set(''); this.selected.set(null); this.draft.set(null);
    try {
      const fresh = this.lastPrompt === v.prompt; this.lastPrompt = v.prompt;
      const r = await this.posts.generate(v.prompt, v.platform, v.tone, fresh);
      this.options.set(r.captions);
      this.meta.set(`${r.model}${r.cached ? ' · cached' : ''}${r.stale ? ' (offline fallback)' : ''}`);
    } catch (e) { this.error.set(friendlyError(e)); this.options.set([]); } finally { this.loading.set(false); }
  }
  choose(i: number) {
    const o = this.options()[i]; const v = this.form.getRawValue();
    this.selected.set(i);
    this.draft.set(null);
    queueMicrotask(() => {
      this.draft.set({ title: v.prompt.slice(0, 60), caption: o.caption, hashtags: o.hashtags, platform: v.platform as Platform, tone: v.tone, prompt: v.prompt });
      setTimeout(() => document.getElementById('schedule')?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }
  async copy(o: CaptionOption) {
    try { await navigator.clipboard.writeText(`${o.caption}\n\n${o.hashtags.join(' ')}`); this.toast.show('Copied to clipboard'); } catch { this.toast.show('Copy failed', 'err'); }
  }
  done(_p: Post) { this.router.navigateByUrl('/posts'); }
}
