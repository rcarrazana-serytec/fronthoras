import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login form and app title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /SER&TEC/i })).toBeInTheDocument();
  expect(screen.getByText(/Sistema de Tareas/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Ej: tu-email@gmail.com/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Entrar al Sistema/i })).toBeInTheDocument();
});
