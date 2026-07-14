import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AppShell } from "./AppShell";

// TopBar renders a router <Link>, so the story mounts inside a minimal
// in-memory router instead of the app's real one (src/router.tsx).
function withRouter(Story: () => React.ReactNode) {
  const rootRoute = createRootRoute({ component: Story });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const sobreRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sobre",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, sobreRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return <RouterProvider router={router} />;
}

const meta = {
  title: "Shell/AppShell",
  component: AppShell,
  decorators: [withRouter],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
