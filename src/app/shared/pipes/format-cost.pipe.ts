import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a USD cost value as a compact badge string.
 * Examples: 0 → '$0', 5.5 → '$6', 150 → '$150', 1500 → '$1.5k'
 */
@Pipe({
  name: 'formatCost',
  standalone: true,
})
export class FormatCostPipe implements PipeTransform {
  transform(usd: number): string {
    if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
    if (usd >= 100)  return `$${Math.round(usd)}`;
    return `$${usd.toFixed(0)}`;
  }
}
