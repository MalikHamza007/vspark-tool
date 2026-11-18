import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { friendlyError } from '../core/errors';
import { NotificationLog, Post, Profile } from '../core/models';
import { PostsService } from '../core/posts.service';
import { STATUS_STYLE } from './posts.page';

@Component({
  selector: 'app-admin',
  imports: [DatePipe],
  template: `
  <header class="mb-6"><h1 class="display text-[clamp(2.6rem,8vw,5rem)]">Admin console</h1><p class="text-ink-2 text-sm">Workspace health across every creator. Enforced by row-level security on the server.</p></header>
  @if (err()) { <div class="panel p-4 bg-red-wash text-red mb-4">{{ err() }}</div> }
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="panel p-5"><div class="label">Creators</div><div class="text-3xl font-extrabold">{{ users().length }}</div></div>
    <div class="panel p-5"><div class="label">All posts</div><div class="text-3xl font-extrabold">{{ all().length }}</div></div>
    <div class="panel p-5"><div class="label">Emails sent</div><div class="text-3xl font-extrabold text-teal">{{ sent() }}</div></div>
    <div class="panel p-5"><div class="label">Email issues</div><div class="text-3xl font-extrabold text-red">{{ issues() }}</div></div>
  </div>
  <div class="grid xl:grid-cols-2 gap-6 mt-6">
    <section class="panel p-5 overflow-auto">
      <h2 class="display-md text-2xl mb-3">Creators</h2>
      <table class="w-full text-sm"><thead><tr class="text-left text-ink-2"><th class="py-2">Name</th><th>Role</th><th class="text-right">Posts</th></tr></thead>
        <tbody>@for (u of users(); track u.id) { <tr class="border-t-2 border-ink"><td class="py-2"><div class="font-medium">{{ u.fullName }}</div><div class="text-xs text-ink-2">{{ u.email }}</div></td>
          <td><span class="chip capitalize" [class]="u.role === 'admin' ? 'bg-teal-wash text-teal-ink' : 'bg-paper-2'">{{ u.role }}</span></td><td class="text-right">{{ postsBy(u.id) }}</td></tr> }</tbody></table>
    </section>
    <section class="panel p-5 overflow-auto">
      <h2 class="display-md text-2xl mb-3">Notification log</h2>
      <table class="w-full text-sm"><tbody>@for (l of logs(); track l.id) { <tr class="border-t-2 border-ink"><td class="py-2"><div class="truncate max-w-xs">{{ l.subject }}</div><div class="text-xs text-ink-2">{{ l.recipient }} · {{ l.kind }} · {{ l.createdAt | date: 'd MMM h:mm a' }}</div>@if (l.error) { <div class="text-xs text-red">{{ l.error }}</div> }</td>
        <td class="text-right"><span class="chip" [class]="l.status === 'sent' ? 'text-teal' : l.status === 'failed' ? 'bg-red-wash text-red' : 'bg-paper-2'">{{ l.status }}</span></td></tr> } @empty { <tr><td class="text-ink-2 py-2">No emails yet.</td></tr> }</tbody></table>
    </section>
  </div>
  <section class="panel p-5 mt-6 overflow-auto">
    <h2 class="display-md text-2xl mb-3">All scheduled posts</h2>
    <table class="w-full text-sm"><thead><tr class="text-left text-ink-2"><th class="py-2">Title</th><th>Creator</th><th>Platform</th><th>When</th><th>Status</th></tr></thead>
      <tbody>@for (p of all(); track p.id) { <tr class="border-t-2 border-ink"><td class="py-2 font-medium">{{ p.title }}</td><td>{{ owner(p.userId) }}</td><td class="capitalize">{{ p.platform }}</td><td>{{ p.scheduledAt ? (p.scheduledAt | date: 'd MMM h:mm a') : '—' }}</td><td><span class="stamp" [class]="style[p.status]">{{ p.status }}</span></td></tr> }</tbody></table>
  </section>`,
})
export class AdminPage {
  private posts = inject(PostsService); style = STATUS_STYLE;
  users = signal<Profile[]>([]); all = signal<Post[]>([]); logs = signal<NotificationLog[]>([]); err = signal('');
  sent = computed(() => this.logs().filter((l) => l.status === 'sent').length);
  issues = computed(() => this.logs().filter((l) => l.status !== 'sent').length);
  async ngOnInit() {
    try { const [u, p, l] = await Promise.all([this.posts.profiles(), this.posts.load(true), this.posts.logs(100)]); this.users.set(u); this.all.set(p); this.logs.set(l); }
    catch (e) { this.err.set(friendlyError(e)); }
  }
  postsBy(id: string) { return this.all().filter((p) => p.userId === id).length; }
  owner(id: string) { return this.users().find((u) => u.id === id)?.fullName ?? '—'; }
}
