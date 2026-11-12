import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getStoredToken } from '../api/client';

describe('Public Interactive Demo & Authentication Modes', () => {
  it('renders Welcome to CURALITHRA public demo landing with 3 role cards and no password gate', async () => {
    const requestedRoles: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
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
        if (url.endsWith('/auth/demo-status')) {
          return new Response(
            JSON.stringify({
              enabled: true,
              notice: 'Isolated synthetic hospital sandbox.',
              roles: [
                {
                  role: 'ADMIN',
                  title: 'Administrator Demo',
                  summary: 'Dr. Elena Vance — Medical Director',
                  accessScope: 'Full command center',
                  highlights: [
                    'Dashboard overview',
                    'Patient management',
                    'Doctor and staff management',
                    'Department management',
                    'Appointment overview',
                    'Billing and reports',
                    'Audit logs',
                    'System settings',
                  ],
                },
                {
                  role: 'DOCTOR',
                  title: 'Doctor Demo',
                  summary: 'Dr. Evelyn Hayes — Senior Cardiologist',
                  accessScope: 'Clinical EMR & Rx',
                  highlights: [
                    'Doctor dashboard',
                    'Assigned patients',
                    'Appointment schedule',
                    'Medical records',
                    'Prescriptions',
                    'Clinical workflow',
                  ],
                },
                {
                  role: 'RECEPTIONIST',
                  title: 'Receptionist Demo',
                  summary: 'Maya Lin — Front Desk Coordinator',
                  accessScope: 'Intake, booking & billing',
                  highlights: [
                    'Reception dashboard',
                    'Patient registration',
                    'Appointment scheduling',
                    'Patient lookup',
                    'Billing workflow',
                    'Front-desk operations',
                  ],
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.endsWith('/auth/demo-login') && init?.method === 'POST') {
          const parsed = JSON.parse(String(init.body)) as { role: string };
          requestedRoles.push(parsed.role);
          const roleConfigs: Record<
            string,
            { id: number; username: string; fullName: string; roleDisplay: string; permissions: string[] }
          > = {
            ADMIN: {
              id: 101,
              username: 'demo.admin',
              fullName: 'Dr. Elena Vance',
              roleDisplay: 'Administrator',
              permissions: ['VIEW_DASHBOARD', 'VIEW_PATIENTS', 'MANAGE_USERS', 'MANAGE_SETTINGS'],
            },
            DOCTOR: {
              id: 102,
              username: 'demo.doctor',
              fullName: 'Dr. Evelyn Hayes',
              roleDisplay: 'Doctor',
              permissions: ['VIEW_DASHBOARD', 'VIEW_PATIENTS', 'VIEW_MEDICAL_RECORDS'],
            },
            RECEPTIONIST: {
              id: 103,
              username: 'demo.reception',
              fullName: 'Maya Lin (Front Desk)',
              roleDisplay: 'Receptionist',
              permissions: ['VIEW_DASHBOARD', 'VIEW_PATIENTS', 'MANAGE_BILLING'],
            },
          };
          const cfg = roleConfigs[parsed.role];
          return new Response(
            JSON.stringify({
              accessToken: `jwt-demo-${parsed.role.toLowerCase()}`,
              tokenType: 'Bearer',
              expiresInMs: 1800000,
              user: {
                ...cfg,
                email: `${cfg.username}@curalithra.demo`,
                role: parsed.role,
                linkedDoctorId: parsed.role === 'DOCTOR' ? 1 : null,
                active: true,
                demoUser: true,
                createdAt: '2026-11-11T09:00:00Z',
                lastLoginAt: '2026-11-11T09:00:00Z',
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

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to CURALITHRA')).toBeInTheDocument();
      expect(
        screen.getByText('Explore a connected clinical operations and hospital management platform.')
      ).toBeInTheDocument();
    });

    // Zero sidebars & zero staff sign-in password barriers in Public Demo
    expect(container.querySelectorAll('aside')).toHaveLength(0);
    expect(screen.queryByText('Staff Sign In')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/username or email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();

    expect(container.textContent).not.toContain('demo.admin');
    expect(container.textContent).not.toContain('demo.doctor');
    expect(container.textContent).not.toContain('demo.reception');

    // All three prominent cards & CTAs are visible
    expect(screen.getByText('Administrator Demo')).toBeInTheDocument();
    expect(screen.getByText('Doctor Demo')).toBeInTheDocument();
    expect(screen.getByText('Receptionist Demo')).toBeInTheDocument();
    expect(screen.getByTestId('synthetic-data-notice')).toBeInTheDocument();

    // 1. Explore as Doctor
    fireEvent.click(screen.getByRole('button', { name: /explore as doctor/i }));
    await waitFor(() => {
      expect(screen.getByText('Clinical Operations Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('demo-mode-banner')).toHaveTextContent('Doctor');
    });
    expect(getStoredToken()).toBe('jwt-demo-doctor');

    // Exit Demo returns cleanly to Welcome landing & clears JWT
    fireEvent.click(screen.getByTestId('exit-demo-btn'));
    await waitFor(() => {
      expect(screen.getByText('Welcome to CURALITHRA')).toBeInTheDocument();
    });
    expect(getStoredToken()).toBeNull();

    // 2. Explore as Administrator
    fireEvent.click(screen.getByRole('button', { name: /explore as administrator/i }));
    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-banner')).toHaveTextContent('Administrator');
    });
    expect(getStoredToken()).toBe('jwt-demo-admin');

    fireEvent.click(screen.getByTestId('exit-demo-btn'));
    await waitFor(() => {
      expect(screen.getByText('Welcome to CURALITHRA')).toBeInTheDocument();
    });

    // 3. Explore as Receptionist
    fireEvent.click(screen.getByRole('button', { name: /explore as receptionist/i }));
    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-banner')).toHaveTextContent('Receptionist');
    });
    expect(getStoredToken()).toBe('jwt-demo-receptionist');
    expect(requestedRoles).toEqual(['DOCTOR', 'ADMIN', 'RECEPTIONIST']);
  });

  it('renders First-Run Administrator Setup when setupRequired is true and validates inputs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: true }), { status: 200 });
        }
        if (url.endsWith('/auth/demo-status')) {
          return new Response(JSON.stringify({ enabled: false, notice: '', roles: [] }), { status: 200 });
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

  it('renders Staff Sign In ONLY when public demo is explicitly disabled and handles 401 errors', async () => {
    let shouldFail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
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
        if (url.endsWith('/auth/demo-status')) {
          return new Response(JSON.stringify({ enabled: false, notice: 'Disabled', roles: [] }), {
            status: 200,
          });
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
              expiresInMs: 28800000,
              user: {
                id: 1,
                username: 'admin',
                fullName: 'Dr. Admin',
                email: 'admin@curalithra.org',
                role: 'ADMIN',
                roleDisplay: 'Administrator',
                linkedDoctorId: null,
                active: true,
                demoUser: false,
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

  it('keeps Welcome to CURALITHRA 3-card public demo screen visible with no password wall when backend is offline/waking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Network unreachable');
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to CURALITHRA')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /explore as administrator/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explore as doctor/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explore as receptionist/i })).toBeInTheDocument();
    expect(screen.queryByText('Staff Sign In')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
  });
});
