import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DrawingToolbarComponent } from './drawing-toolbar.component';
import { IconRegistryService } from '../../../core/services/icon-registry.service';

describe('DrawingToolbarComponent', () => {
  let fixture: ComponentFixture<DrawingToolbarComponent>;
  let component: DrawingToolbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrawingToolbarComponent],
      providers: [
        {
          provide: IconRegistryService,
          useValue: {
            getHybridResourceTypeCatalog: () => [
              {
                type: 'microsoft.compute/virtualmachines',
                label: 'Virtual Machine',
                iconUrl: 'icons/compute/10021-icon-service-Virtual-Machine.svg',
                category: 'compute',
                source: 'curated',
              },
            ],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawingToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('uses hybrid resource catalog on init', () => {
    expect(component.resourceCatalog.length).toBe(1);
    expect(component.resourceCatalog[0].source).toBe('curated');
    expect(component.resourceCategories).toContain('compute');
  });

  it('adds a tag rule from the unified builder when rule type is tag', () => {
    const emitSpy = spyOn(component.tagRulesChange, 'emit');
    component.draftRuleType = 'tag';
    component.draftKey = 'env';
    component.draftOperator = 'eq';
    component.draftValue = 'prod';
    component.draftTarget = 'node';
    component.draftColor = '#ef4444';
    component.draftBadge = 'Production';

    component.addRule();

    expect(emitSpy).toHaveBeenCalledTimes(1);
    const rules = (emitSpy.calls.mostRecent().args[0] ?? []) as unknown as Record<string, unknown>[];
    expect(rules.length).toBe(1);
    expect(rules[0]['type']).toBe('tag');
    expect(rules[0]['tagKey']).toBe('env');
    expect(rules[0]['tagValue']).toBe('prod');
    expect(rules[0]['target']).toBe('node');
    expect(rules[0]['color']).toBe('#ef4444');
    expect(rules[0]['badgeLabel']).toBe('Production');
  });

  it('adds an internal-item style rule from the unified builder when rule type is internal-item', () => {
    const emitSpy = spyOn(component.tagRulesChange, 'emit');
    component.draftRuleType = 'internal-item';
    component.draftInternalQuery = 'port';
    component.draftInternalTextColor = '#111111';
    component.draftInternalBackgroundColor = '#eeeeee';

    component.addRule();

    expect(emitSpy).toHaveBeenCalledTimes(1);
    const rules = (emitSpy.calls.mostRecent().args[0] ?? []) as unknown as Record<string, unknown>[];
    expect(rules.length).toBe(1);
    expect(rules[0]['type']).toBe('internal-item');
    expect(rules[0]['textQuery']).toBe('port');
    expect(rules[0]['textColor']).toBe('#111111');
    expect(rules[0]['backgroundColor']).toBe('#eeeeee');
  });

  it('summarizes internal-item and tag rules in active rules list helpers', () => {
    const tagRule = {
      id: 'r1',
      type: 'tag' as const,
      tagKey: 'env',
      operator: 'eq' as const,
      tagValue: 'prod',
      target: 'node' as const,
      color: '#ef4444',
    };
    const internalRule = {
      id: 'r2',
      type: 'internal-item' as const,
      textQuery: 'port',
      textColor: '#111111',
      backgroundColor: '#eeeeee',
    };

    expect(component.ruleTypeLabel(tagRule)).toBe('Tag Highlight');
    expect(component.ruleSummary(tagRule)).toContain('env = prod');
    expect(component.ruleDetail(tagRule)).toContain('Nodes');
    expect(component.ruleSwatchColor(tagRule)).toBe('#ef4444');

    expect(component.ruleTypeLabel(internalRule)).toBe('Internal Labels');
    expect(component.ruleSummary(internalRule)).toContain('label contains "port"');
    expect(component.ruleDetail(internalRule)).toContain('#111111');
    expect(component.ruleSwatchColor(internalRule)).toBe('#eeeeee');
  });

  it('includes RG/subscription container tools and emits toolChange', () => {
    const emitSpy = spyOn(component.toolChange, 'emit');
    const rgTool = component.tools.find(t => t.id === 'rgContainer');
    const subTool = component.tools.find(t => t.id === 'subscriptionContainer');

    expect(rgTool).toBeDefined();
    expect(subTool).toBeDefined();

    component.toolChange.emit('rgContainer');
    expect(emitSpy).toHaveBeenCalledWith('rgContainer');
  });

  it('returns active hint for new container tools', () => {
    component.activeTool = 'rgContainer';
    expect(component.getActiveToolHint()).toContain('resource group container');

    component.activeTool = 'subscriptionContainer';
    expect(component.getActiveToolHint()).toContain('subscription container');
  });

  it('includes hand tool and supports hand hint', () => {
    const handTool = component.tools.find(t => t.id === 'hand');
    expect(handTool).toBeDefined();

    component.activeTool = 'hand';
    expect(component.getActiveToolHint()).toContain('pan');
  });

  it('hides style panel when hand tool is active without style-edit selection', () => {
    component.activeTool = 'hand';
    component.canEditTextStyle = false;
    component.canEditFillStyle = false;

    expect(component.showStylePanel).toBeFalse();
  });

  it('opens secondary drawer on azure tab by default', () => {
    component.activeTab = 'actions';
    component.secondaryDrawerOpen = false;

    component.toggleSecondaryDrawer();

    expect(component.secondaryDrawerOpen).toBeTrue();
    expect(component.activeTab).toBe('azure');
  });
});
