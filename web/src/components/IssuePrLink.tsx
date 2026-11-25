import { type Component, Show } from "solid-js";
import { openableHttpUrl } from "../lib/url";

interface Props {
  pr: string | undefined;
}

/**
 * Compact link to an issue's pull request, shown beside the project name.
 * Nothing is rendered unless `pr` is an http(s) URL. The click stays on the
 * link, so a parent card does not start a drag from it.
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
          draggable={false}
          class="btn btn-outline btn-primary btn-xs shrink-0 gap-1 px-1.5 font-semibold"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden="true" class="inline-flex items-center gap-0.5">
            PR
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z"
                clip-rule="evenodd"
              />
              <path
                fill-rule="evenodd"
                d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
          <span class="sr-only">Pull request {url()} (opens in a new tab)</span>
        </a>
      )}
    </Show>
  );
};

export default IssuePrLink;
