import * as dav from "../webdavClient";

/** Print an issue's full parsed content (subject/content/project/column) as JSON. */
export async function fetchIssue(id: string): Promise<void> {
  const issue = await dav.getIssue(id);
  if (!issue) {
    throw new Error(`Issue not found: ${id}`);
  }
  console.log(JSON.stringify(issue, null, 2));
}
