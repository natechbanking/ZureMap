import { TestBed } from '@angular/core/testing';
import { AutosaveService } from './autosave.service';
import { DiagramStateFile } from './export.service';

describe('AutosaveService', () => {
  let service: AutosaveService;
  const key = 'zuremap.autosave.meta.v1';

  beforeEach(() => {
    localStorage.removeItem(key);
    TestBed.configureTestingModule({
      providers: [AutosaveService],
    });
    service = TestBed.inject(AutosaveService);
  });

  afterEach(() => {
    delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker;
    localStorage.removeItem(key);
  });

  it('enables autosave and persists metadata when file picker + permission succeed', async () => {
    const handle = { name: 'autosave.json' } as FileSystemFileHandle;
    (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker = jasmine
      .createSpy('showSaveFilePicker')
      .and.resolveTo(handle);
    spyOn(service as unknown as { ensurePermission: () => Promise<boolean> }, 'ensurePermission')
      .and.callFake(async () => true);
    spyOn(service as unknown as { setHandle: () => Promise<void> }, 'setHandle')
      .and.callFake(async () => undefined);

    const ok = await service.enableForEmptyDiagram();

    expect(ok).toBeTrue();
    expect(service.enabled()).toBeTrue();
    const meta = JSON.parse(localStorage.getItem(key) || '{}') as { enabled?: boolean; fileName?: string };
    expect(meta.enabled).toBeTrue();
    expect(meta.fileName).toBe('autosave.json');
  });

  it('returns recovery candidate only when metadata and file handle are available', async () => {
    localStorage.setItem(key, JSON.stringify({
      enabled: true,
      origin: 'empty',
      fileName: 'autosave.json',
      lastSavedAt: '2026-04-30T10:00:00.000Z',
    }));
    spyOn(service as unknown as { getHandle: () => Promise<FileSystemFileHandle | null> }, 'getHandle')
      .and.callFake(async () => ({} as FileSystemFileHandle));

    const candidate = await service.getRecoveryCandidate();

    expect(candidate).toEqual({
      fileName: 'autosave.json',
      lastSavedAt: '2026-04-30T10:00:00.000Z',
    });
  });

  it('restoreFile returns null when read permission is denied', async () => {
    spyOn(service as unknown as { getHandle: () => Promise<FileSystemFileHandle | null> }, 'getHandle')
      .and.callFake(async () => ({} as FileSystemFileHandle));
    spyOn(service as unknown as { ensurePermission: () => Promise<boolean> }, 'ensurePermission')
      .and.callFake(async () => false);

    const restored = await service.restoreFile();

    expect(restored).toBeNull();
  });

  it('queueSave does not attempt write when autosave is not enabled', async () => {
    const writeSpy = spyOn(service as unknown as { writeState: () => Promise<void> }, 'writeState')
      .and.callFake(async () => undefined);
    const state = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      subscriptions: [],
      nodes: [],
      edges: [],
      annotations: [],
    } as DiagramStateFile;

    service.queueSave(state);
    await Promise.resolve();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('disable clears runtime state, local metadata, and handle record', async () => {
    (service as unknown as { metadata: unknown }).metadata = {
      enabled: true,
      origin: 'empty',
      fileName: 'autosave.json',
      lastSavedAt: null,
    };
    service.enabled.set(true);
    service.lastSavedAt.set('2026-04-30T12:00:00.000Z');
    localStorage.setItem(key, JSON.stringify({
      enabled: true,
      origin: 'empty',
      fileName: 'autosave.json',
      lastSavedAt: null,
    }));
    spyOn(service as unknown as { deleteHandle: () => Promise<void> }, 'deleteHandle')
      .and.callFake(async () => undefined);

    await service.disable();

    expect(service.enabled()).toBeFalse();
    expect(service.lastSavedAt()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('returns null recovery candidate when metadata is invalid', async () => {
    localStorage.setItem(key, JSON.stringify({ enabled: false, origin: 'empty', fileName: 'x.json', lastSavedAt: null }));
    const candidate = await service.getRecoveryCandidate();
    expect(candidate).toBeNull();
  });

  it('queueSave writes when autosave is enabled', async () => {
    service.enabled.set(true);
    (service as unknown as { metadata: unknown }).metadata = {
      enabled: true,
      origin: 'empty',
      fileName: 'autosave.json',
      lastSavedAt: null,
    };
    const writeSpy = spyOn(service as unknown as { writeState: (state: DiagramStateFile) => Promise<void> }, 'writeState')
      .and.callFake(async () => undefined);
    const state: DiagramStateFile = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      subscriptions: [],
      nodes: [],
      edges: [],
      annotations: [],
    };

    service.queueSave(state);
    await Promise.resolve();
    await Promise.resolve();

    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith(state);
  });
});
