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
            getResourceTypeCatalog: () => [],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DrawingToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
});
