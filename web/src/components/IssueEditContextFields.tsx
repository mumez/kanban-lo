import { type Component, Show } from "solid-js";

interface Props {
  workingDir: string;
  specLevel: string;
  /** Choices from issues/_specLevels.json. null means free-text entry. */
  specLevels: string[] | null;
  pr: string;
  sessionId: string;
  onWorkingDir: (value: string) => void;
  onSpecLevel: (value: string) => void;
  onPr: (value: string) => void;
  onSessionId: (value: string) => void;
}

/**
 * Dropdown choices. A saved level the file does not list is appended so the
 * select shows the value that will actually be saved.
 */
function specLevelOptions(levels: readonly string[], current: string): string[] {
  return levels.includes(current) ? [...levels] : [...levels, current];
}

function specLevelLabel(level: string): string {
  return level === "" ? "(none)" : level;
}

/**
 * Working dir, spec level, PR URL, and session id. These exist only on an
 * issue that has already been created, so the create form never renders them.
 */
const IssueEditContextFields: Component<Props> = (props) => {
  return (
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="form-control">
        <label class="label py-0" for="issue-working-dir">
          <span class="label-text font-medium">Working Dir</span>
        </label>
        <input
          id="issue-working-dir"
          type="text"
          class="input input-bordered w-full"
          placeholder="/path/to/repo"
          value={props.workingDir}
          onInput={(e) => props.onWorkingDir(e.currentTarget.value)}
        />
      </div>

      <div class="form-control">
        <label class="label py-0" for="issue-spec-level">
          <span class="label-text font-medium">Spec Level</span>
        </label>
        <Show
          when={props.specLevels !== null}
          fallback={
            <input
              id="issue-spec-level"
              type="text"
              class="input input-bordered w-full"
              value={props.specLevel}
              onInput={(e) => props.onSpecLevel(e.currentTarget.value)}
            />
          }
        >
          <select
            id="issue-spec-level"
            class="select select-bordered w-full"
            value={props.specLevel}
            onChange={(e) => props.onSpecLevel(e.currentTarget.value)}
          >
            {specLevelOptions(props.specLevels ?? [], props.specLevel).map((level) => (
              <option value={level}>{specLevelLabel(level)}</option>
            ))}
          </select>
        </Show>
      </div>

      <div class="form-control sm:col-span-2">
        <label class="label py-0" for="issue-pr">
          <span class="label-text font-medium">PR URL</span>
        </label>
        <input
          id="issue-pr"
          type="text"
          class="input input-bordered w-full"
          placeholder="https://..."
          value={props.pr}
          onInput={(e) => props.onPr(e.currentTarget.value)}
        />
      </div>

      <div class="form-control sm:col-span-2">
        <label class="label py-0" for="issue-session-id">
          <span class="label-text font-medium">Session ID</span>
        </label>
        <input
          id="issue-session-id"
          type="text"
          class="input input-bordered w-full"
          placeholder="Agent session id"
          value={props.sessionId}
          onInput={(e) => props.onSessionId(e.currentTarget.value)}
        />
      </div>
    </div>
  );
};

export default IssueEditContextFields;
