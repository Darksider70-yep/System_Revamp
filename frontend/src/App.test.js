import { render, screen } from '@testing-library/react';
import App from './App';

test('renders dashboard title', () => {
  render(<App />);
  const element = screen.getByText(/dashboard/i);
  expect(element).toBeInTheDocument();
});
