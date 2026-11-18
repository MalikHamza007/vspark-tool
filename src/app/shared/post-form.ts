import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DriveService } from '../core/drive.service';
import { friendlyError } from '../core/errors';
import { PLATFORMS, Platform, Post } from '../core/models';
import { PostsService } from '../core/posts.service';
import { ToastService } from '../core/toast.service';

const MAX_FILE = 10 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv'];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso); const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

@Component({
  selector: 'app-post-form',
  imports: [ReactiveFormsModule],
  template: `
  <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
    <div class="grid sm:grid-cols-2 gap-4">
      <div><label class="label" for="t">Post title</label><input id="t" class="input" formControlName="title" placeholder="e.g. Autumn menu launch" />
        @if (form.controls.title.touched && form.controls.title.invalid) { <p class="err">2–120 characters</p> }</div>
      <div><label class="label" for="pl">Platform</label>
        <select id="pl" class="input" formControlName="platform">@for (p of platforms; track p.id) { <option [value]="p.id">{{ p.label }}</option> }</select></div>
    </div>
    <div>
      <div class="flex justify-between"><label class="label" for="c">Caption</label>
        <span class="text-xs" [class]="overLimit() ? 'text-red font-semibold' : 'text-ink-3'">{{ len() }} / {{ limit() }}</span></div>
      <textarea id="c" rows="5" class="input" formControlName="caption"></textarea>
      @if (form.controls.caption.touched && form.controls.caption.invalid) { <p class="err">Caption is required (max 2200)</p> }
    </div>
    <div><label class="label" for="h">Hashtags (space separated)</label><input id="h" class="input" formControlName="hashtags" placeholder="#coffee #autumn" /></div>
    <div class="grid sm:grid-cols-2 gap-4">
      <div><label class="label" for="s">Scheduled time</label><input id="s" type="datetime-local" class="input" formControlName="scheduledAt" />
        @if (pastTime()) { <p class="err">Pick a time in the future</p> }
        <p class="text-xs text-ink-3 mt-1">Leave empty to keep it as a draft.</p></div>
      <div><label class="label" for="n">Task notes (for the email)</label><input id="n" class="input" formControlName="taskNotes" placeholder="e.g. Use the latte photo, tag @partner" /></div>
    </div>
    <div class="grid sm:grid-cols-2 gap-4">
      <div>
        <label class="label" for="f">Attach media (private)</label>
        <input id="f" type="file" class="input !p-1.5 file:mr-3 file: file:border-0 file:bg-teal-wash file:px-3 file:py-1 file:text-teal-ink" (change)="pick($event)" [accept]="types.join(',')" />
        @if (fileErr()) { <p class="err">{{ fileErr() }}</p> }
        @if (!file() && initial()?.mediaName) { <p class="text-xs text-ink-2 mt-1">Current: {{ initial()?.mediaName }}</p> }
      </div>
      <div class="space-y-2 pt-5">
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" formControlName="notify" class="accent-[#00757b] h-4 w-4" /> Email me about this post</label>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" formControlName="syncDrive" class="accent-[#00757b] h-4 w-4" [attr.disabled]="drive.configured ? null : true" />
          Save &amp; sync to Google Drive @if (!drive.configured) { <span class="text-xs text-ink-3">(not configured)</span> }</label>
      </div>
    </div>
    @if (error()) { <div class=" bg-red-wash border-2 border-ink border-red text-red text-sm p-3">{{ error() }}</div> }
    <div class="flex justify-end gap-2">
      <ng-content />
      <button class="btn-primary" [disabled]="busy()">{{ busy() ? step() : (initial()?.id ? 'Save changes' : form.value.scheduledAt ? 'Schedule post' : 'Save draft') }}</button>
    </div>
  </form>`,
})
export class PostForm {
  initial = input<Partial<Post> | null>(null);
  saved = output<Post>();
  drive = inject(DriveService); private posts = inject(PostsService); private toast = inject(ToastService);
  platforms = PLATFORMS; types = TYPES;
  busy = signal(false); step = signal('Saving…'); error = signal(''); file = signal<File | null>(null); fileErr = signal('');
  form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    platform: ['instagram' as Platform],
    caption: ['', [Validators.required, Validators.maxLength(2200)]],
    hashtags: [''], scheduledAt: [''], taskNotes: ['', Validators.maxLength(1000)],
    notify: [true], syncDrive: [false],
  });
  private val = signal(this.form.getRawValue());
  len = computed(() => (this.val().caption + ' ' + this.val().hashtags).trim().length);
  limit = computed(() => PLATFORMS.find((p) => p.id === this.val().platform)?.limit ?? 2200);
  overLimit = computed(() => this.len() > this.limit());
  pastTime = computed(() => !!this.val().scheduledAt && new Date(this.val().scheduledAt).getTime() < Date.now() - 60000 && this.val().scheduledAt !== toLocalInput(this.initial()?.scheduledAt ?? null));

  ngOnInit() {
    this.form.valueChanges.subscribe(() => this.val.set(this.form.getRawValue()));
    const p = this.initial();
    if (p) this.form.patchValue({
      title: p.title ?? '', platform: (p.platform ?? 'instagram') as Platform, caption: p.caption ?? '',
      hashtags: (p.hashtags ?? []).join(' '), scheduledAt: toLocalInput(p.scheduledAt ?? null), taskNotes: p.taskNotes ?? '',
      notify: p.notify ?? true, syncDrive: !!p.driveFileId || (this.drive.connected() && !p.id),
    });
    this.val.set(this.form.getRawValue());
  }
  pick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.fileErr.set('');
    if (f && !TYPES.includes(f.type)) { this.fileErr.set('Use PNG, JPG, WEBP, GIF, PDF, TXT or CSV'); this.file.set(null); return; }
    if (f && f.size > MAX_FILE) { this.fileErr.set('Max 10 MB'); this.file.set(null); return; }
    this.file.set(f);
  }

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.pastTime() || this.fileErr()) return;
    this.busy.set(true); this.error.set('');
    const v = this.form.getRawValue();
    const init = this.initial();
    let uploaded: string | null = null;
    try {
      const patch: Partial<Post> = {
        title: v.title.trim(), platform: v.platform, caption: v.caption.trim(), taskNotes: v.taskNotes.trim(), notify: v.notify,
        hashtags: v.hashtags.split(/[\s,]+/).filter(Boolean).map((h) => '#' + h.replace(/^#+/, '')).slice(0, 30),
        scheduledAt: v.scheduledAt ? new Date(v.scheduledAt).toISOString() : null,
        status: v.scheduledAt ? 'scheduled' : 'draft',
      };
      if (!init?.id) { patch.prompt = init?.prompt ?? ''; patch.tone = init?.tone ?? 'friendly'; }
      if (this.file()) {
        this.step.set('Uploading media…');
        const m = await this.posts.uploadMedia(this.file()!);
        uploaded = m.mediaPath; Object.assign(patch, m);
      }
      this.step.set('Saving…');
      let post: Post;
      try {
        post = init?.id ? await this.posts.update(init.id, patch) : await this.posts.create(patch);
      } catch (e) { if (uploaded) await this.posts.removeMedia(uploaded); uploaded = null; throw e; }
      if (uploaded && init?.mediaPath) await this.posts.removeMedia(init.mediaPath);

      if (v.syncDrive && this.drive.configured) {
        this.step.set('Syncing to Drive…');
        try {
          const id = await this.drive.savePost(post);
          post = await this.posts.update(post.id, { driveFileId: id, driveSyncedAt: new Date().toISOString() });
        } catch (e) { this.toast.show('Saved, but Drive sync failed: ' + friendlyError(e), 'err'); }
      }
      const timeChanged = post.scheduledAt && post.scheduledAt !== (init?.scheduledAt ?? null);
      if (post.status === 'scheduled' && post.notify && timeChanged) {
        this.step.set('Sending email…');
        this.posts.notify(post.id, 'scheduled').then((r) => {
          if (r.status === 'sent') this.toast.show('Confirmation email sent');
          else if (r.status === 'skipped') this.toast.show('Email skipped: ' + (r.error ?? ''), 'info');
          else this.toast.show('Email failed: ' + (r.error ?? ''), 'err');
        }).catch((e) => this.toast.show(friendlyError(e), 'err'));
      }
      this.toast.show(post.status === 'scheduled' ? 'Post scheduled' : 'Draft saved');
      this.saved.emit(post);
    } catch (e) { this.error.set(friendlyError(e)); } finally { this.busy.set(false); this.step.set('Saving…'); }
  }
}
