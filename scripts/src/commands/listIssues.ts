import * as dav from "../webdavClient";
import type { Column } from "../../../web/src/lib/issue-format";

export interface ListIssuesOptions {
  status: Column;
  max: number;
}

/** List the top `max` issues in a column, most-priority-first per _order.json. */
export async function listIssues({ status, max }: ListIssuesOptions): Promise<void> {
  const issues = (await dav.listIssues(status)).slice(0, max);

  if (issues.length === 0) {
    console.log(`No issues in "${status}".`);
    return;
  }

  for (const issue of issues) {
    const project = issue.project ? ` [${issue.project}]` : "";
    console.log(`${issue.id}\t${issue.subject}${project}`);
  }
}
