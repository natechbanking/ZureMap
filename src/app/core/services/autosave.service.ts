import { Injectable, signal } from '@angular/core';
import { DiagramStateFile } from './export.service';

interface AutosaveMetadata {
  enabled: boolean;
  origin: 'empty';
  fileName: string;
  lastSavedAt: string | null;
}

interface IdbRecord {
  id: string;
  value: unknown;
}

export interface AutosaveRecoveryCandidate {
  fileName: string;
  lastSavedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class AutosaveService {
  private static readonly META_KEY = 'zuremap.autosave.meta.v1';
  private static readonly DB_NAME = 'zuremap-autosave-db';
  private static readonly STORE_NAME = 'kv';
  private static readonly HANDLE_KEY = 'autosave-handle';

  readonly enabled = signal(false);
  readonly lastSavedAt = signal<string | null>(null);

  private metadata: AutosaveMetadata | null = null;
  private fileHandle: FileSystemFileHandle | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor() {
    this.metadata = this.readMetadata();
    this.enabled.set(!!this.metadata?.enabled);
    this.lastSavedAt.set(this.metadata?.lastSavedAt ?? null);
  }

  supportsLocalFileAutosave(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  async enableForEmptyDiagram(): Promise<boolean> {
    if (!this.supportsLocalFileAutosave()) return false;
    try {
      const picker = (window as unknown as { showSaveFilePicker: (options?: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
      const handle = await picker({
        suggestedName: `zuremap-autosave-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
        types: [{ description: 'ZureMap JSON', accept: { 'application/json': ['.json'] } }],
      });
      const ok = await this.ensurePermission(handle, true);
      if (!ok) return false;
      await this.setHandle(handle);
      this.metadata = {
        enabled: true,
        origin: 'empty',
        fileName: handle.name || 'zuremap-autosave.json',
        lastSavedAt: null,
      };
      this.writeMetadata(this.metadata);
      this.enabled.set(true);
      this.lastSavedAt.set(null);
      return true;
    } catch {
      return false;
    }
  }

  async disable(): Promise<void> {
    this.enabled.set(false);
    this.lastSavedAt.set(null);
    this.metadata = null;
    this.fileHandle = null;
    try {
      localStorage.removeItem(AutosaveService.META_KEY);
    } catch {
      // storage may be unavailable; ignore
    }
    try {
      await this.deleteHandle();
    } catch {
      // IndexedDB may be unavailable or the record may not exist; ignore
    }
  }

  async getRecoveryCandidate(): Promise<AutosaveRecoveryCandidate | null> {
    const meta = this.readMetadata();
    if (!meta?.enabled || meta.origin !== 'empty') return null;
    const handle = await this.getHandle();
    if (!handle) return null;
    return { fileName: meta.fileName, lastSavedAt: meta.lastSavedAt };
  }

  async restoreFile(): Promise<File | null> {
    const handle = await this.getHandle();
    if (!handle) return null;
    const ok = await this.ensurePermission(handle, false);
    if (!ok) return null;
    return handle.getFile();
  }

  queueSave(state: DiagramStateFile): void {
    if (!this.enabled() || !this.metadata) return;
    this.writeQueue = this.writeQueue
      .then(() => this.writeState(state))
      .catch(() => undefined);
  }

  private async writeState(state: DiagramStateFile): Promise<void> {
    const handle = await this.getHandle();
    if (!handle) return;
    const ok = await this.ensurePermission(handle, true);
    if (!ok) return;
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();
    const savedAt = new Date().toISOString();
    this.metadata = {
      enabled: true,
      origin: 'empty',
      fileName: handle.name || this.metadata?.fileName || 'zuremap-autosave.json',
      lastSavedAt: savedAt,
    };
    this.writeMetadata(this.metadata);
    this.lastSavedAt.set(savedAt);
  }

  private async ensurePermission(handle: FileSystemFileHandle, write: boolean): Promise<boolean> {
    const mode = write ? 'readwrite' : 'read';
    const opts = { mode };
    const handleAny = handle as FileSystemFileHandle & {
      queryPermission?: (descriptor?: { mode?: string }) => Promise<PermissionState>;
      requestPermission?: (descriptor?: { mode?: string }) => Promise<PermissionState>;
    };
    try {
      if (handleAny.queryPermission && (await handleAny.queryPermission(opts)) === 'granted') return true;
      if (handleAny.requestPermission) return (await handleAny.requestPermission(opts)) === 'granted';
      return true;
    } catch {
      return false;
    }
  }

  private readMetadata(): AutosaveMetadata | null {
    try {
      const raw = localStorage.getItem(AutosaveService.META_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AutosaveMetadata;
      if (!parsed.enabled || parsed.origin !== 'empty' || !parsed.fileName) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private writeMetadata(meta: AutosaveMetadata): void {
    localStorage.setItem(AutosaveService.META_KEY, JSON.stringify(meta));
  }

  private async setHandle(handle: FileSystemFileHandle): Promise<void> {
    this.fileHandle = handle;
    await this.putRecord({ id: AutosaveService.HANDLE_KEY, value: handle });
  }

  private async getHandle(): Promise<FileSystemFileHandle | null> {
    if (this.fileHandle) return this.fileHandle;
    try {
      const rec = await this.getRecord(AutosaveService.HANDLE_KEY);
      const handle = (rec?.value ?? null) as FileSystemFileHandle | null;
      this.fileHandle = handle;
      return handle;
    } catch {
      return null;
    }
  }

  private async deleteHandle(): Promise<void> {
    await this.deleteRecord(AutosaveService.HANDLE_KEY);
  }

  private openDb(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(AutosaveService.DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(AutosaveService.STORE_NAME)) {
          db.createObjectStore(AutosaveService.STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async putRecord(record: IdbRecord): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AutosaveService.STORE_NAME, 'readwrite');
      tx.objectStore(AutosaveService.STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }

  private async getRecord(id: string): Promise<IdbRecord | null> {
    const db = await this.openDb();
    const record = await new Promise<IdbRecord | null>((resolve, reject) => {
      const tx = db.transaction(AutosaveService.STORE_NAME, 'readonly');
      const req = tx.objectStore(AutosaveService.STORE_NAME).get(id);
      req.onsuccess = () => resolve((req.result as IdbRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  }

  private async deleteRecord(id: string): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AutosaveService.STORE_NAME, 'readwrite');
      tx.objectStore(AutosaveService.STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  }
}
