import { useCallback, useEffect, useState } from "react";
import { AppRoute, buildRouteHref, parseRoute } from "../utils/router.js";

export interface NavigateOptions {
  readonly replace?: boolean;
}

function readCurrentRoute(): AppRoute {
  if (typeof window === "undefined") {
    return { kind: "root" };
  }
  return parseRoute(window.location.pathname, window.location.search);
}

export function useAppRouter() {
  const [route, setRoute] = useState<AppRoute>(() => readCurrentRoute());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPopState = () => {
      setRoute(readCurrentRoute());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute, options?: NavigateOptions) => {
    if (typeof window === "undefined") {
      setRoute(nextRoute);
      return;
    }
    const nextHref = buildRouteHref(nextRoute);
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (nextHref !== currentHref) {
      if (options?.replace) {
        window.history.replaceState(null, "", nextHref);
      } else {
        window.history.pushState(null, "", nextHref);
      }
    }
    setRoute(nextRoute);
  }, []);

  return { route, navigate };
}
