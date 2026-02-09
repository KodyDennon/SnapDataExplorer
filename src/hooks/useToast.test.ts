import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('adds a toast with correct type and message', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('success', 'Data imported!');
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Data imported!');
  });

  it('auto-removes toast after 5 seconds', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('info', 'Temporary message');
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('removes a specific toast immediately', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.addToast('error', 'First');
      result.current.addToast('warning', 'Second');
    });
    expect(result.current.toasts).toHaveLength(2);
    const firstId = result.current.toasts[0].id;
    act(() => {
      result.current.removeToast(firstId);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second');
  });
});
