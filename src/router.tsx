import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { IndexRoute } from "@/routes/index";
import { SobreRoute } from "@/routes/sobre";

const rootRoute = createRootRoute({
  component: () => (
    <TooltipPrimitive.Provider delayDuration={400}>
      <Outlet />
    </TooltipPrimitive.Provider>
  ),
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

// basepath keeps routes matching when the app is served under a subpath
// (GitHub Pages abraaoalves.github.io/uecetexlive → BASE_URL "/uecetexlive/").
export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
