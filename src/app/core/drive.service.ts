import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { Post } from './models';

declare const google: any;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'VSpark Drafts';

/** Google Drive sync using Google Identity Services (browser OAuth, drive.file scope = only files this app creates). */
@Injectable({ providedIn: 'root' })
export class DriveService {
  readonly connected = signal(false);
  readonly email = signal<string | null>(null);
  readonly configured = !!environment.googleClientId;
  private token: string | null = null;
  private expires = 0;
  private folderId: string | null = null;
  private client: any;

  constructor() {
    try {
      const t = JSON.parse(sessionStorage.getItem('vs_drive') ?? 'null');
      if (t && t.expires > Date.now()) { this.token = t.token; this.expires = t.expires; this.connected.set(true); }
    } catch {}
  }

  private loadGis(): Promise<void> {
    if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('Could not load Google sign-in'));
      document.head.appendChild(s);
    });
  }

  async connect(): Promise<void> {
    if (!this.configured) throw new Error('Google Drive is not configured (missing Google Client ID).');
    await this.loadGis();
    await new Promise<void>((resolve, reject) => {
      this.client = google.accounts.oauth2.initTokenClient({
        client_id: environment.googleClientId,
        scope: SCOPE,
        callback: (r: any) => {
          if (r.error) return reject(new Error(r.error_description || r.error));
          this.token = r.access_token; this.expires = Date.now() + (r.expires_in - 60) * 1000;
          sessionStorage.setItem('vs_drive', JSON.stringify({ token: this.token, expires: this.expires }));
          this.connected.set(true); resolve();
        },
        error_callback: (e: any) => reject(new Error(e?.message || 'Google sign-in was closed')),
      });
      this.client.requestAccessToken({ prompt: '' });
    });
  }
  disconnect() {
    if (this.token && (window as any).google) google.accounts.oauth2.revoke(this.token, () => {});
    this.token = null; this.connected.set(false); this.folderId = null; sessionStorage.removeItem('vs_drive');
  }
  private async ensureToken() {
    if (!this.token || Date.now() > this.expires) await this.connect();
    return this.token!;
  }
  private async api(url: string, init: RequestInit = {}) {
    const token = await this.ensureToken();
    const r = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
    if (r.status === 401) { this.disconnect(); throw new Error('Google session expired — reconnect Drive.'); }
    if (!r.ok && r.status !== 404) throw new Error(`Google Drive error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
  }
  private async folder(): Promise<string> {
    if (this.folderId) return this.folderId;
    const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const r = await (await this.api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`)).json();
    if (r.files?.length) return (this.folderId = r.files[0].id);
    const c = await (await this.api('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
    })).json();
    return (this.folderId = c.id);
  }

  /** Create or update the draft file in Drive. Returns the Drive file id. */
  async savePost(p: Post): Promise<string> {
    const doc = {
      app: 'VSpark', id: p.id, title: p.title, platform: p.platform, tone: p.tone, status: p.status,
      scheduledAt: p.scheduledAt, caption: p.caption, hashtags: p.hashtags, taskNotes: p.taskNotes,
      media: p.mediaName, updatedAt: new Date().toISOString(),
    };
    const meta: any = { name: `${p.title.replace(/[\\/]/g, '-')} — ${p.platform}.json`, mimeType: 'application/json',
      description: `${p.caption}\n\n${p.hashtags.join(' ')}`, appProperties: { vsparkId: p.id } };
    const boundary = 'vs' + Math.random().toString(16).slice(2);
    const make = (m: any) => `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(m)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(doc, null, 2)}\r\n--${boundary}--`;
    const headers = { 'Content-Type': `multipart/related; boundary=${boundary}` };
    if (p.driveFileId) {
      const r = await this.api(`https://www.googleapis.com/upload/drive/v3/files/${p.driveFileId}?uploadType=multipart&fields=id`, { method: 'PATCH', headers, body: make(meta) });
      if (r.status !== 404) return (await r.json()).id;
    }
    meta.parents = [await this.folder()];
    const r = await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers, body: make(meta) });
    return (await r.json()).id;
  }
  async deleteFile(id: string) { await this.api(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' }); }
  fileUrl(id: string) { return `https://drive.google.com/file/d/${id}/view`; }
}
