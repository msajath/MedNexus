import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import AdminLogin from '../pages/AdminLogin';
import { AuthProvider } from '../context/AuthContext';

// Mock fetch
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  localStorage.clear();
});

test('renders AdminLogin form', () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <AdminLogin />
      </AuthProvider>
    </BrowserRouter>
  );

  expect(screen.getByText(/Admin Portal/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/admin@mednexus.com/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
});

test('handles input changes', () => {
  render(
    <BrowserRouter>
      <AuthProvider>
        <AdminLogin />
      </AuthProvider>
    </BrowserRouter>
  );

  const emailInput = screen.getByPlaceholderText(/admin@mednexus.com/i);
  fireEvent.change(emailInput, { target: { value: 'admin@test.com' } });
  expect(emailInput.value).toBe('admin@test.com');
});

test('logs in admin using a cookie session', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      user: {
        role: 'admin',
        email: 'admin@mednexus.com',
      },
    }),
  });

  render(
    <BrowserRouter>
      <AuthProvider>
        <AdminLogin />
      </AuthProvider>
    </BrowserRouter>
  );

  fireEvent.change(screen.getByPlaceholderText(/admin@mednexus.com/i), {
    target: { value: 'admin@mednexus.com' },
  });
  fireEvent.change(screen.getByPlaceholderText(/Enter your password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /sign in to admin panel/i }));

  await waitFor(() => {
    expect(screen.getByText(/Admin Portal/i)).toBeInTheDocument();
  });
  expect(localStorage.getItem('token')).toBeNull();

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  );
});
