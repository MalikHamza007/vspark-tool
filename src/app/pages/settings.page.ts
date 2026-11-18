import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DriveService } from '../core/drive.service';
import { friendlyError } from '../core/errors';
import { NotificationLog, NotificationSettings } from '../core/models';
import { PostsService } from '../core/posts.service';
import { ToastService } from '../core/toast.service';

const ZONES = ['Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'UTC'];

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, DatePipe],
  template: `
  <header class="mb-6"><h1 class="display text-[clamp(2.6rem,8vw,5rem)]">Notifications &amp; Integrations</h1>
    <p class="text-ink-2 text-sm">Choose when and how you're emailed about scheduled posts, and connect Google Drive.</p></header>
  <div class="grid xl:grid-cols-3 gap-6">
    <form [formGroup]="form" (ngSubmit)="save()" class="panel p-6 space-y-4 xl:col-span-2">
      @if (loading()) { <div class="text-sm text-ink-2">Loading settings…</div> }
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="label" for="em">Send emails to</label><input id="em" class="input" type="email" formControlName="email" />
          @if (form.controls.email.touched && form.controls.email.invalid) { <p class="err">Valid email required</p> }</div>
        <div><label class="label" for="tz">Timezone</label><select id="tz" class="input" formControlName="timezone">@for (z of zones; track z) { <option [value]="z">{{ z }}</option> }</select></div>
      </div>
      <div class="grid sm:grid-cols-3 gap-3">
        <label class="flex items-center gap-2 text-sm panel !shadow-none p-3"><input type="checkbox" formControlName="enabled" class="accent-[#00757b] h-4 w-4" /> Notifications on</label>
        <label class="flex items-center gap-2 text-sm panel !shadow-none p-3"><input type="checkbox" formControlName="sendOnSchedule" class="accent-[#00757b] h-4 w-4" /> Email when scheduled</label>
        <label class="flex items-center gap-2 text-sm panel !shadow-none p-3"><input type="checkbox" formControlName="sendReminder" class="accent-[#00757b] h-4 w-4" /> Reminder before post</label>
      </div>
      <div><label class="label" for="lm">Reminder lead time (minutes before)</label>
        <input id="lm" type="number" min="0" max="1440" class="input !w-40" formControlName="leadMinutes" />
        @if (form.controls.leadMinutes.invalid) { <p class="err">0–1440 minutes</p> }</div>
      <div><label class="label" for="sj">Subject template</label><input id="sj" class="input" formControlName="subjectTemplate" />
        @if (form.controls.subjectTemplate.invalid) { <p class="err">3–200 characters</p> }</div>
      <div><label class="label" for="bd">Body template</label><textarea id="bd" rows="7" class="input font-mono text-xs" formControlName="bodyTemplate"></textarea></div>
      <p class="text-xs text-ink-2">Placeholders: <code>{{ '{{name}}' }}</code> <code>{{ '{{title}}' }}</code> <code>{{ '{{platform}}' }}</code> <code>{{ '{{time}}' }}</code> <code>{{ '{{caption}}' }}</code> <code>{{ '{{hashtags}}' }}</code> <code>{{ '{{notes}}' }}</code></p>
      <div class=" bg-paper-2 border-2 border-ink p-4 text-sm">
        <div class="label">Live preview</div>
        <div class="font-semibold">{{ render(form.value.subjectTemplate ?? '') }}</div>
        <pre class="whitespace-pre-wrap text-ink-2 mt-2 font-sans">{{ render(form.value.bodyTemplate ?? '') }}</pre>
      </div>
      <div class="flex justify-end"><button class="btn-primary" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save settings' }}</button></div>
    </form>

    <div class="space-y-6">
      <div class="panel p-6">
        <h2 class="display-md text-2xl">Google Drive</h2>
        <p class="text-sm text-ink-2 mt-1">Drafts are saved as JSON files in a <b>VSpark Drafts</b> folder. Access is limited to files this app creates.</p>
        @if (!drive.configured) { <p class="text-sm mt-3 text-ink bg-sun-wash p-3">Google Client ID not configured for this deployment.</p> }
        @else if (drive.connected()) {
          <div class="mt-3 flex items-center gap-2 text-teal text-sm"><span class="h-2 w-2 bg-teal"></span> Connected</div>
          <button class="btn-ghost mt-3" (click)="drive.disconnect()">Disconnect</button>
        } @else { <button class="btn-primary mt-3" (click)="connect()">Connect Google Drive</button> }
      </div>
      <div class="panel p-6">
        <div class="flex justify-between items-center"><h2 class="display-md text-2xl">Email activity</h2><button class="text-xs text-teal-ink" (click)="loadLogs()">Refresh</button></div>
        @if (!logs().length) { <p class="text-sm text-ink-2 mt-3">No emails yet.</p> }
        <ul class="mt-3 space-y-2">
          @for (l of logs(); track l.id) {
            <li class="text-sm border-b-2 border-ink border-ink pb-2">
              <div class="flex justify-between gap-2"><span class="truncate">{{ l.subject }}</span>
                <span class="chip shrink-0" [class]="l.status === 'sent' ? 'text-teal' : l.status === 'failed' ? 'bg-red-wash text-red' : 'bg-paper-2 text-ink-2'">{{ l.status }}</span></div>
              <div class="text-xs text-ink-3">{{ l.kind }} · {{ l.createdAt | date: 'd MMM, h:mm a' }} @if (l.error) { · {{ l.error }} }</div>
            </li>
          }
        </ul>
      </div>
    </div>
  </div>`,
})
export class SettingsPage {
  drive = inject(DriveService); private posts = inject(PostsService); private toast = inject(ToastService);
  zones = ZONES; loading = signal(true); saving = signal(false); logs = signal<NotificationLog[]>([]);
  private current: NotificationSettings | null = null;
  form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]], timezone: ['Asia/Karachi'],
    enabled: [true], sendOnSchedule: [true], sendReminder: [true],
    leadMinutes: [15, [Validators.required, Validators.min(0), Validators.max(1440)]],
    subjectTemplate: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    bodyTemplate: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(4000)]],
  });
  async ngOnInit() {
    try { this.current = await this.posts.getSettings(); if (this.current) this.form.patchValue(this.current); }
    catch (e) { this.toast.show(friendlyError(e), 'err'); } finally { this.loading.set(false); }
    this.loadLogs();
  }
  async loadLogs() { try { this.logs.set(await this.posts.logs(15)); } catch {} }
  render(t: string) {
    const v: Record<string, string> = { name: 'Ayesha', title: 'Autumn menu launch', platform: 'instagram', time: '21 Nov 2026, 6:00 pm', caption: 'Cozy season is here ☕🍂', hashtags: '#autumn #coffee', notes: 'Use latte photo' };
    return t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => v[k] ?? '');
  }
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.current) return;
    this.saving.set(true);
    try { this.current = await this.posts.saveSettings({ ...this.current, ...this.form.getRawValue() }); this.toast.show('Notification settings saved'); }
    catch (e) { this.toast.show(friendlyError(e), 'err'); } finally { this.saving.set(false); }
  }
  async connect() { try { await this.drive.connect(); this.toast.show('Google Drive connected'); } catch (e) { this.toast.show(friendlyError(e), 'err'); } }
}
