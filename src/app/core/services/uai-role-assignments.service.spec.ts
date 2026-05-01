import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { UaiRoleAssignmentsService } from './uai-role-assignments.service';

describe('UaiRoleAssignmentsService', () => {
  let service: UaiRoleAssignmentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [UaiRoleAssignmentsService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(UaiRoleAssignmentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests assignments for principal and subscription', async () => {
    const p = service.getAssignments('pid-1', 'sub-1');
    const req = httpMock.expectOne('/api/az/uai-role-assignments?principalId=pid-1&subscriptionId=sub-1');
    req.flush([{ id: '1', roleDefinitionName: 'Reader', scope: '/s', principalType: 'ServicePrincipal', description: null }]);

    await expectAsync(p).toBeResolved();
  });
});
