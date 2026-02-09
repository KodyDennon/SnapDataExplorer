import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingComponent({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error from React and ErrorBoundary during test
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Test crash')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays the error message', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Detailed error info')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Detailed error info')).toBeInTheDocument();
  });

  consoleSpy.mockRestore();
});
