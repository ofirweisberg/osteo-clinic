export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

export type AppointmentSource = "self_booked" | "manual";

export type InvoiceStatus = "draft" | "sent" | "paid";

export interface Database {
  public: {
    Tables: {
      patients: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          email: string | null;
          date_of_birth: string | null;
          address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          email?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          email?: string | null;
          date_of_birth?: string | null;
          address?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      treatment_types: {
        Row: {
          id: string;
          name: string;
          duration_minutes: number;
          price: number;
          color: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          duration_minutes: number;
          price: number;
          color?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          duration_minutes?: number;
          price?: number;
          color?: string;
          is_active?: boolean;
        };
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          treatment_type_id: string;
          starts_at: string;
          ends_at: string;
          status: AppointmentStatus;
          source: AppointmentSource;
          reminder_sent: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          treatment_type_id: string;
          starts_at: string;
          ends_at: string;
          status?: AppointmentStatus;
          source?: AppointmentSource;
          reminder_sent?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          treatment_type_id?: string;
          starts_at?: string;
          ends_at?: string;
          status?: AppointmentStatus;
          source?: AppointmentSource;
          reminder_sent?: boolean;
          notes?: string | null;
        };
      };
      visit_logs: {
        Row: {
          id: string;
          appointment_id: string;
          patient_id: string;
          visit_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          patient_id: string;
          visit_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          patient_id?: string;
          visit_date?: string;
          notes?: string | null;
          updated_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          invoice_number: number;
          patient_id: string;
          appointment_id: string | null;
          amount: number;
          status: InvoiceStatus;
          issued_at: string;
          paid_at: string | null;
          pdf_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_number?: number;
          patient_id: string;
          appointment_id?: string | null;
          amount: number;
          status?: InvoiceStatus;
          issued_at?: string;
          paid_at?: string | null;
          pdf_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          appointment_id?: string | null;
          amount?: number;
          status?: InvoiceStatus;
          issued_at?: string;
          paid_at?: string | null;
          pdf_url?: string | null;
          notes?: string | null;
        };
      };
      practice_settings: {
        Row: {
          id: string;
          practice_name: string;
          practitioner_name: string;
          phone: string;
          address: string;
          working_hours: Record<
            string,
            { start: string; end: string; enabled: boolean }
          >;
          booking_window_days: number;
          reminder_hours_before: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          practice_name: string;
          practitioner_name: string;
          phone?: string;
          address?: string;
          working_hours?: Record<
            string,
            { start: string; end: string; enabled: boolean }
          >;
          booking_window_days?: number;
          reminder_hours_before?: number;
        };
        Update: {
          practice_name?: string;
          practitioner_name?: string;
          phone?: string;
          address?: string;
          working_hours?: Record<
            string,
            { start: string; end: string; enabled: boolean }
          >;
          booking_window_days?: number;
          reminder_hours_before?: number;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      appointment_status: AppointmentStatus;
      appointment_source: AppointmentSource;
      invoice_status: InvoiceStatus;
    };
  };
}
