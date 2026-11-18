import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { DriveService } from '../core/drive.service';
import { PLATFORMS } from '../core/models';
import { PostsService } from '../core/posts.service';
import { ROLE_INFO } from '../core/roles';
import { STATUS_STYLE } from './posts.page';
import { Icon } from '../shared/icon';

interface Bar { key: string; label: string; value: number; link: any[]; query: Record<string, string> }

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, Icon],
  template: `
  <section class="grid lg:grid-cols-12 border-2 border-ink">
    <div class="lg:col-span-8 p-5 sm:p-8 border-b-2 lg:border-b-0 lg:border-r-2 border-ink">
      <div class="flex flex-wrap items-center gap-3 meta">
        <span>Desk of {{ auth.profile()?.fullName || 'creator' }}</span>
        <span class="stamp text-teal">{{ auth.role() }}</span>
      </div>
      @if (next(); as n) {
        <h1 class="display text-[clamp(3rem,10vw,7.5rem)] mt-4">Next out<br/><span class="highlight px-1">{{ n.scheduledAt | date: 'h:mm a' }}</span></h1>
        <p class="mt-4 text-lg font-semibold">{{ n.scheduledAt | date: 'EEEE d MMMM' }} · {{ label(n.platform) }}</p>
        <p class="mt-2 text-ink-2 max-w-xl line-clamp-2">{{ n.title }} — {{ n.caption }}</p>
      } @else {
        <h1 class="display text-[clamp(3rem,10vw,7.5rem)] mt-4">Nothing<br/><span class="highlight px-1">scheduled</span></h1>
        <p class="mt-4 text-ink-2 max-w-xl">{{ roleInfo() }} Write a caption and give it a time — it will show up here.</p>
      }
      <div class="mt-6 flex flex-wrap gap-3">
        @if (auth.can('captions.generate')) { <a routerLink="/studio" class="btn-primary !min-h-12 !px-5 text-base"><app-icon name="pen" /> Write captions</a> }
        @if (auth.can('posts.manage')) { <a routerLink="/posts" class="btn !min-h-12"><app-icon name="list" /> Run sheet</a> }
        @if (auth.can('settings.manage')) { <a routerLink="/settings" class="btn !min-h-12"><app-icon name="bell" /> Alerts</a> }
        @if (auth.can('admin.view')) { <a routerLink="/admin" class="btn !min-h-12"><app-icon name="shield" /> Admin</a> }
      </div>
    </div>
    <dl class="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1">
      @for (k of kpis(); track k.label; let i = $index) {
        <a [routerLink]="'/posts'" [queryParams]="k.query" class="group flex items-baseline justify-between gap-3 p-4 sm:px-6 border-ink hover:bg-sun-wash transition-colors"
           [class.border-b-2]="i < 2 || true" [class.border-r-2]="i % 2 === 0" [class.lg:border-r-0]="true">
          <dt class="text-sm font-bold">{{ k.label }}<span class="block meta font-normal">{{ k.hint }}</span></dt>
          <dd class="display text-5xl sm:text-6xl tabular group-hover:text-teal">{{ k.value }}</dd>
        </a>
      }
      <div class="col-span-2 lg:col-span-1 flex items-center justify-between p-4 sm:px-6 meta">
        <span class="inline-flex items-center gap-1.5"><app-icon name="cloud" [size]="15" [class]="drive.connected() ? 'text-teal' : ''" /> Drive {{ drive.connected() ? 'connected' : 'not connected' }}</span>
        <span>{{ synced() }}/{{ posts.posts().length }} synced</span>
      </div>
    </dl>
  </section>

  <div class="grid lg:grid-cols-12 gap-6 mt-8">
    <section class="lg:col-span-7 panel">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink px-4 py-3">
        <h2 class="display-md text-2xl">Load</h2>
        <div class="flex items-center gap-2">
          <div class="flex border-2 border-ink" role="tablist" aria-label="Chart view">
            @for (t of tabs; track t.id; let last = $last) {
              <button role="tab" [attr.aria-selected]="tab() === t.id" class="px-3 py-1 text-xs font-bold" [class.border-r-2]="!last" [class]="tab() === t.id ? 'bg-ink text-paper border-ink' : 'border-ink hover:bg-sun-wash'" (click)="tab.set(t.id)">{{ t.label }}</button>
            }
          </div>
          <button class="btn btn-sm" (click)="showTable.set(!showTable())">{{ showTable() ? 'Chart' : 'Table' }}</button>
        </div>
      </div>
      @if (showTable()) {
        <table class="w-full text-sm"><thead><tr class="text-left"><th class="label !mb-0 px-4 py-2">{{ tab() === 'week' ? 'Day' : 'Platform' }}</th><th class="label !mb-0 px-4 text-right">Posts</th></tr></thead>
          <tbody>@for (b of bars(); track b.key) { <tr class="border-t-2 border-ink"><td class="px-4 py-2"><a class="font-semibold underline decoration-teal decoration-2" [routerLink]="b.link" [queryParams]="b.query">{{ b.label }}</a></td><td class="px-4 text-right tabular font-bold">{{ b.value }}</td></tr> }</tbody></table>
      } @else {
        <div class="px-4 pt-8 pb-3">
          <div class="relative h-52 flex items-end gap-2 sm:gap-4 border-b-2 border-ink">
            @for (b of bars(); track b.key) {
              <button class="group relative flex-1 h-full flex flex-col justify-end items-center" (click)="go(b)" [attr.aria-label]="b.label + ': ' + b.value + ' posts'">
                <span class="pointer-events-none absolute -top-7 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity bg-ink text-paper meta !text-paper px-2 py-0.5 whitespace-nowrap z-10">{{ b.label }} · {{ b.value }}</span>
                <span class="display text-lg mb-1 tabular" [class.text-ink-3]="!b.value">{{ b.value }}</span>
                <span class="w-full max-w-14 border-2 border-b-0 border-ink bg-teal group-hover:bg-sun transition-colors" [style.height.%]="max() ? (b.value / max()) * 72 + (b.value ? 4 : 0) : 0"></span>
              </button>
            }
          </div>
          <div class="flex gap-2 sm:gap-4 mt-2">@for (b of bars(); track b.key) { <span class="flex-1 text-center meta truncate">{{ b.label }}</span> }</div>
        </div>
      }
    </section>

    <section class="lg:col-span-5 panel">
      <div class="flex items-center justify-between border-b-2 border-ink px-4 py-3"><h2 class="display-md text-2xl">Up next</h2><a routerLink="/posts" class="text-sm font-bold underline decoration-teal decoration-2">All</a></div>
      @for (p of upcoming(); track p.id) {
        <div class="grid grid-cols-[4.5rem_1fr] border-b-2 border-ink last:border-b-0">
          <div class="border-r-2 border-ink p-2 text-center"><div class="meta">{{ p.scheduledAt | date: 'EEE' }}</div><div class="display text-3xl">{{ p.scheduledAt | date: 'd' }}</div></div>
          <div class="p-3 min-w-0"><div class="font-bold truncate">{{ p.title }}</div><div class="meta">{{ p.scheduledAt | date: 'h:mm a' }} · {{ label(p.platform) }}</div></div>
        </div>
      } @empty {
        <p class="p-4 text-sm text-ink-2">No scheduled posts yet. <a routerLink="/studio" class="font-bold underline decoration-teal decoration-2">Write one</a></p>
      }
    </section>
  </div>

  <section class="mt-8">
    <div class="flex items-end justify-between border-b-2 border-ink pb-2"><h2 class="display-md text-2xl">Last touched</h2><a routerLink="/posts" class="text-sm font-bold underline decoration-teal decoration-2">Run sheet</a></div>
    <div class="grid md:grid-cols-3 border-x-2 border-b-2 border-ink">
      @for (p of recent(); track p.id; let i = $index) {
        <article class="p-4 border-ink" [class.md:border-l-2]="i > 0" [class.border-t-2]="i > 0" [class.md:border-t-0]="true">
          <div class="flex justify-between gap-2 items-start"><h3 class="font-bold truncate">{{ p.title }}</h3><span class="stamp shrink-0" [class]="style[p.status]">{{ p.status }}</span></div>
          <p class="text-sm text-ink-2 mt-2 line-clamp-3">{{ p.caption }}</p>
        </article>
      } @empty { <p class="p-4 text-sm text-ink-2">Nothing saved yet.</p> }
    </div>
  </section>`,
})
export class DashboardPage {
  auth = inject(AuthService); posts = inject(PostsService); drive = inject(DriveService); private router = inject(Router);
  style = STATUS_STYLE;
  tabs = [{ id: 'week', label: '7 days' }, { id: 'platform', label: 'Platform' }] as const;
  tab = signal<'week' | 'platform'>('week'); showTable = signal(false);
  roleInfo = computed(() => ROLE_INFO[this.auth.role() ?? 'creator']);
  ngOnInit() { this.posts.load().catch(() => {}); }

  kpis = computed(() => {
    const l = this.posts.posts(); const now = Date.now();
    return [
      { label: 'All posts', value: l.length, hint: 'drafts + scheduled', query: {} },
      { label: 'Scheduled', value: l.filter((p) => p.status === 'scheduled').length, hint: `${l.filter((p) => p.status === 'scheduled' && new Date(p.scheduledAt!).getTime() - now < 86400e3).length} in next 24h`, query: { status: 'scheduled' } },
      { label: 'Drafts', value: l.filter((p) => p.status === 'draft').length, hint: 'waiting for a time', query: { status: 'draft' } },
      { label: 'Published', value: l.filter((p) => p.status === 'published').length, hint: 'time has passed', query: { status: 'published' } },
    ];
  });
  bars = computed<Bar[]>(() => {
    const l = this.posts.posts();
    if (this.tab() === 'platform') return PLATFORMS.map((p) => ({ key: p.id, label: p.label.split(' ')[0], value: l.filter((x) => x.platform === p.id).length, link: ['/posts'], query: { platform: p.id } }));
    const days: Bar[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
      const e = new Date(d); e.setDate(e.getDate() + 1);
      days.push({ key: d.toISOString(), label: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
        value: l.filter((p) => p.scheduledAt && new Date(p.scheduledAt) >= d && new Date(p.scheduledAt) < e).length, link: ['/posts'], query: { status: 'scheduled' } });
    }
    return days;
  });
  max = computed(() => Math.max(0, ...this.bars().map((b) => b.value)));
  upcoming = computed(() => this.posts.posts().filter((p) => p.status === 'scheduled' && p.scheduledAt).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)).slice(0, 5));
  recent = computed(() => [...this.posts.posts()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3));
  next = computed(() => this.upcoming()[0] ?? null);
  label(id: string) { return PLATFORMS.find((p) => p.id === id)?.label ?? id; }
  synced = computed(() => this.posts.posts().filter((p) => p.driveFileId).length);
  go(b: Bar) { this.router.navigate(b.link, { queryParams: b.query }); }
}
