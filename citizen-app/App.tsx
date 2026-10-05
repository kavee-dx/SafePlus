import "./global.css";

import { useState } from "react";

import SplashScreen from "./src/screens/kaveesha-SplashScreen";
import LoginScreen from "./src/screens/kaveesha-LoginScreen";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <SplashScreen
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  return <LoginScreen />;
}