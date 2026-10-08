import * as Network from "expo-network";

/** E1: true when the handset currently has a usable network path. */
export async function isNetworkAvailable(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();

    if (state.type === Network.NetworkStateType.NONE) {
      return false;
    }

    if (state.isConnected === false) {
      return false;
    }

    if (state.isInternetReachable === false) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function subscribeToNetworkRestored(
  onRestored: () => void
): () => void {
  const subscription = Network.addNetworkStateListener((state) => {
    const connected = state.isConnected !== false;
    const reachable = state.isInternetReachable !== false;
    const hasLink = state.type !== Network.NetworkStateType.NONE;

    if (connected && reachable && hasLink) {
      onRestored();
    }
  });

  return () => subscription.remove();
}
