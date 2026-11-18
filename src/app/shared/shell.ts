import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Permission } from '../core/roles';
import { DriveService } from '../core/drive.service';
import { Icon } from './icon';

interface NavItem { path: string; label: string; icon: string; requires: Permission | null }
const NAV: NavItem[] = [
  { path: '/', label: 'Desk', icon: 'home', requires: null },
  { path: '/studio', label: 'Write', icon: 'pen', requires: 'captions.generate' },
  { path: '/posts', label: 'Run sheet', icon: 'list', requires: 'posts.manage' },
  { path: '/settings', label: 'Alerts', icon: 'bell', requires: 'settings.manage' },
  { path: '/admin', label: 'Admin', icon: 'shield', requires: 'admin.view' },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, Icon],
  template: `
  <header class="sticky top-0 z-40 bg-paper/95 backdrop-blur-[2px] border-b-2 border-ink">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 flex items-stretch h-16">
      <a routerLink="/" class="flex items-center gap-3 pr-4 sm:pr-6 border-r-2 border-ink" aria-label="VSpark home">
        <span class="display text-[2.1rem] leading-none">V<span class="text-teal">spark</span></span>
      </a>
      <div class="hidden md:flex flex-col justify-center px-5 border-r-2 border-ink meta leading-tight">
        <span>Issue {{ today | date: 'yyyy.MM.dd' }}</span><span>{{ today | date: 'EEEE' }}</span>
      </div>
      <nav class="hidden lg:flex items-stretch" aria-label="Main">
        @for (n of nav(); track n.path) {
          <a [routerLink]="n.path" routerLinkActive="!bg-sun" [routerLinkActiveOptions]="{ exact: n.path === '/' }"
             class="flex items-center gap-2 px-4 border-r-2 border-ink text-sm font-bold hover:bg-sun-wash transition-colors">
            <app-icon [name]="n.icon" [size]="16" />{{ n.label }}
          </a>
        }
      </nav>
      <div class="ml-auto flex items-center gap-3">
        <span class="hidden sm:inline-flex items-center gap-1.5 meta" [title]="drive.connected() ? 'Google Drive connected' : 'Google Drive not connected'">
          <app-icon name="cloud" [size]="15" [class]="drive.connected() ? 'text-teal' : 'text-ink-3'" />{{ drive.connected() ? 'Drive on' : 'Drive off' }}
        </span>
        <div class="hidden sm:block text-right leading-tight">
          <div class="text-sm font-bold truncate max-w-40">{{ auth.profile()?.fullName }}</div>
          <div class="meta uppercase">{{ auth.role() }}</div>
        </div>
        <button class="btn btn-sm hidden lg:inline-flex" (click)="logout()" aria-label="Sign out"><app-icon name="out" [size]="15" /></button>
        <button class="btn btn-sm lg:hidden" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="mnav" aria-label="Menu">
          <app-icon [name]="open() ? 'x' : 'menu'" [size]="16" />
        </button>
      </div>
    </div>
    @if (open()) {
      <nav id="mnav" class="lg:hidden border-t-2 border-ink bg-paper" aria-label="Main">
        @for (n of nav(); track n.path) {
          <a [routerLink]="n.path" routerLinkActive="!bg-sun" [routerLinkActiveOptions]="{ exact: n.path === '/' }" (click)="open.set(false)"
             class="flex items-center gap-3 px-5 py-3.5 border-b-2 border-ink font-bold display-md text-xl"><app-icon [name]="n.icon" />{{ n.label }}</a>
        }
        <div class="flex items-center justify-between px-5 py-3">
          <div><div class="font-bold text-sm">{{ auth.profile()?.fullName }}</div><div class="meta">{{ auth.profile()?.email }}</div></div>
          <button class="btn btn-sm" (click)="logout()"><app-icon name="out" [size]="15" /> Sign out</button>
        </div>
      </nav>
    }
  </header>
  <main class="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10"><router-outlet /></main>
  <footer class="mx-auto max-w-7xl px-4 sm:px-6 pb-8"><div class="border-t-2 border-ink pt-3 flex justify-between meta"><span>VSpark · printed in two inks</span><span>Gemini · Drive · Supabase</span></div></footer>`,
})
export class Shell {
  auth = inject(AuthService); drive = inject(DriveService); private router = inject(Router);
  open = signal(false); today = new Date();
  nav = computed(() => NAV.filter((n) => !n.requires || this.auth.can(n.requires)));
  async logout() { await this.auth.signOut(); this.router.navigateByUrl('/login'); }
}
