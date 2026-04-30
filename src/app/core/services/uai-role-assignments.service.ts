import { Injectable } from '@angular/core';
import { BaseHttpService } from './base-http.service';

export interface UaiRoleAssignment {
  id: string;
  roleDefinitionName: string;
  scope: string;
  principalType: string;
  description: string | null;
}

@Injectable({ providedIn: 'root' })
export class UaiRoleAssignmentsService extends BaseHttpService {
  getAssignments(principalId: string, subscriptionId: string): Promise<UaiRoleAssignment[]> {
    return this.get('uai-role-assignments', { principalId, subscriptionId });
  }
}
