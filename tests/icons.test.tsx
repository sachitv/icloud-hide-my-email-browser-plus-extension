import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RefreshIcon, SpinnerIcon } from '../src/icons';

describe('icon factory', () => {
  it('marks icons as decorative when no aria label is provided', () => {
    const { getByRole } = render(<SpinnerIcon data-testid="spinner" />);
    const icon = getByRole('img', { hidden: true });
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).not.toHaveAttribute('aria-label');
  });

  it('exposes icons to assistive tech when aria label is present', () => {
    const { getByLabelText } = render(
      <RefreshIcon aria-label="refresh icon" className="text-blue-500" />
    );
    const icon = getByLabelText('refresh icon');
    expect(icon).not.toHaveAttribute('aria-hidden');
    expect(icon).toHaveAttribute('class', 'text-blue-500');
  });
});
