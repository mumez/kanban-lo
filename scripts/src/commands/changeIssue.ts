import * as dav from "../webdavClient";
import { type Column, type IssueFrontmatter, frontmatterOf } from "../../../web/src/lib/issue-format";

export interface ChangeIssueOptions extends IssueFrontmatter {
  id: string;
  status?: Column;
  content?: string;
  appendContent?: string;
}

/**
 * Change an existing issue's content, frontmatter (project / workingDir /
 * specLevel / pr / sessionId),
 * and/or status. A frontmatter option given as "" removes that key. A status
 * change moves the issue to the top of the destination column's order (see
 * webdavClient.changeIssueStatus).
 */
export async function changeIssue(options: ChangeIssueOptions): Promise<void> {
  const { id, status, content, appendContent } = options;
  const frontmatterChanges: IssueFrontmatter = Object.fromEntries(
    Object.entries(frontmatterOf(options)).filter(([, value]) => value !== undefined)
  );
  const hasFrontmatterChanges = Object.keys(frontmatterChanges).length > 0;

  if (status === undefined && content === undefined && appendContent === undefined && !hasFrontmatterChanges) {
    throw new Error(
      "change-issue requires at least one of --status, --content, --append-content, --project, --working-dir, --spec-level, --pr, or --session-id"
    );
  }
  if (content !== undefined && appendContent !== undefined) {
    throw new Error("change-issue accepts only one of --content or --append-content");
  }

  let issue = await dav.getIssue(id);
  if (!issue) {
    throw new Error(`Issue not found: ${id}`);
  }

  const contentChange =
    appendContent !== undefined
      ? { content: issue.content ? `${issue.content}\n\n${appendContent}` : appendContent }
      : content !== undefined
        ? { content }
        : {};
  if (contentChange.content !== undefined || hasFrontmatterChanges) {
    issue = await dav.updateIssue(issue, { ...contentChange, ...frontmatterChanges });
  }
  if (status !== undefined) {
    issue = await dav.changeIssueStatus(issue, status);
  }

  console.log(JSON.stringify(issue, null, 2));
}
