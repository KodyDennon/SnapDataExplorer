import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaViewer } from './MediaViewer';

describe('MediaViewer', () => {
  const mockClose = vi.fn();
  const mockItems = [
    {
      id: 'm1',
      timestamp: '2023-06-15T10:30:00Z',
      media_type: 'Image',
      media_path: '/path/to/image.jpg',
      latitude: null,
      longitude: null,
      export_id: 'e1',
      download_url: null,
      proxy_url: null,
      download_status: 'Pending' as const,
    },
  ];

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <MediaViewer
        isOpen={false}
        onClose={mockClose}
        items={mockItems}
        currentIndex={0}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders media content when open', () => {
    render(
      <MediaViewer
        isOpen={true}
        onClose={mockClose}
        items={mockItems}
        currentIndex={0}
      />
    );
    expect(screen.getByText('Media Viewer')).toBeInTheDocument();
  });
});
