import { useState } from "react";

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
import { getStoredAdmin, getStoredToken } from "./services/amasha-adminApi";
import type { AdminUser } from "./types/auth";

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
  | "admin-dashboard";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("splash");
  const [registrationType, setRegistrationType] = useState<string>("");
  const [admin, setAdmin] = useState<AdminUser | null>(() =>
    getStoredToken() ? getStoredAdmin() : null
  );

  const handleSplashFinish = () => {
    setCurrentScreen("login");
  };

  const handleLogin = () => {
    console.log("DMC login submitted");
    // TODO: Implement actual login logic
  };

  const handleShowRegistration = () => {
    setCurrentScreen("registration-selection");
  };

  const handleShowAdminLogin = () => {
    setCurrentScreen("admin-login");
  };

  const handleAdminLoggedIn = (loggedInAdmin: AdminUser) => {
    setAdmin(loggedInAdmin);
    setCurrentScreen("admin-dashboard");
  };

  const handleAdminLogout = () => {
    setAdmin(null);
    setCurrentScreen("login");
  };

  const handleSelectRegistrationType = (type: string) => {
    setRegistrationType(type);
    switch (type) {
      case "dmc-officer":
        setCurrentScreen("dmc-officer-registration");
        break;
      case "district-officer":
        setCurrentScreen("district-officer-registration");
        break;
      case "coordinator":
        setCurrentScreen("coordinator-registration");
        break;
      case "organization-admin":
        setCurrentScreen("organization-admin-registration");
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
    setCurrentScreen("registration-selection");
  };

  if (currentScreen === "splash") {
    return <KaveeshaDmcSplashScreen onFinish={handleSplashFinish} />;
  }

  if (currentScreen === "login") {
    return (
      <KaveeshaDmcLoginScreen
        onLogin={handleLogin}
        onShowRegistration={handleShowRegistration}
        onShowAdminLogin={handleShowAdminLogin}
      />
    );
  }

  if (currentScreen === "admin-login") {
    return (
      <AdminLoginScreen
        onBack={handleBackToLogin}
        onLoggedIn={handleAdminLoggedIn}
      />
    );
  }

  if (currentScreen === "admin-dashboard") {
    if (!admin) {
      return (
        <AdminLoginScreen
          onBack={handleBackToLogin}
          onLoggedIn={handleAdminLoggedIn}
        />
      );
    }
    return <AdminDashboard admin={admin} onLogout={handleAdminLogout} />;
  }

  if (currentScreen === "registration-selection") {
    return (
      <RegistrationSelectionPage
        onBack={handleBackToLogin}
        onSelectType={handleSelectRegistrationType}
      />
    );
  }

  if (currentScreen === "dmc-officer-registration") {
    return (
      <DmcOfficerRegistration
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "district-officer-registration") {
    return (
      <DistrictOfficerRegistration
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "coordinator-registration") {
    return (
      <CoordinatorRegistration
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "organization-admin-registration") {
    return (
      <OrganizationAdminRegistration
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "registration-success") {
    return (
      <RegistrationSuccessPage
        onBack={handleBackToLogin}
        registrationType={registrationType}
      />
    );
  }

  return null;
}
