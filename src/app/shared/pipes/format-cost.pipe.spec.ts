import { FormatCostPipe } from './format-cost.pipe';

describe('FormatCostPipe', () => {
  const pipe = new FormatCostPipe();

  it('formats zero and small values', () => {
    expect(pipe.transform(0)).toBe('$0');
    expect(pipe.transform(5.5)).toBe('$6');
  });

  it('formats hundreds as rounded whole dollars', () => {
    expect(pipe.transform(150.4)).toBe('$150');
  });

  it('formats thousands with k suffix', () => {
    expect(pipe.transform(1500)).toBe('$1.5k');
  });
});
