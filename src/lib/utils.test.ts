import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });

  it('handles falsy values', () => {
    expect(cn(undefined, null, 'foo', false && 'bar')).toBe('foo');
  });
});
