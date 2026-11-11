import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getStoredToken, setStoredToken } from '../api/client';
import type { DashboardStats, NotificationsResponse, UserSummary } from '../types/api';

const ADMIN_USER: UserSummary = {
  id: 1,
  username: 'admin',
  fullName: 'Dr. Admin Horizon',
  email: 'admin@curalithra.org',
  role: 'ADMIN',
  roleDisplay: 'Administrator',
  linkedDoctorId: null,
  active: true,
  createdAt: '2026-11-11T08:00:00Z',
  lastLoginAt: '2026-11-11T09:00:00Z',
  permissions: [
    'VIEW_DASHBOARD',
    'VIEW_PATIENTS',
    'EDIT_PATIENTS',
    'DELETE_PATIENTS',
    'VIEW_DOCTORS',
    'EDIT_DOCTORS',
    'DELETE_DOCTORS',
    'VIEW_APPOINTMENTS',
    'MANAGE_APPOINTMENTS',
    'CANCEL_APPOINTMENTS',
    'VIEW_MEDICAL_RECORDS',
    'EDIT_MEDICAL_RECORDS',
    'VIEW_BILLING',
    'MANAGE_BILLING',
    'DELETE_BILLING',
    'VIEW_REPORTS',
    'EXPORT_REPORTS',
    'MANAGE_USERS',
    'VIEW_ACTIVITY_LOGS',
    'MANAGE_SETTINGS',
  ],
};

const RECEPTIONIST_USER: UserSummary = {
  ...ADMIN_USER,
  id: 3,
  username: 'reception',
  fullName: 'Front Desk Staff',
  role: 'RECEPTIONIST',
  roleDisplay: 'Receptionist',
  permissions: [
    'VIEW_DASHBOARD',
    'VIEW_PATIENTS',
    'EDIT_PATIENTS',
    'VIEW_DOCTORS',
    'VIEW_APPOINTMENTS',
    'MANAGE_APPOINTMENTS',
    'CANCEL_APPOINTMENTS',
    'VIEW_BILLING',
    'MANAGE_BILLING',
    'VIEW_REPORTS',
    'EXPORT_REPORTS',
  ],
};

const EMPTY_STATS: DashboardStats = {
  totalPatients: 12,
  totalDoctors: 6,
  todaysAppointments: 3,
  completedAppointments: 5,
  pendingAppointments: 4,
  cancelledAppointments: 1,
  totalRevenue: 15000,
  collectedRevenue: 11000,
  pendingRevenue: 4000,
  statusDistribution: [
    { status: 'SCHEDULED', displayName: 'Scheduled', count: 4 },
    { status: 'COMPLETED', displayName: 'Completed', count: 5 },
  ],
  patientRegistrationTrend: [{ month: '2026-11', count: 12 }],
  appointmentTrend: [{ month: '2026-11', count: 9 }],
  monthlyRevenueTrend: [{ month: '2026-11', amount: 15000 }],
  upcomingAppointments: [],
  recentPatients: [],
  recentActivities: [],
  notifications: [],
};

function mockAuthenticatedFetch(user: UserSummary, notifs?: NotificationsResponse) {
  const notifications: NotificationsResponse = notifs || {
    totalCount: 1,
    alertCount: 1,
    unreadCount: 1,
    items: [
      {
        id: 'pending-invoices',
        severity: 'warning',
        title: 'Pending Invoice Follow-Up',
        message: '2 invoice(s) have unpaid balances.',
        route: '/billing',
        read: false,
      },
    ],
  };

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/auth/setup-status')) {
      return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
    }
    if (url.endsWith('/auth/me')) {
      return new Response(JSON.stringify(user), { status: 200 });
    }
    if (url.endsWith('/settings')) {
      return new Response(
        JSON.stringify({
          hospitalName: 'CURALITHRA Medical Center',
          tagline: 'Care, Connected. Operations, Simplified.',
          defaultTaxRate: 0.05,
          defaultAppointmentMinutes: 30,
          currencyCode: 'INR',
          currencySymbol: '₹',
          supportEmail: 'support@curalithra.org',
          supportPhone: '+91 80000 10000',
          address: 'Sector 18',
          invoiceFooterNote: 'Thank you',
          updatedAt: '2026-11-11T09:00:00Z',
        }),
        { status: 200 }
      );
    }
    if (url.includes('/dashboard/stats')) {
      return new Response(JSON.stringify(EMPTY_STATS), { status: 200 });
    }
    if (url.endsWith('/notifications/mark-all-read') && init?.method === 'POST') {
      return new Response(
        JSON.stringify({
          ...notifications,
          unreadCount: 0,
          items: notifications.items.map((i) => ({ ...i, read: true })),
        }),
        { status: 200 }
      );
    }
    if (url.endsWith('/notifications')) {
      return new Response(JSON.stringify(notifications), { status: 200 });
    }
    return new Response(JSON.stringify({ status: 'UP', service: 'API', version: '1.0.0', database: 'UP' }), {
      status: 200,
    });
  });
}

describe('CURALITHRA Horizon Shell & Navigation', () => {
  it('renders horizontal top navigation with strictly zero sidebars for Administrator', async () => {
    setStoredToken('jwt-admin-token');
    vi.stubGlobal('fetch', mockAuthenticatedFetch(ADMIN_USER));

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Clinical Operations Dashboard')).toBeInTheDocument();
    });

    expect(container.querySelectorAll('aside')).toHaveLength(0);
    expect(screen.getByRole('navigation', { name: /primary horizontal navigation/i })).toBeInTheDocument();

    for (const label of [
      'Dashboard',
      'Patients',
      'Doctors',
      'Appointments',
      'Records',
      'Prescriptions',
      'Billing',
      'Reports',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    }

    expect(screen.getByLabelText('Settings')).toBeInTheDocument();
  });

  it('hides clinical/admin routes from Receptionist and blocks unauthorized route access', async () => {
    setStoredToken('jwt-reception-token');
    window.location.hash = '#/medical-records';
    vi.stubGlobal('fetch', mockAuthenticatedFetch(RECEPTIONIST_USER));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    });

    expect(screen.queryByText('Records')).not.toBeInTheDocument();
    expect(screen.queryByText('Prescriptions')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
  });

  it('toggles mobile top dropdown and marks notifications read via API', async () => {
    setStoredToken('jwt-admin-token');
    const fetchSpy = mockAuthenticatedFetch(ADMIN_USER);
    vi.stubGlobal('fetch', fetchSpy);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('1');
    });

    // Mobile dropdown toggle
    const menuBtn = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(screen.queryByTestId('mobile-top-dropdown')).not.toBeInTheDocument();
    fireEvent.click(menuBtn);
    expect(screen.getByTestId('mobile-top-dropdown')).toBeInTheDocument();

    // Open notification popover and mark all read
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => {
      expect(screen.getByTestId('notification-popover')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending Invoice Follow-Up')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument();
    });
  });

  it('displays DemoBanner with 1-click role switching and Reset Demo Data with zero sidebars', async () => {
    const DEMO_ADMIN: UserSummary = {
      ...ADMIN_USER,
      id: 201,
      username: 'demo.admin',
      fullName: 'Dr. Elena Vance',
      demoUser: true,
    };
    const DEMO_RECEPTION: UserSummary = {
      ...RECEPTIONIST_USER,
      id: 203,
      username: 'demo.reception',
      fullName: 'Maya Lin (Front Desk)',
      demoUser: true,
    };

    setStoredToken('demo-admin-jwt');
    let switchedToRole: string | null = null;
    let resetCalled = false;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/auth/setup-status')) {
          return new Response(JSON.stringify({ setupRequired: false }), { status: 200 });
        }
        if (url.endsWith('/auth/demo-status')) {
          return new Response(JSON.stringify({ enabled: true, notice: 'Sandbox', roles: [] }), { status: 200 });
        }
        if (url.endsWith('/auth/me')) {
          return new Response(JSON.stringify(DEMO_ADMIN), { status: 200 });
        }
        if (url.endsWith('/auth/demo-login') && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { role: string };
          switchedToRole = body.role;
          return new Response(
            JSON.stringify({
              accessToken: 'demo-reception-jwt',
              tokenType: 'Bearer',
              expiresInMs: 28800000,
              user: DEMO_RECEPTION,
            }),
            { status: 200 }
          );
        }
        if (url.endsWith('/demo/reset') && init?.method === 'POST') {
          resetCalled = true;
          return new Response(
            JSON.stringify({
              message: 'Demo reset',
              session: {
                accessToken: 'demo-reset-jwt',
                tokenType: 'Bearer',
                expiresInMs: 28800000,
                user: DEMO_RECEPTION,
              },
              patientsCount: 20,
              doctorsCount: 8,
              appointmentsCount: 12,
            }),
            { status: 200 }
          );
        }
        if (url.includes('/dashboard/stats')) {
          return new Response(JSON.stringify(EMPTY_STATS), { status: 200 });
        }
        return new Response(JSON.stringify({ items: [], totalCount: 0, alertCount: 0, unreadCount: 0 }), {
          status: 200,
        });
      })
    );

    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId('demo-mode-banner')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('aside')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Receptionist' }));

    await waitFor(() => {
      expect(switchedToRole).toBe('RECEPTIONIST');
      expect(getStoredToken()).toBe('demo-reception-jwt');
    });
    expect(screen.queryByText('Records')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset demo data/i }));
    await waitFor(() => {
      expect(resetCalled).toBe(true);
      expect(getStoredToken()).toBe('demo-reset-jwt');
    });
  });
});
