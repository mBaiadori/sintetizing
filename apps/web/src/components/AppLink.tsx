import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { AppRoute, buildRouteHref } from "../utils/router.js";

export interface AppLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  readonly to: AppRoute;
  readonly onNavigate: (route: AppRoute) => void;
}

export function AppLink({
  to,
  onNavigate,
  onClick,
  children,
  ...rest
}: AppLinkProps) {
  const href = buildRouteHref(to);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    onNavigate(to);
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
