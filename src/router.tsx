import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { IndexRoute } from "@/routes/index";
import { SobreRoute } from "@/routes/sobre";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexRoute,
});

const sobreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sobre",
  component: SobreRoute,
});

const routeTree = rootRoute.addChildren([indexRoute, sobreRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
