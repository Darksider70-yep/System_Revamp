import { render, screen } from '@testing-library/react';
import App from './App';

test('renders cloud login title', () => {
  render(<App />);
  const element = screen.getByText(/cloud security core/i);
  expect(element).toBeInTheDocument();
});
