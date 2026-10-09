import type { ComponentType } from "react";

import CitizenHome from "./amasha-CitizenHome";
import RoleHome from "./amasha-RoleHome";
import type { HomeProps } from "./amasha-HomeParts";

/** Roles with a fully custom home page. Everything else uses RoleHome. */
const HOME_BY_ROLE: Record<string, ComponentType<HomeProps>> = {
  CITIZEN: CitizenHome,
};

export default function HomeTab(props: HomeProps) {
  const Home = HOME_BY_ROLE[props.profile.user.role] ?? RoleHome;
  return <Home {...props} />;
}