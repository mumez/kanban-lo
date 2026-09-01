import * as dav from "../webdavClient";
import type { Column } from "../../../web/src/lib/issue-format";

export interface CreateIssueOptions {
  subject: string;
  content: string;
  project?: string;
  status: Column;
}

/** Create a new issue in the given column (default: todo). */
export async function createIssue({
  subject,
  content,
  project,
  status,
}: CreateIssueOptions): Promise<void> {
  const issue = await dav.createIssue(status, subject, content, project);
  console.log(JSON.stringify(issue, null, 2));
}
