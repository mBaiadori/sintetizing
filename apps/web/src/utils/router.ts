import { GENERAL_CATEGORY_ID } from "./format.js";
import type { GraphFocus } from "./sankey-graph.js";

export type CommunitySettingsTab = "overview" | "members" | "relays";

export type AppRoute =
  | { readonly kind: "root" }
  | { readonly kind: "feed"; readonly communityId: string }
  | {
      readonly kind: "graph";
      readonly communityId: string;
      readonly categoryId: string | null;
      readonly subjectScope: string | null;
    }
  | {
      readonly kind: "workspace";
      readonly communityId: string;
      readonly categoryId: string;
      readonly subjectScope: string | null;
      readonly proposalId: string | null;
      readonly newSubject: boolean;
    }
  | {
      readonly kind: "templates";
      readonly communityId: string;
      readonly categoryId: string | null;
      readonly templateId: string | null;
    }
  | {
      readonly kind: "community-settings";
      readonly communityId: string;
      readonly tab?: CommunitySettingsTab;
    }
  | { readonly kind: "add-community" }
  | { readonly kind: "profile" }
  | { readonly kind: "storage" };

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function buildRouteHref(route: AppRoute): string {
  switch (route.kind) {
    case "root":
      return "/";
    case "add-community":
      return "/communities/add";
    case "profile":
      return "/profile";
    case "storage":
      return "/storage";
    case "feed":
      return `/c/${encodeURIComponent(route.communityId)}/feed`;
    case "community-settings": {
      const base = `/c/${encodeURIComponent(route.communityId)}/settings`;
      if (route.tab && route.tab !== "overview") {
        return `${base}/${route.tab}`;
      }
      return base;
    }
    case "graph": {
      const base = `/c/${encodeURIComponent(route.communityId)}/graph`;
      const params = new URLSearchParams();
      if (route.categoryId) {
        params.set("cat", route.categoryId);
      }
      if (route.subjectScope) {
        params.set("s", route.subjectScope);
      }
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    }
    case "workspace": {
      const c = encodeURIComponent(route.communityId);
      const cat = encodeURIComponent(route.categoryId || GENERAL_CATEGORY_ID);
      if (route.newSubject) {
        return `/c/${c}/workspace/${cat}/new-subject`;
      }
      if (route.subjectScope) {
        const s = encodeURIComponent(route.subjectScope);
        if (route.proposalId) {
          return `/c/${c}/workspace/${cat}/s/${s}/p/${encodeURIComponent(route.proposalId)}`;
        }
        return `/c/${c}/workspace/${cat}/s/${s}`;
      }
      if (route.categoryId && route.categoryId !== GENERAL_CATEGORY_ID) {
        return `/c/${c}/workspace/${cat}`;
      }
      return `/c/${c}/workspace`;
    }
    case "templates": {
      const base = `/c/${encodeURIComponent(route.communityId)}/templates`;
      const params = new URLSearchParams();
      if (route.categoryId) {
        params.set("cat", route.categoryId);
      }
      if (route.templateId) {
        params.set("t", route.templateId);
      }
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    }
  }
}

export function parseRoute(pathname: string, search: string): AppRoute {
  const params = new URLSearchParams(search);

  // Compatibilidade com links antigos no formato /?c=...&cat=...&s=...&p=...
  const legacyCommunityId = params.get("c");
  if ((pathname === "/" || pathname === "/index.html") && legacyCommunityId) {
    const legacySubject = params.get("s");
    const legacyProposal = params.get("p");
    const legacyCategory = params.get("cat") ?? GENERAL_CATEGORY_ID;
    if (legacySubject || legacyProposal || params.has("cat")) {
      return {
        kind: "workspace",
        communityId: legacyCommunityId,
        categoryId: legacyCategory,
        subjectScope: legacySubject,
        proposalId: legacyProposal,
        newSubject: false,
      };
    }
    return { kind: "feed", communityId: legacyCommunityId };
  }

  const segments = pathname
    .split("/")
    .filter((seg) => seg.length > 0)
    .map(safeDecode);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "index.html")) {
    return { kind: "root" };
  }

  if (segments[0] === "profile") {
    return { kind: "profile" };
  }

  if (segments[0] === "storage") {
    return { kind: "storage" };
  }

  if (segments[0] === "communities" && segments[1] === "add") {
    return { kind: "add-community" };
  }

  if (segments[0] === "c" && segments[1]) {
    const communityId = segments[1];
    const section = segments[2] ?? "feed";

    if (section === "feed") {
      return { kind: "feed", communityId };
    }

    if (section === "settings") {
      const rawTab = segments[3];
      const tab: CommunitySettingsTab =
        rawTab === "members" || rawTab === "relays" ? rawTab : "overview";
      return { kind: "community-settings", communityId, tab };
    }

    if (section === "graph") {
      const subjectScope = params.get("s");
      const categoryId = params.get("cat");
      return {
        kind: "graph",
        communityId,
        categoryId,
        subjectScope,
      };
    }

    if (section === "templates") {
      const categoryId = params.get("cat");
      const templateId = params.get("t");
      return {
        kind: "templates",
        communityId,
        categoryId,
        templateId,
      };
    }

    if (section === "workspace") {
      const categoryId = segments[3] || GENERAL_CATEGORY_ID;
      if (segments[4] === "new-subject") {
        return {
          kind: "workspace",
          communityId,
          categoryId,
          subjectScope: null,
          proposalId: null,
          newSubject: true,
        };
      }
      if (segments[4] === "s" && segments[5]) {
        const subjectScope = segments[5];
        const proposalId = segments[6] === "p" && segments[7] ? segments[7] : null;
        return {
          kind: "workspace",
          communityId,
          categoryId,
          subjectScope,
          proposalId,
          newSubject: false,
        };
      }
      return {
        kind: "workspace",
        communityId,
        categoryId,
        subjectScope: null,
        proposalId: null,
        newSubject: false,
      };
    }

    return { kind: "feed", communityId };
  }

  return { kind: "root" };
}

export function graphFocusToRoute(communityId: string, focus: GraphFocus): AppRoute {
  switch (focus.kind) {
    case "community":
      return { kind: "graph", communityId, categoryId: null, subjectScope: null };
    case "category":
      return {
        kind: "graph",
        communityId,
        categoryId: focus.categoryId,
        subjectScope: null,
      };
    case "subject":
      return {
        kind: "graph",
        communityId,
        categoryId: focus.categoryId,
        subjectScope: focus.subjectScope,
      };
  }
}

export function routeToGraphFocus(route: Extract<AppRoute, { kind: "graph" }>): GraphFocus {
  if (route.subjectScope) {
    return {
      kind: "subject",
      categoryId: route.categoryId ?? GENERAL_CATEGORY_ID,
      subjectScope: route.subjectScope,
    };
  }
  if (route.categoryId) {
    return { kind: "category", categoryId: route.categoryId };
  }
  return { kind: "community" };
}
