export type DmcRole =
  | "DMC_ADMIN"
  | "DMC_OFFICER"
  | "DISTRICT_OFFICER";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: DmcRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
}
