import { useCallback, useState } from "react";

import KaveeshaDmcLoginScreen from "./pages/kaveesha-DmcLoginScreen";
import KaveeshaDmcSplashScreen from "./pages/kaveesha-DmcSplashScreen";
import RegistrationSelectionPage from "./pages/dushani-RegistrationSelectionPage";
import DmcOfficerRegistration from "./pages/dushani-DMCOfficerRegistration";
import DistrictOfficerRegistration from "./pages/dushani-DistrictOfficerRegistration";
import CoordinatorRegistration from "./pages/dushani-CoordinatorRegistration";
import OrganizationAdminRegistration from "./pages/dushani-OrganizationAdminRegistration";
import RescueOrganizationRegistration from "./pages/kaveesha-RescueOrganizationRegistration";
import RescueOrganizationDashboard from "./pages/kaveesha-RescueOrganizationDashboard";
import RescueTeamRegistration from "./pages/kaveesha-RescueTeamRegistration";
import TeamLeaderDashboard from "./pages/kaveesha-TeamLeaderDashboard";
import RegistrationSuccessPage from "./pages/dushani-RegistrationSuccessPage";
import AdminLoginScreen from "./pages/amasha-AdminLoginScreen";
import AdminDashboard from "./pages/amasha-AdminDashboard";
import DmcOfficerDashboard from "./pages/dushani-DmcOfficerDashboard";
import KaveeshaDistrictOfficerDashboard from "./pages/kaveesha-DistrictOfficerDashboard";
import CoordinatorDashboardPage from "./pages/dildhara-CoordinatorDashboardPage";
import ResourceRequestsPage from "./pages/dildhara-ResourceRequestsPage";
import PortalLayout, {
  type PortalPage,
} from "./pages/dildhara-PortalLayout";
import DashboardPage from "./pages/dildhara-DashboardPage";
import ProfilePage from "./pages/dildhara-ProfilePage";

import { getStoredAdmin, getStoredToken } from "./services/amasha-adminApi";
import {
  clearDmcAuth,
  getStoredDmcToken,
  getStoredDmcUser,
  loginDmcOfficer,
} from "./services/dmc-authApi";

import type {
  PortalAccount,
  PortalSession,
} from "./services/dildhara-portalAuthApi";

import type { AdminUser, AuthUser } from "./types/auth";

type ScreenType =
  | "splash"
  | "login"
  | "registration-selection"
  | "dmc-officer-registration"
  | "district-officer-registration"
  | "coordinator-registration"
  | "organization-admin-registration"
  | "rescue-organization-registration"
  | "rescue-team-registration"
  | "registration-success"
  | "admin-login"
  | "admin-dashboard"
  | "dmc-dashboard"
  | "district-dashboard"
  | "rescue-organization-dashboard"
  | "team-leader-dashboard"
  | "portal";

// Both team leader roles land on the same dashboard. The only difference is
// who verified the team, and the dashboard reads that from the API.
const TEAM_LEADER_ROLES: string[] = [
  "ORGANIZATION_TEAM_LEADER",
  "INDEPENDENT_TEAM_LEADER",
];

// Convert the authenticated user into the account structure
// expected by the shared portal pages.
function toPortalAccount(user: AuthUser): PortalAccount {
  const u = user as unknown as Record<string, unknown>;

  return {
    id: String(u.id ?? ""),
    fullName: String(
      u.fullName ?? u.full_name ?? u.name ?? ""
    ),
    email: String(u.email ?? ""),
    username:
      typeof u.username === "string"
        ? u.username
        : null,
    role: String(u.role ?? ""),
    status: String(u.status ?? "ACTIVE"),
    interfaces: Array.isArray(u.interfaces)
      ? (u.interfaces as string[])
      : ["DMC_PORTAL"],
  };
}

export default function App() {
  const [currentScreen, setCurrentScreen] =
    useState<ScreenType>("splash");

  const [registrationType, setRegistrationType] =
    useState<string>("");

  const [admin, setAdmin] =
    useState<AdminUser | null>(() =>
      getStoredToken() ? getStoredAdmin() : null
    );

  // DMC Officer authentication and dashboard
  const [dmcOfficer, setDmcOfficer] =
    useState<AuthUser | null>(() => {
      const stored = getStoredDmcToken()
        ? getStoredDmcUser()
        : null;
      return stored?.role === "DMC_OFFICER"
        ? stored
        : null;
    });

  // District Officer authentication and dashboard
  const [districtOfficer, setDistrictOfficer] =
    useState<AuthUser | null>(() => {
      const stored = getStoredDmcToken()
        ? getStoredDmcUser()
        : null;
      return stored?.role === "DISTRICT_OFFICER"
        ? stored
        : null;
    });

  // Rescue Organization Admin authentication and dashboard
  const [rescueOrgAdmin, setRescueOrgAdmin] =
    useState<AuthUser | null>(() => {
      const stored = getStoredDmcToken()
        ? getStoredDmcUser()
        : null;
      return stored?.role === "RESCUE_ORGANIZATION_ADMIN"
        ? stored
        : null;
    });

  // Rescue Team Leader (organization or independent) authentication and dashboard
  const [teamLeader, setTeamLeader] = useState<AuthUser | null>(() => {
    const stored = getStoredDmcToken() ? getStoredDmcUser() : null;
    return stored && TEAM_LEADER_ROLES.includes(stored.role)
      ? stored
      : null;
  });

  // Shared portal authentication for
  // District Officer, Coordinator and Organization Admin
  const [portalSession, setPortalSession] =
    useState<PortalSession | null>(null);

  const [portalPage, setPortalPage] =
    useState<PortalPage>("dashboard");

  const handleSplashFinish = () => {
    setCurrentScreen("login");
  };

  // Login screen performs the API login and sends
  // the authenticated user and token back here.
  const handleLogin = (
    user: AuthUser,
    token: string
  ) => {
    const account = toPortalAccount(user);

    // DMC Officer uses the national dashboard.
    if (account.role === "DMC_OFFICER") {
      setDmcOfficer(user);
      setCurrentScreen("dmc-dashboard");
      return;
    }

    // District Officer uses the district-scoped dashboard.
    if (account.role === "DISTRICT_OFFICER") {
      setDistrictOfficer(user);
      setCurrentScreen("district-dashboard");
      return;
    }

    // Rescue Organization Admin lands on the organization dashboard.
    if (account.role === "RESCUE_ORGANIZATION_ADMIN") {
      setRescueOrgAdmin(user);
      setCurrentScreen("rescue-organization-dashboard");
      return;
    }

    // A rescue team leader (organization or independent) lands on their own
    // team dashboard, where the verification status and availability live.
    if (TEAM_LEADER_ROLES.includes(account.role)) {
      setTeamLeader(user);
      setCurrentScreen("team-leader-dashboard");
      return;
    }

    // Coordinator and Organization Admin
    // use the shared portal dashboard/profile layout.
    setPortalSession({
      token,
      account,
    });

    setPortalPage("dashboard");
    setCurrentScreen("portal");
  };

  const handleDmcEmailLogin = async (
    email: string,
    password: string
  ) => {
    const { token, user } = await loginDmcOfficer({
      email,
      password,
      interface: "DMC_PORTAL",
    });

    handleLogin(user, token);
  };

  const handlePortalSignOut = useCallback(() => {
    setPortalSession(null);
    setCurrentScreen("login");
  }, []);

  const handleProfileSaved = useCallback(
    (fullName: string) => {
      setPortalSession((prev) =>
        prev
          ? {
              ...prev,
              account: {
                ...prev.account,
                fullName,
              },
            }
          : prev
      );
    },
    []
  );

  const handleShowRegistration = () => {
    setCurrentScreen("registration-selection");
  };

  const handleShowAdminLogin = () => {
    setCurrentScreen("admin-login");
  };

  const handleAdminLoggedIn = (
    loggedInAdmin: AdminUser
  ) => {
    setAdmin(loggedInAdmin);
    setCurrentScreen("admin-dashboard");
  };

  const handleAdminLogout = () => {
    setAdmin(null);
    setCurrentScreen("login");
  };

  const handleDmcOfficerLogout = () => {
    setDmcOfficer(null);
    setCurrentScreen("login");
  };

  const handleDistrictOfficerLogout = () => {
    setDistrictOfficer(null);
    setCurrentScreen("login");
  };

  const handleRescueOrgLogout = () => {
    clearDmcAuth();
    setRescueOrgAdmin(null);
    setCurrentScreen("login");
  };

  const handleTeamLeaderLogout = () => {
    clearDmcAuth();
    setTeamLeader(null);
    setCurrentScreen("login");
  };

  const handleSelectRegistrationType = (
    type: string
  ) => {
    setRegistrationType(type);

    switch (type) {
      case "dmc-officer":
        setCurrentScreen(
          "dmc-officer-registration"
        );
        break;

      case "district-officer":
        setCurrentScreen(
          "district-officer-registration"
        );
        break;

      case "coordinator":
        setCurrentScreen(
          "coordinator-registration"
        );
        break;

      case "organization-admin":
        setCurrentScreen(
          "organization-admin-registration"
        );
        break;

      case "rescue-organization":
        setCurrentScreen(
          "rescue-organization-registration"
        );
        break;

      case "rescue-team":
        setCurrentScreen(
          "rescue-team-registration"
        );
        break;

      default:
        setCurrentScreen("login");
    }
  };

  const handleBackToLogin = () => {
    setCurrentScreen("login");
  };

  const handleRegistrationSuccess = () => {
    setCurrentScreen("registration-success");
  };

  const handleBackToSelection = () => {
    setCurrentScreen(
      "registration-selection"
    );
  };

  // -------------------------
  // Splash
  // -------------------------

  if (currentScreen === "splash") {
    return (
      <KaveeshaDmcSplashScreen
        onFinish={handleSplashFinish}
      />
    );
  }

  // -------------------------
  // Login
  // -------------------------

  if (currentScreen === "login") {
    return (
      <KaveeshaDmcLoginScreen
        onLogin={handleDmcEmailLogin}
        onShowRegistration={
          handleShowRegistration
        }
        onShowAdminLogin={
          handleShowAdminLogin
        }
      />
    );
  }

  // -------------------------
  // DMC Officer Dashboard
  // -------------------------

  if (currentScreen === "dmc-dashboard") {
    if (!dmcOfficer) {
      return (
        <KaveeshaDmcLoginScreen
          onLogin={handleDmcEmailLogin}
          onShowRegistration={
            handleShowRegistration
          }
          onShowAdminLogin={
            handleShowAdminLogin
          }
        />
      );
    }

    return (
      <DmcOfficerDashboard
        officer={dmcOfficer}
        onLogout={handleDmcOfficerLogout}
      />
    );
  }

  // -------------------------
  // District Officer Dashboard
  // -------------------------

  if (currentScreen === "district-dashboard") {
    if (!districtOfficer) {
      return (
        <KaveeshaDmcLoginScreen
          onLogin={handleDmcEmailLogin}
          onShowRegistration={
            handleShowRegistration
          }
          onShowAdminLogin={
            handleShowAdminLogin
          }
        />
      );
    }

    return (
      <KaveeshaDistrictOfficerDashboard
        officer={districtOfficer}
        onLogout={handleDistrictOfficerLogout}
      />
    );
  }

  // -------------------------
  // Rescue Organization Dashboard
  // -------------------------

  if (currentScreen === "rescue-organization-dashboard") {
    if (!rescueOrgAdmin) {
      return (
        <KaveeshaDmcLoginScreen
          onLogin={handleDmcEmailLogin}
          onShowRegistration={
            handleShowRegistration
          }
          onShowAdminLogin={
            handleShowAdminLogin
          }
        />
      );
    }

    return (
      <RescueOrganizationDashboard
        admin={rescueOrgAdmin}
        onLogout={handleRescueOrgLogout}
      />
    );
  }

  // -------------------------
  // Rescue Team Leader Dashboard
  // -------------------------

  if (currentScreen === "team-leader-dashboard") {
    if (!teamLeader) {
      return (
        <KaveeshaDmcLoginScreen
          onLogin={handleDmcEmailLogin}
          onShowRegistration={
            handleShowRegistration
          }
          onShowAdminLogin={
            handleShowAdminLogin
          }
        />
      );
    }

    return (
      <TeamLeaderDashboard
        leader={teamLeader}
        onLogout={handleTeamLeaderLogout}
      />
    );
  }

  // -------------------------
  // Shared Portal
  // -------------------------

  if (currentScreen === "portal") {
    if (!portalSession) {
      return (
        <KaveeshaDmcLoginScreen
          onLogin={handleDmcEmailLogin}
          onShowRegistration={
            handleShowRegistration
          }
          onShowAdminLogin={
            handleShowAdminLogin
          }
        />
      );
    }

    return (
      <PortalLayout
        account={portalSession.account}
        activePage={portalPage}
        onNavigate={setPortalPage}
        onSignOut={handlePortalSignOut}
      >
        {portalPage === "resource-requests" ? (
          <ResourceRequestsPage
            token={portalSession.token}
            onBack={() => setPortalPage("dashboard")}
            onSessionExpired={handlePortalSignOut}
          />
        ) : portalPage === "dashboard" &&
          portalSession.account.role === "COORDINATOR" ? (
          <CoordinatorDashboardPage
            account={portalSession.account}
            token={portalSession.token}
            onOpenRequests={() => setPortalPage("resource-requests")}
          />
        ) : portalPage === "dashboard" ? (
          <DashboardPage
            account={portalSession.account}
          />
        ) : (
          <ProfilePage
            token={portalSession.token}
            account={portalSession.account}
            onProfileSaved={handleProfileSaved}
            onSessionExpired={
              handlePortalSignOut
            }
          />
        )}
      </PortalLayout>
    );
  }

  // -------------------------
  // Admin Login
  // -------------------------

  if (currentScreen === "admin-login") {
    return (
      <AdminLoginScreen
        onBack={handleBackToLogin}
        onLoggedIn={handleAdminLoggedIn}
      />
    );
  }

  // -------------------------
  // Admin Dashboard
  // -------------------------

  if (currentScreen === "admin-dashboard") {
    if (!admin) {
      return (
        <AdminLoginScreen
          onBack={handleBackToLogin}
          onLoggedIn={handleAdminLoggedIn}
        />
      );
    }

    return (
      <AdminDashboard
        admin={admin}
        onLogout={handleAdminLogout}
      />
    );
  }

  // -------------------------
  // Registration Selection
  // -------------------------

  if (
    currentScreen ===
    "registration-selection"
  ) {
    return (
      <RegistrationSelectionPage
        onBack={handleBackToLogin}
        onSelectType={
          handleSelectRegistrationType
        }
      />
    );
  }

  // -------------------------
  // DMC Officer Registration
  // -------------------------

  if (
    currentScreen ===
    "dmc-officer-registration"
  ) {
    return (
      <DmcOfficerRegistration
        onBack={handleBackToSelection}
        onSuccess={
          handleRegistrationSuccess
        }
      />
    );
  }

  // -------------------------
  // District Officer Registration
  // -------------------------

  if (
    currentScreen ===
    "district-officer-registration"
  ) {
    return (
      <DistrictOfficerRegistration
        onBack={handleBackToSelection}
        onSuccess={
          handleRegistrationSuccess
        }
      />
    );
  }

  // -------------------------
  // Coordinator Registration
  // -------------------------

  if (
    currentScreen ===
    "coordinator-registration"
  ) {
    return (
      <CoordinatorRegistration
        onBack={handleBackToSelection}
        onSuccess={
          handleRegistrationSuccess
        }
      />
    );
  }

  // -------------------------
  // Organization Admin Registration
  // -------------------------

  if (
    currentScreen ===
    "organization-admin-registration"
  ) {
    return (
      <OrganizationAdminRegistration
        onBack={handleBackToSelection}
        onSuccess={
          handleRegistrationSuccess
        }
      />
    );
  }

  // -------------------------
  // Rescue Organization Registration
  // -------------------------

  if (
    currentScreen ===
    "rescue-organization-registration"
  ) {
    return (
      <RescueOrganizationRegistration
        onBack={handleBackToSelection}
        onSuccess={
          handleRegistrationSuccess
        }
      />
    );
  }

  // -------------------------
  // Rescue Team Registration
  // -------------------------

  if (
    currentScreen ===
    "rescue-team-registration"
  ) {
    return (
      <RescueTeamRegistration
        onBack={handleBackToSelection}
        onSuccess={
          handleRegistrationSuccess
        }
      />
    );
  }

  // -------------------------
  // Registration Success
  // -------------------------

  if (
    currentScreen ===
    "registration-success"
  ) {
    return (
      <RegistrationSuccessPage
        onBack={handleBackToLogin}
        registrationType={registrationType}
      />
    );
  }

  return null;
}