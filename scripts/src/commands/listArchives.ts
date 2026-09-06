import * as dav from "../webdavClient";

/** List all archived issues. */
export async function listArchives(): Promise<void> {
  const issues = await dav.listArchivedIssues();

  if (issues.length === 0) {
    console.log("No archived issues.");
    return;
  }

  for (const issue of issues) {
    const project = issue.project ? ` [${issue.project}]` : "";
    console.log(`${issue.id}\t${issue.subject}${project}`);
  }
}
