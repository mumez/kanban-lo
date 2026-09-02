#!/usr/bin/env -S npx tsx
import { Command, Option } from "commander";
import { COLUMNS, configureDavBase } from "./webdavClient";
import { listIssues } from "./commands/listIssues";
import { fetchIssue } from "./commands/fetchIssue";
import { changeIssue } from "./commands/changeIssue";
import { createIssue } from "./commands/createIssue";

const program = new Command();

/** Run a command action, printing errors to stderr and exiting non-zero instead of throwing. */
function run(fn: () => Promise<void>): void {
  fn().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}

program
  .name("kbl")
  .description("Admin CLI for kanban-lo — manages issues over WebDAV")
  .version("0.1.0")
  .option("--dav-base <url>", "WebDAV base URL (overrides KBL_DAV_BASE env var)")
  .hook("preAction", (thisCommand) => {
    const davBase = thisCommand.opts().davBase as string | undefined;
    if (davBase) configureDavBase(davBase);
  });

program
  .command("list-issues")
  .description("List issues in a column, most-priority-first")
  .addOption(new Option("--status <column>", "column to list").choices(COLUMNS).default("todo"))
  .addOption(new Option("--max <n>", "maximum number of issues to list").default(10).argParser((v) => parseInt(v, 10)))
  .action((opts) => run(() => listIssues({ status: opts.status, max: opts.max })));

program
  .command("fetch-issue")
  .description("Print an issue's full content as JSON")
  .requiredOption("--id <id>", "issue id")
  .action((opts) => run(() => fetchIssue(opts.id)));

program
  .command("change-issue")
  .description("Change an issue's status and/or content")
  .requiredOption("--id <id>", "issue id")
  .addOption(new Option("--status <column>", "move the issue to this column (inserted at the top)").choices(COLUMNS))
  .option("--content <text>", "replace the issue's content")
  .option("--append-content <text>", "append text to the issue's existing content")
  .action((opts) =>
    run(() =>
      changeIssue({
        id: opts.id,
        status: opts.status,
        content: opts.content,
        appendContent: opts.appendContent,
      })
    )
  );

program
  .command("create-issue")
  .description("Create a new issue")
  .requiredOption("--subject <text>", "issue subject")
  .option("--content <text>", "issue content", "")
  .option("--project <name>", "project classification")
  .addOption(new Option("--status <column>", "initial column").choices(COLUMNS).default("todo"))
  .action((opts) =>
    run(() =>
      createIssue({
        subject: opts.subject,
        content: opts.content,
        project: opts.project,
        status: opts.status,
      })
    )
  );

program.parseAsync();
