import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TitledComponent } from '../src/commonComponents';

describe('TitledComponent', () => {
  it('renders children without keys using fallback key generation', () => {
    const { container } = render(
      <TitledComponent sectionId="test-section" hideHeader>
        <div>First child without key</div>
        <div>Second child without key</div>
      </TitledComponent>
    );

    const children = container.querySelectorAll('[class*="text-[15px]"]');
    expect(children).toHaveLength(2);
    expect(children[0]).toHaveTextContent('First child without key');
    expect(children[1]).toHaveTextContent('Second child without key');
  });

  it('uses explicit keys when React elements have them', () => {
    const ChildWithKey = ({ text }: { text: string }) => <div>{text}</div>;
    
    const { container } = render(
      <TitledComponent sectionId="test-section" hideHeader>
        <ChildWithKey key="explicit-key-1" text="Child with explicit key" />
        <ChildWithKey key="explicit-key-2" text="Another child with key" />
      </TitledComponent>
    );

    const children = container.querySelectorAll('[class*="text-[15px]"]');
    expect(children).toHaveLength(2);
    expect(children[0]).toHaveTextContent('Child with explicit key');
    expect(children[1]).toHaveTextContent('Another child with key');
  });

  it('handles mixed children with and without keys', () => {
    const { container } = render(
      <TitledComponent sectionId="test-section" hideHeader>
        <div key="with-key">With key</div>
        <div>Without key</div>
      </TitledComponent>
    );

    const children = container.querySelectorAll('[class*="text-[15px]"]');
    expect(children).toHaveLength(2);
  });
});
