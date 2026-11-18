import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { CaptionOption, NotificationLog, NotificationSettings, Platform, Post, Profile, toCamel, toSnake } from './models';
import { environment } from '../../environments/environment';

const BUCKET = 'vs-post-media';

@Injectable({ providedIn: 'root' })
export class PostsService {
  private sbs = inject(SupabaseService);
  private sb = this.sbs.client;
  readonly posts = signal<Post[]>([]);
  readonly loading = signal(false);

  async load(all = false): Promise<Post[]> {
    this.loading.set(true);
    try {
      let q = this.sb.from('vs_posts').select('*').order('scheduled_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
      if (!all) { const uid = (await this.sb.auth.getUser()).data.user?.id; if (uid) q = q.eq('user_id', uid); }
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => toCamel<Post>(r));
      if (!all) this.posts.set(rows);
      return rows;
    } finally { this.loading.set(false); }
  }

  async create(p: Partial<Post>): Promise<Post> {
    const { data, error } = await this.sb.from('vs_posts').insert(toSnake(p)).select().single();
    if (error) throw error;
    const post = toCamel<Post>(data);
    this.posts.update((l) => [post, ...l]);
    return post;
  }

  async update(id: string, patch: Partial<Post>): Promise<Post> {
    const { data, error } = await this.sb.from('vs_posts').update(toSnake(patch)).eq('id', id).select();
    if (error) throw error;
    if (!data?.length) throw { code: '42501', message: 'Not allowed' };
    const post = toCamel<Post>(data[0]);
    this.posts.update((l) => l.map((x) => (x.id === id ? post : x)));
    return post;
  }

  async remove(p: Post) {
    const { data, error } = await this.sb.from('vs_posts').delete().eq('id', p.id).select('id');
    if (error) throw error;
    if (!data?.length) throw { code: '42501', message: 'Not allowed' };
    if (p.mediaPath) await this.sb.storage.from(BUCKET).remove([p.mediaPath]);
    this.posts.update((l) => l.filter((x) => x.id !== p.id));
  }

  // ---- Gemini (via Edge Function proxy) ----
  generate(prompt: string, platform: Platform, tone: string, fresh = false) {
    return this.sbs.fn<{ captions: CaptionOption[]; cached: boolean; stale?: boolean; model: string }>('vs-generate-captions', { prompt, platform, tone, count: 3, fresh });
  }

  // ---- Storage ----
  async uploadMedia(file: File): Promise<{ mediaPath: string; mediaName: string; mediaType: string; mediaSize: number }> {
    const uid = (await this.sb.auth.getUser()).data.user!.id;
    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${uid}/${crypto.randomUUID()}/${safe}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return { mediaPath: path, mediaName: file.name, mediaType: file.type, mediaSize: file.size };
  }
  async removeMedia(path: string) { await this.sb.storage.from(BUCKET).remove([path]); }
  async signedUrl(path: string, download = false): Promise<string> {
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 60, download ? { download: true } : undefined);
    if (error) throw error;
    return data.signedUrl;
  }
  isProjectSignedUrl(u: string) { return u.startsWith(`${environment.supabaseUrl}/storage/v1/object/sign/`); }

  // ---- Notifications ----
  notify(postId: string, kind: 'scheduled' | 'manual') {
    return this.sbs.fn<{ status: string; error?: string }>('vs-notify', { postId, kind });
  }
  async getSettings(): Promise<NotificationSettings | null> {
    const uid = (await this.sb.auth.getUser()).data.user?.id;
    const { data } = await this.sb.from('vs_notification_settings').select('*').eq('user_id', uid).maybeSingle();
    return data ? toCamel<NotificationSettings>(data) : null;
  }
  async saveSettings(s: NotificationSettings) {
    const { data, error } = await this.sb.from('vs_notification_settings').upsert(toSnake(s)).select().single();
    if (error) throw error;
    return toCamel<NotificationSettings>(data);
  }
  async logs(limit = 30): Promise<NotificationLog[]> {
    const { data, error } = await this.sb.from('vs_notification_log').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => toCamel<NotificationLog>(r));
  }
  async profiles(): Promise<Profile[]> {
    const { data, error } = await this.sb.from('vs_profiles').select('*').order('created_at');
    if (error) throw error;
    return (data ?? []).map((r) => toCamel<Profile>(r));
  }
}
