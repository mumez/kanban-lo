import { type Component, Show } from "solid-js";
import { openableHttpUrl } from "../lib/issue-format";

interface Props {
  pr: string | undefined;
  class?: string;
}

/**
 * Link to an issue's pull request. Nothing is rendered unless `pr` is an
 * http(s) URL. The click stays on the link, so a parent card does not start
 * a drag from it.
 */
const IssuePrLink: Component<Props> = (props) => {
  const href = () => openableHttpUrl(props.pr);
  return (
    <Show when={href()}>
      {(url) => (
        <a
          href={url()}
          target="_blank"
          rel="noopener noreferrer"
          title={url()}
          class={props.class ?? "link link-primary"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {url()}
          <span class="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </Show>
  );
};

export default IssuePrLink;
