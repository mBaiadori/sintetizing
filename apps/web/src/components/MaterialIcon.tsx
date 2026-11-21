export type MaterialIconName =
  | "account_tree"
  | "add"
  | "arrow_back"
  | "ballot"
  | "category"
  | "center_focus_strong"
  | "check_circle"
  | "chevron_left"
  | "chevron_right"
  | "close"
  | "cloud_done"
  | "cloud_off"
  | "compare_arrows"
  | "content_copy"
  | "dataset"
  | "delete"
  | "delete_forever"
  | "description"
  | "dynamic_feed"
  | "edit"
  | "expand_less"
  | "expand_more"
  | "fork_right"
  | "forum"
  | "gavel"
  | "groups"
  | "history"
  | "how_to_vote"
  | "hub"
  | "info"
  | "inventory_2"
  | "key"
  | "link"
  | "list"
  | "local_fire_department"
  | "lock"
  | "logout"
  | "menu"
  | "menu_open"
  | "open_in_new"
  | "person"
  | "person_add"
  | "refresh"
  | "remove"
  | "schedule"
  | "science"
  | "search"
  | "send"
  | "share"
  | "sort"
  | "sync"
  | "tag"
  | "tune"
  | "unfold_less"
  | "unfold_more"
  | "verified_user"
  | "warning";

export interface MaterialIconProps {
  readonly name: MaterialIconName;
  readonly filled?: boolean;
}

export function MaterialIcon({ name, filled = false }: MaterialIconProps) {
  const className = filled
    ? "material-symbols-rounded material-symbols-rounded--filled"
    : "material-symbols-rounded";

  return (
    <span className={className} aria-hidden="true">
      {name}
    </span>
  );
}
