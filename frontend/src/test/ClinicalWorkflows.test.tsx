import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AUTH_EXPIRED_EVENT, apiRequest, buildQueryString, getStoredToken, setStoredToken } from '../api/client';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { PatientsPage } from '../pages/PatientsPage';
import { formatCurrency, formatDate, isoDateDaysAgo, todayIsoDate } from '../utils/format';

const ADMIN_USER = {
  id: 1,
  username: 'admin',
  fullName: 'Dr. Admin',
  email: 'admin@curalithra.org',
  role: 'ADMIN',
  roleDisplay: 'Administrator',
  linkedDoctorId: null,
  active: true,
  createdAt: '2026-11-11T09:00:00Z',
  lastLoginAt: '2026-11-11T09:00:00Z',
  permissions: [
    'VIEW_PATIENTS',
    'EDIT_PATIENTS',
    'DELETE_PATIENTS',
    'VIEW_APPOINTMENTS',
    'MANAGE_APPOINTMENTS',
    'CANCEL_APPOINTMENTS',
  ],
};

describe('Clinical Workflows & API Client', () => {
  it('loads patients and validates & submits Register Patient modal', async () => {
    setStoredToken('test-token');
    let createPayload: unknown = null;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
        }
        if (url.endsWith('/auth/me')) {
          return new Response(JSON.stringify(ADMIN_USER), { status: 200 });
        }
        if (url.endsWith('/settings')) {
          return new Response(JSON.stringify({ currencySymbol: '₹', defaultAppointmentMinutes: 30 }), {
            status: 200,
          });
        }
        if (url.includes('/patients') && init?.method === 'POST') {
          createPayload = JSON.parse(String(init.body));
          return new Response(
            JSON.stringify({
              id: 99,
              patientCode: 'PAT-1099',
              fullName: 'Aarav Mehta',
              dateOfBirth: '1991-04-15',
              gender: 'Male',
              phone: '+91 98111 22334',
              email: '',
              address: '',
              bloodGroup: 'O+',
              emergencyContact: '',
              bp: '',
              sugar: '',
              weightKg: '',
              heightCm: '',
              registeredAt: '2026-11-11T09:00:00Z',
            }),
            { status: 201 }
          );
        }
        if (url.includes('/patients')) {
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: 1,
                  patientCode: 'PAT-1001',
                  fullName: 'Sophia Patel',
                  dateOfBirth: '1988-03-10',
                  gender: 'Female',
                  phone: '+91 90001 11111',
                  email: 'sophia@example.com',
                  address: 'Pune',
                  bloodGroup: 'A+',
                  emergencyContact: 'Raj Patel',
                  bp: '118/76',
                  sugar: '92',
                  weightKg: '61',
                  heightCm: '165',
                  registeredAt: '2026-11-10T09:00:00Z',
                },
              ],
              page: 0,
              size: 10,
              totalElements: 1,
              totalPages: 1,
              first: true,
              last: true,
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      })
    );

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <PatientsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sophia Patel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /register patient/i }));
    expect(screen.getByRole('dialog', { name: /register new patient/i })).toBeInTheDocument();

    // Submit empty -> client validation
    fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!);
    expect(screen.getByText('Full name is required.')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const textInputs = dialog.querySelectorAll('input');
    // textInputs: [fullName, dateOfBirth, phone, email, address, emergencyContact, bp, sugar, weight, height]
    fireEvent.change(textInputs[0], { target: { value: 'Aarav Mehta' } });
    fireEvent.change(textInputs[1], { target: { value: '1991-04-15' } });
    fireEvent.change(textInputs[2], { target: { value: '+91 98111 22334' } });

    fireEvent.click(dialog.querySelector('button[type="submit"]')!);

    await waitFor(() => {
      expect(createPayload).toMatchObject({
        fullName: 'Aarav Mehta',
        dateOfBirth: '1991-04-15',
        phone: '+91 98111 22334',
      });
    });
  });

  it('displays clear HTTP 409 conflict banner and open time slots when booking collides', async () => {
    setStoredToken('test-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
        }
        if (url.endsWith('/auth/me')) {
          return new Response(JSON.stringify(ADMIN_USER), { status: 200 });
        }
        if (url.endsWith('/settings')) {
          return new Response(JSON.stringify({ currencySymbol: '₹', defaultAppointmentMinutes: 30 }), {
            status: 200,
          });
        }
        if (url.includes('/patients')) {
          return new Response(
            JSON.stringify({
              content: [{ id: 10, patientCode: 'PAT-1010', fullName: 'Nadia Khan' }],
              page: 0,
              size: 100,
              totalElements: 1,
              totalPages: 1,
              first: true,
              last: true,
            }),
            { status: 200 }
          );
        }
        if (url.includes('/doctors')) {
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: 20,
                  doctorCode: 'DOC-201',
                  fullName: 'Dr. Evelyn Hayes',
                  specialization: 'Cardiology',
                  departmentId: 1,
                  departmentName: 'Cardiology',
                  phone: '123',
                  email: 'hayes@curalithra.org',
                  qualification: 'MD',
                  experienceYears: 10,
                  availabilitySchedule: 'Mon-Fri',
                  consultationFee: 800,
                  active: true,
                  createdAt: '2026-11-11T09:00:00Z',
                },
              ],
              page: 0,
              size: 100,
              totalElements: 1,
              totalPages: 1,
              first: true,
              last: true,
            }),
            { status: 200 }
          );
        }
        if (url.includes('/appointments') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              status: 409,
              error: 'Conflict',
              message: 'Schedule conflict: Dr. Evelyn Hayes already has an overlapping appointment on this slot.',
              fieldErrors: {},
            }),
            { status: 409 }
          );
        }
        if (url.includes('/appointments')) {
          return new Response(
            JSON.stringify({
              content: [
                {
                  id: 500,
                  appointmentCode: 'APT-500',
                  patientId: 11,
                  patientCode: 'PAT-1011',
                  patientName: 'Existing Patient',
                  doctorId: 20,
                  doctorCode: 'DOC-201',
                  doctorName: 'Dr. Evelyn Hayes',
                  doctorSpecialization: 'Cardiology',
                  appointmentDate: '2026-11-12',
                  appointmentTime: '10:00',
                  durationMinutes: 30,
                  reason: 'ECG',
                  status: 'CONFIRMED',
                  statusDisplay: 'Confirmed',
                  notes: null,
                  createdAt: '2026-11-11T09:00:00Z',
                  updatedAt: '2026-11-11T09:00:00Z',
                },
              ],
              page: 0,
              size: 10,
              totalElements: 1,
              totalPages: 1,
              first: true,
              last: true,
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      })
    );

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <AppointmentsPage />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('APT-500')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /schedule appointment/i }));
    const dialog = screen.getByRole('dialog', { name: /schedule new appointment/i });
    const reasonInput = dialog.querySelector('input[placeholder*="Cardiology"]')!;
    fireEvent.change(reasonInput, { target: { value: 'Chest pain consultation' } });

    fireEvent.click(screen.getByRole('button', { name: /book appointment/i }));

    await waitFor(() => {
      expect(screen.getByTestId('appointment-conflict-alert')).toHaveTextContent(
        'Schedule conflict: Dr. Evelyn Hayes already has an overlapping appointment'
      );
    });
    expect(screen.getByRole('button', { name: '10:30' })).toBeInTheDocument();
  });

  it('builds clean query strings and broadcasts AUTH_EXPIRED_EVENT on HTTP 401', async () => {
    expect(buildQueryString({ query: 'alice', status: '', page: 0, active: undefined })).toBe(
      '?query=alice&page=0'
    );

    setStoredToken('expired-jwt');
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get('Authorization')).toBe('Bearer expired-jwt');
        return new Response(JSON.stringify({ status: 401, message: 'Token expired' }), {
          status: 401,
        });
      })
    );

    await expect(apiRequest('/patients')).rejects.toThrow('Token expired');
    expect(getStoredToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
  });

  it('formats configured hospital currencies and canonical UTC dates consistently', () => {
    expect(formatCurrency(125000.5, '$')).toBe('$125,000.50');
    expect(formatCurrency(125000.5, '₹')).toBe('₹1,25,000.50');
    expect(formatCurrency(1522.5, '€')).toBe('€1,522.50');

    expect(formatDate('2026-11-11')).toBe('Nov 11, 2026');
    expect(todayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isoDateDaysAgo(0)).toBe(todayIsoDate());
    expect(isoDateDaysAgo(30) <= todayIsoDate()).toBe(true);
  });
});
