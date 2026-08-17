---
name: ado-pr-creation
description: >-
  Use this skill when the user asks to create a Pull Request (PR) in Azure DevOps (ADO) for the current project or repository.
---
# Azure DevOps Pull Request Creation

This skill provides instructions for creating Pull Requests on Azure DevOps reliably across different projects.

## Recommended Approach: Azure CLI

The most reliable way to create a PR is using the `az repos pr create` command via the `run_command` tool. This approach leverages the user's existing CLI authentication and avoids potential interactive login issues with MCP servers.

### 1. Prerequisites Check

Before creating a PR, always determine the current source branch by running:

```bash
git branch --show-current
```

Make sure you know the target branch (often `develop`, `main`, or `master`, depending on the user's request).

### 2. Creating the PR

Run the following command to create the PR:

```bash
az repos pr create --source-branch <source-branch> --target-branch <target-branch> --title "<pr-title>"
```

**Common Options:**

- `--source-branch` (`-s`): The branch containing the changes (e.g., `Init`, `feature/xyz`).
- `--target-branch` (`-t`): The branch to merge into (e.g., `develop`).
- `--title`: A descriptive title for the PR.
- `--description` (`-d`): (Optional) Detailed description of the changes.
- `--work-items`: (Optional) Space-separated IDs of work items to link.
- `--auto-complete true`: (Optional) Set the PR to auto-complete once policies pass.

### 3. Verification

The `az repos pr create` command will output a JSON response upon success. Look for the `pullRequestId` and `url` in the output to confirm the PR was created successfully and provide the URL to the user.

## Troubleshooting

- **Authentication Errors**: If you encounter identity or materialization errors (e.g., `Identity ... has not been materialized`), ensure you are using the `az repos` CLI and **not** the MCP server tool (`repo_pull_request_write`).
- **Context Errors**: If the CLI cannot detect the organization or project, it usually means the current working directory is not a git repository linked to ADO. Make sure your `Cwd` in `run_command` is set to the root of the project. You can also explicitly pass `--repository <RepoName>` and `--project <ProjectName>` if needed.