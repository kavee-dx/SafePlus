export type DmcRole =
  | "DMC_ADMIN"
  | "DMC_OFFICER"
  | "DISTRICT_OFFICER"
  | "COORDINATOR"
  | "ORGANIZATION_ADMIN"
  | "RESCUE_ORGANIZATION_ADMIN"
  | "ORGANIZATION_TEAM_LEADER"
  | "INDEPENDENT_TEAM_LEADER"
  | "RELIEF_AGENCY"
  | "FOOD_DONOR"
  | "DELIVERY_VOLUNTEER"
  | "DELIVERY_VOLUNTEER_TEAM"
  | "CITIZEN";

export type UserRole = DmcRole;

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: string;
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
