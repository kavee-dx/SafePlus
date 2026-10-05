import { useState } from "react";

import KaveeshaDmcLoginScreen from "./pages/kaveesha-DmcLoginScreen";
import KaveeshaDmcSplashScreen from "./pages/kaveesha-DmcSplashScreen";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <KaveeshaDmcSplashScreen
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  return (
    <KaveeshaDmcLoginScreen
      onLogin={() => {
        console.log("DMC login submitted");
      }}
    />
  );
}
