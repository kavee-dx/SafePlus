import { useCallback, useState } from "react";

import KaveeshaDmcLoginScreen from "./pages/kaveesha-DmcLoginScreen";
import KaveeshaDmcSplashScreen from "./pages/kaveesha-DmcSplashScreen";
import RegistrationSelectionPage from "./pages/dushani-RegistrationSelectionPage";
import DmcOfficerRegistration from "./pages/dushani-DMCOfficerRegistration";
import DistrictOfficerRegistration from "./pages/dushani-DistrictOfficerRegistration";
import CoordinatorRegistration from "./pages/dushani-CoordinatorRegistration";
import OrganizationAdminRegistration from "./pages/dushani-OrganizationAdminRegistration";
import RegistrationSuccessPage from "./pages/dushani-RegistrationSuccessPage";
import AdminLoginScreen from "./pages/amasha-AdminLoginScreen";
import AdminDashboard from "./pages/amasha-AdminDashboard";
import DmcOfficerDashboard from "./pages/dushani-DmcOfficerDashboard";
import KaveeshaDistrictOfficerDashboard from "./pages/kaveesha-DistrictOfficerDashboard";

import PortalLayout, {
  type PortalPage,
} from "./pages/dildhara-PortalLayout";
import DashboardPage from "./pages/dildhara-DashboardPage";
import ProfilePage from "./pages/dildhara-ProfilePage";

import { getStoredAdmin, getStoredToken } from "./services/amasha-adminApi";
import {
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
  | "registration-success"
  | "admin-login"
  | "admin-dashboard"
  | "dmc-dashboard"
  | "district-dashboard"
  | "portal";

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
        {portalPage === "dashboard" ? (
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