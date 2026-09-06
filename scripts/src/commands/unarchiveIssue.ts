import * as dav from "../webdavClient";
import type { Column } from "../../../web/src/lib/issue-format";

export interface UnarchiveIssueOptions {
  id: string;
  status: Column;
}

/** Restore an archived issue into a column. */
export async function unarchiveIssue({ id, status }: UnarchiveIssueOptions): Promise<void> {
  let issue;
  try {
    issue = await dav.unarchiveIssue(id, status);
  } catch {
    throw new Error(`Archived issue not found: ${id}`);
  }
  console.log(JSON.stringify(issue, null, 2));
}
