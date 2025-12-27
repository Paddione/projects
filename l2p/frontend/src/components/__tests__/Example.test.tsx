import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

describe('Example Component Test', () => {
  it('should render a test element', () => {
    render(<div data-testid="test-element">Test Content</div>);
    
    const element = screen.getByTestId('test-element');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Test Content');
  });
}); 