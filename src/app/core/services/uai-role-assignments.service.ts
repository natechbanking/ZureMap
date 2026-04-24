import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface UaiRoleAssignment {
  id: string;
  roleDefinitionName: string;
  scope: string;
  principalType: string;
  description: string | null;
}

@Injectable({ providedIn: 'root' })
export class UaiRoleAssignmentsService {
  private readonly base = '/api/az';

  constructor(private http: HttpClient) {}

  async getAssignments(principalId: string, subscriptionId: string): Promise<UaiRoleAssignment[]> {
    return firstValueFrom(
      this.http.get<UaiRoleAssignment[]>(`${this.base}/uai-role-assignments`, {
        params: { principalId, subscriptionId },
      })
    );
  }
}
