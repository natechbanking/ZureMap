import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { ScanComponent } from './scan.component';
import { AzAuthService } from '../../core/services/az-auth.service';
import { ResourceGraphService } from '../../core/services/resource-graph.service';
import { ResourceMapperService } from '../../core/services/resource-mapper.service';
import { ConnectionResolverService } from '../../core/services/connection-resolver.service';
import { ELKLayoutService } from '../../core/services/elk-layout.service';
import { ExportService } from '../../core/services/export.service';
import { AutosaveService } from '../../core/services/autosave.service';
import { DiagramStore } from '../../core/store/diagram.store';
import { makeSubscription } from '../../testing/test-helpers';
import { environment } from '../../../environments/environment';

describe('ScanComponent', () => {
  let component: ScanComponent;
  let autosave: jasmine.SpyObj<AutosaveService>;
  let router: jasmine.SpyObj<Router>;
  let store: DiagramStore;

  beforeEach(async () => {
    autosave = jasmine.createSpyObj<AutosaveService>('AutosaveService', [
      'supportsLocalFileAutosave',
      'disable',
      'enableForEmptyDiagram',
      'getRecoveryCandidate',
      'restoreFile',
    ]);
    autosave.disable.and.resolveTo();
    autosave.enableForEmptyDiagram.and.resolveTo(true);
    autosave.getRecoveryCandidate.and.resolveTo(null);
    autosave.supportsLocalFileAutosave.and.returnValue(true);

    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [ScanComponent],
      providers: [
        DiagramStore,
        { provide: AzAuthService, useValue: {
          checkLoginStatus: () => of({ loggedIn: true }),
          login: () => of(undefined),
          loginWithDeviceCode: () => of({ verificationUrl: 'https://microsoft.com/devicelogin', userCode: 'ABC-123', message: 'Use the code ABC-123' }),
          listSubscriptions: () => of([makeSubscription()]),
        } },
        { provide: ResourceGraphService, useValue: {} },
        { provide: ResourceMapperService, useValue: {} },
        { provide: ConnectionResolverService, useValue: {} },
        { provide: ELKLayoutService, useValue: { layout: jasmine.createSpy('layout').and.resolveTo([]) } },
        { provide: ExportService, useValue: {} },
        { provide: AutosaveService, useValue: autosave },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ScanComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(DiagramStore);
  });

  it('toggleAutosaveOption does nothing when picker unsupported', () => {
    component.optionsEnableAutosave = false;
    autosave.supportsLocalFileAutosave.and.returnValue(false);

    component.toggleAutosaveOption();

    expect(component.optionsEnableAutosave).toBeFalse();
  });

  it('confirmOptions disables autosave when option is off and starts scan', async () => {
    const runSpy = spyOn(component as unknown as { runScan: (ids: string[]) => Promise<void> }, 'runScan').and.resolveTo();
    store.activeSubscriptions.set([makeSubscription({ subscriptionId: 'sub-a' })]);
    component.optionsEnableAutosave = false;

    await component.confirmOptions();

    expect(autosave.disable).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledWith(['sub-a']);
  });

  it('confirmOptions aborts when picker is unsupported but autosave enabled', async () => {
    const runSpy = spyOn(component as unknown as { runScan: (ids: string[]) => Promise<void> }, 'runScan').and.resolveTo();
    const alertSpy = spyOn(window, 'alert');
    component.optionsEnableAutosave = true;
    autosave.supportsLocalFileAutosave.and.returnValue(false);

    await component.confirmOptions();

    expect(alertSpy).toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
  });

  it('startEmptyCanvas aborts when user declines picker after enabling prompt', async () => {
    const confirmSpy = spyOn(window, 'confirm').and.returnValues(true);
    autosave.enableForEmptyDiagram.and.resolveTo(false);
    autosave.supportsLocalFileAutosave.and.returnValue(true);

    await component.startEmptyCanvas();

    expect(confirmSpy).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalledWith(['/canvas']);
  });

  it('beginAzureScanFlow sets needsLogin when not authenticated', () => {
    const auth = TestBed.inject(AzAuthService) as unknown as { checkLoginStatus: jasmine.Spy };
    auth.checkLoginStatus = jasmine.createSpy('checkLoginStatus').and.returnValue(of({ loggedIn: false }));

    component.beginAzureScanFlow();

    expect(component.needsLogin).toBeTrue();
    expect(store.scanPhase()).toBe('idle');
  });

  it('beginAzureScanFlow shows login panel when AUTH_REQUIRED is returned', () => {
    const auth = TestBed.inject(AzAuthService) as unknown as { checkLoginStatus: jasmine.Spy };
    auth.checkLoginStatus = jasmine.createSpy('checkLoginStatus').and.returnValue(of({
      loggedIn: false,
      error: "Azure CLI authentication required. Please run 'az login' and try again.",
      code: 'AUTH_REQUIRED',
      detail: 'The current account still needs interactive authentication.',
    }));

    component.beginAzureScanFlow();

    expect(component.needsLogin).toBeTrue();
    expect(store.scanPhase()).toBe('idle');
  });

  it('startEmptyCanvas clears and navigates when autosave is declined', async () => {
    if (environment.isDemo) {
      pending('Demo mode bypasses autosave prompt flow');
      return;
    }
    spyOn(window, 'confirm').and.returnValue(false);
    store.setNodes([]);

    await component.startEmptyCanvas();

    expect(autosave.disable).toHaveBeenCalled();
    expect(store.canvasSessionMode()).toBe('empty');
    expect(router.navigate).toHaveBeenCalledWith(['/canvas']);
  });

  it('loginWithDeviceCode shows the prompt and starts polling', () => {
    spyOn(window, 'setInterval').and.returnValue(123 as unknown as number);

    component.loginWithDeviceCode();

    expect(component.deviceCodeLogin()?.userCode).toBe('ABC-123');
    expect(component.deviceCodePolling()).toBeTrue();
  });

  it('checkDeviceCodeLogin loads subscriptions after successful device-code sign-in', () => {
    const auth = TestBed.inject(AzAuthService) as unknown as {
      checkLoginStatus: jasmine.Spy;
      listSubscriptions: jasmine.Spy;
    };
    auth.checkLoginStatus = jasmine.createSpy('checkLoginStatus').and.returnValue(of({ loggedIn: true }));
    auth.listSubscriptions = jasmine.createSpy('listSubscriptions').and.returnValue(of([makeSubscription({ subscriptionId: 'sub-1' })]));

    component.checkDeviceCodeLogin();

    expect(auth.listSubscriptions).toHaveBeenCalled();
    expect(store.scanPhase()).toBe('selecting-subscription');
  });
});
