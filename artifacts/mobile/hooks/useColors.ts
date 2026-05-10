import { useContext } from "react";

import colors from "@/constants/colors";
import { ThemeContext } from "@/context/ThemeContext";

export function useColors() {
  const { resolvedScheme } = useContext(ThemeContext);
  const palette = resolvedScheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
