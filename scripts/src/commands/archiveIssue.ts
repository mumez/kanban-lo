import * as dav from "../webdavClient";

/** Archive an issue by id: move its file to _archive/, out of its current column. */
export async function archiveIssue(id: string): Promise<void> {
  const issue = await dav.getIssue(id);
  if (!issue) {
    throw new Error(`Issue not found: ${id}`);
  }
  await dav.archiveIssue(issue);
  console.log(`Archived ${id}`);
}
