import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchView } from './SearchView';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('SearchView', () => {
  const mockNavigate = vi.fn();
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search input', () => {
    render(<SearchView onNavigateToChat={mockNavigate} addToast={mockAddToast} />);
    expect(screen.getByPlaceholderText('Search across all conversations...')).toBeInTheDocument();
  });

  it('shows results after successful search', async () => {
    mockInvoke.mockResolvedValueOnce([
      {
        event_id: 'e1',
        conversation_id: 'c1',
        conversation_name: 'Alice',
        sender: 'alice',
        sender_name: 'Alice S',
        content: 'Hello world',
        timestamp: '2023-06-15T10:30:00Z',
        event_type: 'TEXT',
      },
    ]);

    render(<SearchView onNavigateToChat={mockNavigate} addToast={mockAddToast} />);
    const input = screen.getByPlaceholderText('Search across all conversations...');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('1 result')).toBeInTheDocument();
    });
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows empty state when no results', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    render(<SearchView onNavigateToChat={mockNavigate} addToast={mockAddToast} />);
    const input = screen.getByPlaceholderText('Search across all conversations...');
    fireEvent.change(input, { target: { value: 'nonexistent' } });
    fireEvent.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });
});
