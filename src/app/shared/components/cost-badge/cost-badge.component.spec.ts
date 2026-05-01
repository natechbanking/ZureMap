import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NodeCostData } from '../../../core/models/cost-data.model';
import { getCostBorderStyle } from '../../../core/utils/cost-thresholds';
import { CostBadgeComponent } from './cost-badge.component';

describe('CostBadgeComponent', () => {
  let fixture: ComponentFixture<CostBadgeComponent>;
  let component: CostBadgeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CostBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CostBadgeComponent);
    component = fixture.componentInstance;
  });

  it('renders formatted cost and tooltip when costData exists', () => {
    const costData: NodeCostData = {
      monthlyCostUsd: 1500,
      currency: 'USD',
      period: 'last30',
      isEstimate: false,
    };
    component.costData = costData;
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('span') as HTMLSpanElement | null;
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('$1.5k');
    expect(badge?.title).toContain('Cost for selected period: USD 1500.00');
  });

  it('returns threshold color for tierColor', () => {
    component.costData = {
      monthlyCostUsd: 3000,
      currency: 'USD',
      period: 'mtd',
      isEstimate: true,
    };

    expect(component.tierColor).toBe(getCostBorderStyle(3000).borderColor);
  });
});
