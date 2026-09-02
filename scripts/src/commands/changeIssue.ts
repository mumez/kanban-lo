import * as dav from "../webdavClient";
import type { Column } from "../../../web/src/lib/issue-format";

export interface ChangeIssueOptions {
  id: string;
  status?: Column;
  content?: string;
  appendContent?: string;
}

/**
 * Change an existing issue's content and/or status. A status change moves
 * the issue to the top of the destination column's order (see
 * webdavClient.changeIssueStatus).
 */
export async function changeIssue({
  id,
  status,
  content,
  appendContent,
}: ChangeIssueOptions): Promise<void> {
  if (status === undefined && content === undefined && appendContent === undefined) {
    throw new Error("change-issue requires at least one of --status, --content, or --append-content");
  }
  if (content !== undefined && appendContent !== undefined) {
    throw new Error("change-issue accepts only one of --content or --append-content");
  }

  let issue = await dav.getIssue(id);
  if (!issue) {
    throw new Error(`Issue not found: ${id}`);
  }

  if (content !== undefined) {
    issue = await dav.updateIssueContent(issue, content);
  }
  if (appendContent !== undefined) {
    const nextContent = issue.content
      ? `${issue.content}\n\n${appendContent}`
      : appendContent;
    issue = await dav.updateIssueContent(issue, nextContent);
  }
  if (status !== undefined) {
    issue = await dav.changeIssueStatus(issue, status);
  }

  console.log(JSON.stringify(issue, null, 2));
}
