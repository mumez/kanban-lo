import { type Component, Show } from "solid-js";
import { openableHttpUrl } from "../lib/url";
import IssuePrLink from "./IssuePrLink";

interface Props {
  project: string | undefined;
  pr: string | undefined;
  /** Extra classes on the row, such as the view modal's top margin. */
  class?: string;
}

/**
 * Project badge with the pull-request button on its right. Nothing is
 * rendered when the issue has neither a project nor an openable PR URL.
 */
const IssueProjectRow: Component<Props> = (props) => {
  const rowClass = () =>
    ["flex min-w-0 items-center gap-1.5", props.class].filter(Boolean).join(" ");
  return (
    <Show when={props.project || openableHttpUrl(props.pr)}>
      <div class={rowClass()}>
        <Show when={props.project}>
          <span class="badge badge-ghost badge-sm min-w-0 truncate">{props.project}</span>
        </Show>
        <IssuePrLink pr={props.pr} />
      </div>
    </Show>
  );
};

export default IssueProjectRow;
