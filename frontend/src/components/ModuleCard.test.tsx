import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModuleCard } from './ModuleCard';

describe('ModuleCard', () => {
  it('renders module title and description', () => {
    render(
      <ModuleCard
        icon="📊"
        title="GPA / CPA Engine"
        description="Tính điểm chính xác"
        tags={['BR-RETENTION']}
        status="done"
      />
    );

    expect(screen.getByText('GPA / CPA Engine')).toBeInTheDocument();
    expect(screen.getByText('Tính điểm chính xác')).toBeInTheDocument();
    expect(screen.getByText('BR-RETENTION')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});
