import * as dav from "../webdavClient";

/** List the admin-maintained projects from issues/_projects.json. */
export async function listProjects(): Promise<void> {
  const projects = await dav.listProjects();

  if (projects.length === 0) {
    console.log("No projects defined.");
    return;
  }

  for (const project of projects) {
    console.log(project);
  }
}
