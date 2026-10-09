import "./global.css";

import { useState, useCallback } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SplashScreen from "./src/screens/kaveesha-SplashScreen";
import LoginScreen from "./src/screens/kaveesha-LoginScreen";
import RegistrationSelectionScreen from "./src/screens/dushani-RegistrationSelectionScreen";
import CitizenRegistrationScreen from "./src/screens/dushani-CitizenRegistrationScreen";
import ReliefAgencyRegistrationScreen from "./src/screens/dushani-ReliefAgencyRegistrationScreen";
import FoodDonorRegistrationScreen from "./src/screens/dushani-FoodDonorRegistrationScreen";
import DeliveryVolunteerRegistrationScreen from "./src/screens/dushani-DeliveryVolunteerRegistrationScreen";
import TeamLeaderRegistrationScreen from "./src/screens/dushani-TeamLeaderRegistrationScreen";
import RegistrationSuccessScreen from "./src/screens/dushani-RegistrationSuccessScreen";
import LeaderApp from "./src/screens/kaveesha-LeaderApp";
import CitizenAlertArea from "./src/screens/dushani-CitizenAlertArea";

import type { LoginResult } from "./src/services/dildhara-authApi";


type ScreenType =
  | "splash"
  | "login"
  | "registration-selection"
  | "citizen-registration"
  | "relief-agency-registration"
  | "food-donor-registration"
  | "delivery-registration"
  | "team-leader-registration"
  | "success";

/** The two roles that lead a rescue team, and so get the mobile leader board. */
const TEAM_LEADER_ROLES = new Set(["ORGANIZATION_TEAM_LEADER", "INDEPENDENT_TEAM_LEADER"]);

function isTeamLeader(role: string): boolean {
  return TEAM_LEADER_ROLES.has(role);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Screens />
    </SafeAreaProvider>
  );
}

function Screens() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("splash");
  const [registrationType, setRegistrationType] = useState<string>("");

  const handleSplashFinish = () => {
    setCurrentScreen("login");
  };

  const handleShowRegistration = () => {
    setCurrentScreen("registration-selection");
  };

  const handleBackToLogin = () => {
    setCurrentScreen("login");
  };

  const handleBackToSelection = () => {
    setCurrentScreen("registration-selection");
  };
  const [session, setSession] = useState<LoginResult | null>(null);
  const handleLoginSuccess = useCallback((result: LoginResult) => {
    setSession(result);
  }, []);

  const handleSignOut = useCallback(() => setSession(null), []);

  if (session) {
    // A rescue team leader is not a citizen filing reports — their job is to be
    // tasked and to move a mission from the field, so they get the leader's
    // mobile command post. Everyone else keeps the citizen alert area.
    if (isTeamLeader(session.account.role)) {
      return (
        <LeaderApp
          token={session.token}
          account={session.account}
          onSignOut={handleSignOut}
        />
      );
    }

    return (
      <CitizenAlertArea
        token={session.token}
        account={session.account}
        onSignOut={handleSignOut}
      />
    );
  }

  const handleSelectRegistrationType = (type: string) => {
    setRegistrationType(type);
    switch (type) {
      case "citizen":
        setCurrentScreen("citizen-registration");
        break;
      case "relief-agency":
        setCurrentScreen("relief-agency-registration");
        break;
      case "food-donor":
        setCurrentScreen("food-donor-registration");
        break;
      case "delivery-volunteer":
        setCurrentScreen("delivery-registration");
        break;
      case "team-leader":
        setCurrentScreen("team-leader-registration");
        break;
      default:
        setCurrentScreen("login");
    }
  };

  const handleRegistrationSuccess = (submittedType?: string) => {
    if (submittedType) setRegistrationType(submittedType);
    setCurrentScreen("success");
  };

  if (currentScreen === "splash") {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (currentScreen === "login") {
    return (
      <LoginScreen
        onShowRegistration={handleShowRegistration}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (currentScreen === "registration-selection") {
    return (
      <RegistrationSelectionScreen
        onBack={handleBackToLogin}
        onSelectType={handleSelectRegistrationType}
      />
    );
  }

  if (currentScreen === "citizen-registration") {
    return (
      <CitizenRegistrationScreen
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "relief-agency-registration") {
    return (
      <ReliefAgencyRegistrationScreen
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "food-donor-registration") {
    return (
      <FoodDonorRegistrationScreen
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "delivery-registration") {
    return (
      <DeliveryVolunteerRegistrationScreen
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "team-leader-registration") {
    return (
      <TeamLeaderRegistrationScreen
        onBack={handleBackToSelection}
        onSuccess={handleRegistrationSuccess}
      />
    );
  }

  if (currentScreen === "success") {
    return (
      <RegistrationSuccessScreen
        onBack={handleBackToLogin}
        registrationType={registrationType}
      />
    );
  }

  return null;
}