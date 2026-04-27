import { getPath, pickText, toArrayCountText, toBoolText, toDisplayText, toListText } from './diagram-node-format.util';

describe('diagram-node-format.util', () => {
  it('normalizes scalar display text', () => {
    expect(toDisplayText(' hello ')).toBe('hello');
    expect(toDisplayText(true)).toBe('Yes');
    expect(toDisplayText(12)).toBe('12');
    expect(toDisplayText('   ')).toBeNull();
  });

  it('resolves deep paths and picks first existing text', () => {
    const obj = { a: { b: { c: 'value' } }, d: 'fallback' };
    expect(getPath(obj, 'a.b.c')).toBe('value');
    expect(pickText(obj, ['x.y', 'd'])).toBe('fallback');
  });

  it('formats list and count helpers', () => {
    expect(toListText(['a', ' ', 2, false])).toBe('a, 2, No');
    expect(toArrayCountText([1, 2, 3])).toBe('3');
    expect(toArrayCountText('x')).toBeNull();
    expect(toBoolText(false)).toBe('No');
  });
});
