import type { ComponentType } from "react";

export interface IconProps {
  name?: string;
  size?: number;
  color?: string;
  testID?: string;
  className?: string;
}

/**
 * Jest mock for the icon package: the real one loads a font through
 * expo-asset, which has no meaning in a unit test. Icons carry no assertions,
 * so they render nothing.
 */
export const Ionicons: ComponentType<IconProps> = () => null;

export default { Ionicons };
