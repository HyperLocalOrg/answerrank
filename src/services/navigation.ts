import { useEffect, useState } from "react";

export type Route =
  | { name: "landing" }
  | { name: "report"; reportId: string };

const ROUTE_CHANGE = "routechange";

export function parseRoute(): Route {
  const reportId = new URLSearchParams(window.location.search).get("reportId");
  if (reportId) return { name: "report", reportId };
  return { name: "landing" };
}

export const navigation = {
  toReport(reportId: string) {
    window.history.pushState({}, "", `?reportId=${reportId}`);
    window.dispatchEvent(new Event(ROUTE_CHANGE));
  },
  replaceReport(reportId: string) {
    window.history.replaceState({}, "", `?reportId=${reportId}`);
    window.dispatchEvent(new Event(ROUTE_CHANGE));
  },
  toLanding() {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new Event(ROUTE_CHANGE));
  },
};

export function useRouter(): Route {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    function update() { setRoute(parseRoute()); }
    window.addEventListener("popstate", update);
    window.addEventListener(ROUTE_CHANGE, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(ROUTE_CHANGE, update);
    };
  }, []);

  return route;
}
