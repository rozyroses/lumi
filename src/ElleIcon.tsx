export type ElleIconName =
  | "home" | "search" | "bell" | "message" | "bookmark" | "users"
  | "sparkle" | "profile" | "reply" | "repost" | "heart" | "heart-fill"
  | "chart" | "send" | "plus" | "refresh" | "theme" | "more";

export function ElleIcon({ name, className = "" }: { name: ElleIconName; className?: string }) {
  return (
    <svg className={"elle-ui-icon " + className} aria-hidden="true" focusable="false">
      <use href={`${import.meta.env.BASE_URL}elle-icons.svg#${name}`} />
    </svg>
  );
}
