import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getStoredToken } from '../api/client';

describe('Authentication & First-Run Setup', () => {
  it('renders First-Run Administrator Setup when setupRequired is true and validates inputs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: true }), { status: 200 });
        }
        if (url.endsWith('/health')) {
          return new Response(
            JSON.stringify({
              status: 'UP',
              service: 'CURALITHRA Web API',
              version: '1.0.0',
              database: 'CONNECTED',
              timestamp: '2026-11-11T09:00:00Z',
            }),
            { status: 200 }
          );
        }
        return new Response('{}', { status: 200 });
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('First-Run Administrator Setup')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /initialize curalithra workspace/i }));
    expect(screen.getByText('Administrator full name is required.')).toBeInTheDocument();
    expect(screen.getByText('Passphrase must be at least 6 characters.')).toBeInTheDocument();
  });

  it('signs in successfully and surfaces HTTP 401 authentication errors cleanly', async () => {
    let shouldFail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
        }
        if (url.endsWith('/auth/login')) {
          if (shouldFail) {
            return new Response(
              JSON.stringify({
                status: 401,
                error: 'Unauthorized',
                message: 'Invalid username/email or password.',
                fieldErrors: {},
              }),
              { status: 401 }
            );
          }
          return new Response(
            JSON.stringify({
              accessToken: 'jwt-valid-123',
              tokenType: 'Bearer',
              expiresInMs: 43200000,
              user: {
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
                permissions: ['VIEW_DASHBOARD'],
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes('/dashboard/stats')) {
          return new Response(
            JSON.stringify({
              totalPatients: 0,
              totalDoctors: 0,
              todaysAppointments: 0,
              completedAppointments: 0,
              pendingAppointments: 0,
              cancelledAppointments: 0,
              totalRevenue: 0,
              collectedRevenue: 0,
              pendingRevenue: 0,
              statusDistribution: [],
              patientRegistrationTrend: [],
              appointmentTrend: [],
              monthlyRevenueTrend: [],
              upcomingAppointments: [],
              recentPatients: [],
              recentActivities: [],
              notifications: [],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ items: [], totalCount: 0, alertCount: 0, unreadCount: 0 }), {
          status: 200,
        });
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Staff Sign In')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in to curalithra/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid username/email or password.');
    });

    shouldFail = false;
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correctpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in to curalithra/i }));

    await waitFor(() => {
      expect(screen.getByText('Clinical Operations Dashboard')).toBeInTheDocument();
    });
    expect(getStoredToken()).toBe('jwt-valid-123');
  });

  it('renders Explore Live Demo CTA & 3 role cards when demo mode is enabled and launches real demo JWT', async () => {
    let demoRoleRequested: string | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
        }
        if (url.endsWith('/auth/demo-status')) {
          return new Response(
            JSON.stringify({
              enabled: true,
              notice: 'Isolated synthetic hospital sandbox.',
              roles: [
                {
                  role: 'ADMIN',
                  title: 'Administrator Demo',
                  username: 'demo.admin',
                  summary: 'Dr. Elena Vance — Medical Director',
                  accessScope: 'Full command center',
                },
                {
                  role: 'DOCTOR',
                  title: 'Doctor Demo',
                  username: 'demo.doctor',
                  summary: 'Dr. Evelyn Hayes — Senior Cardiologist',
                  accessScope: 'Clinical EMR & Rx',
                },
                {
                  role: 'RECEPTIONIST',
                  title: 'Receptionist Demo',
                  username: 'demo.reception',
                  summary: 'Maya Lin — Front Desk Coordinator',
                  accessScope: 'Intake, booking & billing',
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.endsWith('/auth/demo-login') && init?.method === 'POST') {
          const parsed = JSON.parse(String(init.body)) as { role: string };
          demoRoleRequested = parsed.role;
          return new Response(
            JSON.stringify({
              accessToken: 'jwt-demo-doctor',
              tokenType: 'Bearer',
              expiresInMs: 28800000,
              user: {
                id: 102,
                username: 'demo.doctor',
                fullName: 'Dr. Evelyn Hayes',
                email: 'demo.doctor@curalithra.demo',
                role: 'DOCTOR',
                roleDisplay: 'Doctor',
                linkedDoctorId: 1,
                active: true,
                demoUser: true,
                createdAt: '2026-11-11T09:00:00Z',
                lastLoginAt: '2026-11-11T09:00:00Z',
                permissions: ['VIEW_DASHBOARD', 'VIEW_MEDICAL_RECORDS'],
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes('/dashboard/stats')) {
          return new Response(
            JSON.stringify({
              totalPatients: 20,
              totalDoctors: 8,
              todaysAppointments: 3,
              completedAppointments: 5,
              pendingAppointments: 2,
              cancelledAppointments: 1,
              totalRevenue: 15000,
              collectedRevenue: 11000,
              pendingRevenue: 4000,
              statusDistribution: [],
              patientRegistrationTrend: [],
              appointmentTrend: [],
              monthlyRevenueTrend: [],
              upcomingAppointments: [],
              recentPatients: [],
              recentActivities: [],
              notifications: [],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ items: [], totalCount: 0, alertCount: 0, unreadCount: 0 }), {
          status: 200,
        });
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('explore-live-demo-btn')).toBeInTheDocument();
      expect(screen.getByText('Doctor Demo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /doctor demo/i }));

    await waitFor(() => {
      expect(screen.getByText('Clinical Operations Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('demo-mode-banner')).toBeInTheDocument();
    });
    expect(demoRoleRequested).toBe('DOCTOR');
    expect(getStoredToken()).toBe('jwt-demo-doctor');
  });
});
