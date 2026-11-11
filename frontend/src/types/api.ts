export type Role = 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST';

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'INSURANCE';
export type PrescriptionStatus = 'ACTIVE' | 'DISPENSED' | 'COMPLETED';
export type ReportType =
  | 'PATIENT_REGISTRATION'
  | 'DOCTOR_ACTIVITY'
  | 'APPOINTMENTS'
  | 'APPOINTMENT_STATUS'
  | 'REVENUE';

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ApiError {
  status: number;
  error: string;
  message: string;
  fieldErrors: Record<string, string>;
  timestamp: string;
}

export interface HealthStatus {
  status: string;
  service: string;
  version: string;
  database: string;
  timestamp: string;
}

export interface SetupStatusResponse {
  setupRequired: boolean;
}

export interface DemoRoleInfo {
  role: Role;
  title: string;
  username: string;
  summary: string;
  accessScope: string;
}

export interface DemoStatusResponse {
  enabled: boolean;
  notice: string;
  roles: DemoRoleInfo[];
}

export interface DemoResetResponse {
  message: string;
  session: AuthResponse;
  patientsCount: number;
  doctorsCount: number;
  appointmentsCount: number;
}

export interface InitialSetupRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
  seedDemoData: boolean;
  createSampleRoleAccounts: boolean;
}

export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
}

export interface UserSummary {
  id: number;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
  roleDisplay: string;
  linkedDoctorId: number | null;
  active: boolean;
  demoUser?: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  permissions: string[];
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresInMs: number;
  user: UserSummary;
}

export interface CreateUserRequest {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: Role;
  linkedDoctorId: number | null;
}

export interface UpdateUserAccessRequest {
  role: Role;
  active: boolean;
  linkedDoctorId?: number | null;
  resetPassword?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface NotificationItem {
  id: string;
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  route: string;
  read: boolean;
}

export interface NotificationsResponse {
  totalCount: number;
  alertCount: number;
  unreadCount: number;
  items: NotificationItem[];
}

export interface Patient {
  id: number;
  patientCode: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  email: string | null;
  address: string | null;
  bloodGroup: string;
  emergencyContact: string | null;
  bp: string | null;
  sugar: string | null;
  weightKg: string | null;
  heightCm: string | null;
  registeredAt: string;
}

export interface PatientRequest {
  fullName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  email: string;
  address: string;
  bloodGroup: string;
  emergencyContact: string;
  bp: string;
  sugar: string;
  weightKg: string;
  heightCm: string;
}

export interface PatientHistory {
  patient: Patient;
  appointments: Appointment[];
  medicalRecords: MedicalRecord[];
  clinicalAccessGranted: boolean;
  bills: Bill[];
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string | null;
}

export interface Doctor {
  id: number;
  doctorCode: string;
  fullName: string;
  specialization: string;
  departmentId: number;
  departmentName: string;
  phone: string;
  email: string;
  qualification: string;
  experienceYears: number;
  availabilitySchedule: string;
  consultationFee: number;
  active: boolean;
  createdAt: string;
}

export interface DoctorRequest {
  fullName: string;
  specialization: string;
  departmentId: number;
  phone: string;
  email: string;
  qualification: string;
  experienceYears: number;
  availabilitySchedule: string;
  consultationFee: number;
  active: boolean;
}

export interface Appointment {
  id: number;
  appointmentCode: string;
  patientId: number;
  patientCode: string;
  patientName: string;
  doctorId: number;
  doctorCode: string;
  doctorName: string;
  doctorSpecialization: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  reason: string;
  status: AppointmentStatus;
  statusDisplay: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentRequest {
  patientId: number;
  doctorId: number;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes: number;
  reason: string;
  status?: AppointmentStatus;
  notes?: string;
}

export interface CalendarDayGroup {
  date: string;
  appointments: Appointment[];
}

export interface Prescription {
  id: number;
  medicalRecordId: number;
  recordCode: string;
  patientId: number;
  patientName: string;
  doctorId: number;
  doctorName: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string | null;
  status: PrescriptionStatus;
  statusDisplay: string;
  prescribedAt: string;
}

export interface PrescriptionRequest {
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
  status?: PrescriptionStatus;
}

export interface StandalonePrescriptionRequest {
  patientId: number;
  doctorId: number;
  medicalRecordId?: number | null;
  medicationName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  status?: PrescriptionStatus;
  clinicalContext?: string;
}

export interface MedicalRecord {
  id: number;
  recordCode: string;
  patientId: number;
  patientCode: string;
  patientName: string;
  doctorId: number;
  doctorCode: string;
  doctorName: string;
  doctorSpecialization: string;
  appointmentId: number | null;
  appointmentCode: string | null;
  visitDate: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  vitalsBp: string | null;
  vitalsTemp: string | null;
  notes: string | null;
  createdAt: string;
  prescriptions: Prescription[];
}

export interface MedicalRecordRequest {
  patientId: number;
  doctorId: number;
  appointmentId: number | null;
  visitDate: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  vitalsBp: string;
  vitalsTemp: string;
  notes: string;
  prescriptions: PrescriptionRequest[];
}

export interface BillItem {
  id: number;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BillItemRequest {
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
}

export interface Payment {
  id: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentMethodDisplay: string;
  referenceNo: string | null;
  paidAt: string;
  receivedByUserId: number | null;
}

export interface Bill {
  id: number;
  invoiceNumber: string;
  patientId: number;
  patientCode: string;
  patientName: string;
  appointmentId: number | null;
  appointmentCode: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentStatusDisplay: string;
  notes: string | null;
  issuedAt: string;
  updatedAt: string;
  items: BillItem[];
  payments: Payment[];
}

export interface BillingPageResponse {
  page: PagedResponse<Bill>;
  totalBilled: number;
  totalCollected: number;
  outstandingBalance: number;
}

export interface CreateBillRequest {
  patientId: number;
  appointmentId: number | null;
  items: BillItemRequest[];
  taxRate?: number | null;
  initialPaymentAmount?: number | null;
  paymentMethod?: PaymentMethod | null;
  referenceNo?: string;
  notes?: string;
}

export interface RecordPaymentRequest {
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
}

export interface MonthlyCount {
  month: string;
  count: number;
}

export interface MonthlyRevenue {
  month: string;
  amount: number;
}

export interface StatusCount {
  status: AppointmentStatus;
  displayName: string;
  count: number;
}

export interface ActivityLog {
  id: number;
  userId: number | null;
  username: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

export interface DashboardStats {
  totalPatients: number;
  totalDoctors: number;
  todaysAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  cancelledAppointments: number;
  totalRevenue: number;
  collectedRevenue: number;
  pendingRevenue: number;
  statusDistribution: StatusCount[];
  patientRegistrationTrend: MonthlyCount[];
  appointmentTrend: MonthlyCount[];
  monthlyRevenueTrend: MonthlyRevenue[];
  upcomingAppointments: Appointment[];
  recentPatients: Patient[];
  recentActivities: ActivityLog[];
  notifications: NotificationItem[];
}

export interface ReportResult {
  type: ReportType;
  title: string;
  headers: string[];
  rows: string[][];
  summaryMetrics: Record<string, string>;
}

export interface HospitalSettings {
  hospitalName: string;
  tagline: string;
  defaultTaxRate: number;
  defaultAppointmentMinutes: number;
  currencyCode: string;
  currencySymbol: string;
  supportEmail: string | null;
  supportPhone: string | null;
  address: string | null;
  invoiceFooterNote: string | null;
  updatedAt: string;
}

export interface UpdateHospitalSettingsRequest {
  hospitalName: string;
  tagline: string;
  defaultTaxRate: number;
  defaultAppointmentMinutes: number;
  currencyCode: string;
  currencySymbol: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  invoiceFooterNote: string;
}
