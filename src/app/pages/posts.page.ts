import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DriveService } from '../core/drive.service';
import { friendlyError } from '../core/errors';
import { PLATFORMS, Post } from '../core/models';
import { PostsService } from '../core/posts.service';
import { ToastService } from '../core/toast.service';
import { MediaPreview } from '../shared/media-preview';
import { PostForm } from '../shared/post-form';

export const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-paper-2 text-ink', scheduled: 'bg-amber-100 text-amber-800', published: 'bg-emerald-100 text-teal', failed: 'bg-red-wash text-red',
};

@Component({
  selector: 'app-posts',
  imports: [DatePipe, RouterLink, PostForm, MediaPreview],
  template: `
  <header class="flex flex-wrap items-end justify-between gap-3 mb-6">
    <div><h1 class="display text-[clamp(2.6rem,8vw,5rem)]">Scheduled Feed</h1><p class="text-ink-2 text-sm">All your drafts and scheduled posts, synced with Google Drive.</p></div>
    <a routerLink="/studio" class="btn-primary">New caption</a>
  </header>

  <div class="panel p-3 mb-4 flex flex-wrap gap-2 items-center">
    <input class="input !w-full sm:!w-64" placeholder="Search caption or title…" [value]="q()" (input)="setQ($any($event.target).value)" aria-label="Search" />
    @for (s of statuses; track s) {
      <button class="chip capitalize !px-3 !py-1.5" [class]="status() === s ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-2'" (click)="setStatus(s)">{{ s }} ({{ count(s) }})</button>
    }
    <select class="input !w-auto ml-auto" [value]="platform()" (change)="setPlatform($any($event.target).value)" aria-label="Platform filter">
      <option value="all">All platforms</option>@for (p of platforms; track p.id) { <option [value]="p.id">{{ p.label }}</option> }
    </select>
  </div>

  @if (posts.loading() && !posts.posts().length) {
    <div class="grid md:grid-cols-2 gap-4">@for (i of [1,2,3,4]; track i) { <div class="panel h-40 animate-pulse"></div> }</div>
  } @else if (loadErr()) {
    <div class="panel p-6 border-red bg-red-wash text-red">{{ loadErr() }} <button class="btn-danger ml-2" (click)="reload()">Retry</button></div>
  } @else if (!filtered().length) {
    <div class="panel p-10 text-center text-ink-2"><div class="display text-5xl text-ink">Empty run sheet</div>
      <p class="text-sm">Generate a caption in the studio and schedule it.</p><a routerLink="/studio" class="btn-primary mt-4">Open Caption Studio</a></div>
  } @else {
    <div class="grid md:grid-cols-2 gap-4">
      @for (p of filtered(); track p.id) {
        <article class="panel p-5 flex flex-col">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-semibold truncate">{{ p.title }}</h3>
              <div class="text-xs text-ink-2 mt-0.5">{{ label(p.platform) }} ·
                @if (p.scheduledAt) { {{ p.scheduledAt | date: 'EEE d MMM, h:mm a' }} } @else { no time set }</div>
            </div>
            <span class="stamp shrink-0" [class]="style[p.status]">{{ p.status }}</span>
          </div>
          <p class="text-sm mt-3 whitespace-pre-line line-clamp-4">{{ p.caption }}</p>
          <div class="mt-2 flex flex-wrap gap-1">@for (h of p.hashtags.slice(0, 6); track h) { <span class="chip text-teal-ink">{{ h }}</span> }</div>
          @if (p.taskNotes) { <p class="text-xs text-ink-2 mt-2">{{ p.taskNotes }}</p> }
          <div class="flex flex-wrap items-center gap-2 text-xs mt-3 text-ink-2">
            @if (p.driveFileId) { <a class="chip text-teal" [href]="drive.fileUrl(p.driveFileId)" target="_blank" rel="noopener">In Drive</a> }
            @else { <span class="chip bg-paper-2">Not synced</span> }
            @if (p.notify) { <span class="chip bg-teal-wash text-teal-ink">{{ p.reminderSentAt ? 'Reminder sent' : 'Email on' }}</span> }
            @if (p.mediaPath) { <button class="chip text-ink hover:bg-sun" (click)="preview.set(p)">{{ p.mediaName }}</button> }
          </div>
          <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t-2 border-ink border-ink">
            <button class="btn-ghost !py-1.5" (click)="editing.set(p)">Edit</button>
            <button class="btn-ghost !py-1.5" (click)="sync(p)" [disabled]="busyId() === p.id || !drive.configured">Sync Drive</button>
            <button class="btn-ghost !py-1.5" (click)="sendTest(p)" [disabled]="busyId() === p.id">Send email</button>
            <button class="btn-danger !py-1.5 ml-auto" (click)="remove(p)" [disabled]="busyId() === p.id">Delete</button>
          </div>
        </article>
      }
    </div>
  }

  @if (editing(); as e) {
    <div class="fixed inset-0 z-[80] bg-ink/70 grid place-items-center p-4" (click)="editing.set(null)">
      <div class="panel w-full max-w-2xl max-h-[92vh] overflow-auto p-6" (click)="$event.stopPropagation()">
        <h2 class="text-lg font-bold mb-4">Edit post</h2>
        <app-post-form [initial]="e" (saved)="editing.set(null)"><button type="button" class="btn-ghost" (click)="editing.set(null)">Cancel</button></app-post-form>
      </div>
    </div>
  }
  @if (preview(); as p) { <app-media-preview [path]="p.mediaPath!" [name]="p.mediaName ?? 'file'" [type]="p.mediaType ?? ''" (closed)="preview.set(null)" /> }`,
})
export class PostsPage {
  posts = inject(PostsService); drive = inject(DriveService); private toast = inject(ToastService);
  private route = inject(ActivatedRoute); private router = inject(Router);
  platforms = PLATFORMS; style = STATUS_STYLE; statuses = ['all', 'draft', 'scheduled', 'published'];
  q = signal(''); status = signal(this.route.snapshot.queryParamMap.get('status') ?? 'all'); platform = signal(this.route.snapshot.queryParamMap.get('platform') ?? 'all');
  editing = signal<Post | null>(null); preview = signal<Post | null>(null); busyId = signal<string | null>(null); loadErr = signal('');
  filtered = computed(() => {
    const q = this.q().toLowerCase();
    return this.posts.posts().filter((p) =>
      (this.status() === 'all' || p.status === this.status()) && (this.platform() === 'all' || p.platform === this.platform()) &&
      (!q || p.caption.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)));
  });
  count(s: string) { return s === 'all' ? this.posts.posts().length : this.posts.posts().filter((p) => p.status === s).length; }
  label(id: string) { return PLATFORMS.find((p) => p.id === id)?.label ?? id; }
  ngOnInit() { this.reload(); }
  async reload() { this.loadErr.set(''); try { await this.posts.load(); } catch (e) { this.loadErr.set(friendlyError(e)); } }
  private url() { this.router.navigate([], { queryParams: { status: this.status() === 'all' ? null : this.status(), platform: this.platform() === 'all' ? null : this.platform() }, replaceUrl: true }); }
  setQ(v: string) { this.q.set(v); }
  setStatus(s: string) { this.status.set(s); this.url(); }
  setPlatform(p: string) { this.platform.set(p); this.url(); }

  async sync(p: Post) {
    this.busyId.set(p.id);
    try {
      const id = await this.drive.savePost(p);
      await this.posts.update(p.id, { driveFileId: id, driveSyncedAt: new Date().toISOString() });
      this.toast.show('Synced to Google Drive');
    } catch (e) { this.toast.show(friendlyError(e), 'err'); } finally { this.busyId.set(null); }
  }
  async sendTest(p: Post) {
    this.busyId.set(p.id);
    try {
      const r = await this.posts.notify(p.id, 'manual');
      this.toast.show(r.status === 'sent' ? 'Email sent' : `Email ${r.status}: ${r.error ?? ''}`, r.status === 'sent' ? 'ok' : r.status === 'skipped' ? 'info' : 'err');
    } catch (e) { this.toast.show(friendlyError(e), 'err'); } finally { this.busyId.set(null); }
  }
  async remove(p: Post) {
    if (!confirm(`Delete "${p.title}"? This also removes its Drive copy and attachment.`)) return;
    this.busyId.set(p.id);
    try {
      if (p.driveFileId && this.drive.connected()) { try { await this.drive.deleteFile(p.driveFileId); } catch {} }
      await this.posts.remove(p);
      this.toast.show('Post deleted');
    } catch (e) { this.toast.show(friendlyError(e), 'err'); } finally { this.busyId.set(null); }
  }
}
