import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingComponent({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  let consoleSpy: any;

  beforeAll(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

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
    expect(screen.getByText('System Interruption')).toBeInTheDocument();
  });

  it('displays the error message after clicking details', async () => {
    const { getByText, findAllByText } = render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('Detailed error info')} />
      </ErrorBoundary>
    );
    
    // Check initial state
    expect(screen.getByText('System Interruption')).toBeInTheDocument();
    
    // Click show details
    const detailsButton = getByText(/Show Technical Details/i);
    detailsButton.click();
    
    // Now the error info should be visible
    const matches = await findAllByText(/Detailed error info/i);
    expect(matches.length).toBeGreaterThan(0);
  });
});
