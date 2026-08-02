import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import AdminLogin from '../pages/AdminLogin';
import { AuthProvider } from '../context/AuthContext';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

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

test('logs in admin with a single login request', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      token: 'mock-admin-token',
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
    expect(localStorage.getItem('token')).toBe('mock-admin-token');
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    'http://localhost:5000/api/auth/login',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  );
});
