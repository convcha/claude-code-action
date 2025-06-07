#!/usr/bin/env bun

import * as core from "@actions/core";
import {
  isIssuesEvent,
  isIssueCommentEvent,
  isPullRequestEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
  isWorkflowDispatchEvent,
  isRepositoryDispatchEvent,
} from "../context";
import type { ParsedGitHubContext } from "../context";

export function checkContainsTrigger(context: ParsedGitHubContext): boolean {
  const {
    inputs: { assigneeTrigger, triggerPhrase, labelTriggers, directPrompt },
  } = context;

  // If direct prompt is provided, always trigger
  if (directPrompt) {
    console.log(`Direct prompt provided, triggering action`);
    return true;
  }

  // Handle workflow_dispatch events
  if (isWorkflowDispatchEvent(context)) {
    // Check for PR number in inputs/environment
    const prNumber =
      context.payload.inputs?.pr_number ||
      core.getInput("pr_number") ||
      process.env.PR_NUMBER;

    if (prNumber) {
      console.log(`Workflow dispatch triggered for PR #${prNumber}`);
      return true;
    }

    // Check for direct prompt
    const workflowPrompt =
      context.payload.inputs?.prompt ||
      core.getInput("prompt") ||
      process.env.PROMPT;

    if (workflowPrompt) {
      console.log(`Workflow dispatch with direct prompt`);
      return true;
    }

    console.log(
      `Workflow dispatch triggered but no PR number or prompt provided`,
    );
    return false;
  }

  // Handle repository_dispatch events
  if (isRepositoryDispatchEvent(context)) {
    // Check for PR number or issue number in client_payload
    const prNumber = context.payload.client_payload?.pr_number;
    const issueNumber = context.payload.client_payload?.issue_number;

    if (prNumber) {
      console.log(`Repository dispatch triggered for PR #${prNumber}`);
      return true;
    }

    if (issueNumber) {
      console.log(`Repository dispatch triggered for issue #${issueNumber}`);
      return true;
    }

    // Check for direct prompt in client_payload
    const repositoryPrompt = context.payload.client_payload?.prompt;

    if (repositoryPrompt) {
      console.log(`Repository dispatch with direct prompt`);
      return true;
    }

    console.log(
      `Repository dispatch triggered but no PR number, issue number or prompt provided`,
    );
    return false;
  }

  // Check for assignee trigger
  if (isIssuesEvent(context) && context.eventAction === "assigned") {
    // Remove @ symbol from assignee_trigger if present
    let triggerUser = assigneeTrigger.replace(/^@/, "");
    const assigneeUsername = context.payload.issue.assignee?.login || "";

    if (triggerUser && assigneeUsername === triggerUser) {
      console.log(`Issue assigned to trigger user '${triggerUser}'`);
      return true;
    }
  }

  // Check for label trigger
  if (isIssuesEvent(context) && context.eventAction === "labeled") {
    const payload = context.payload as any;
    const labelName = payload.label?.name || "";

    if (labelTriggers.length > 0 && labelName) {
      if (labelTriggers.includes(labelName)) {
        console.log(
          `Issue labeled with trigger label '${labelName}' (from trigger list: [${labelTriggers.join(", ")}])`,
        );
        return true;
      }
    }
  }

  // Check for issue body and title trigger on issue creation
  if (isIssuesEvent(context) && context.eventAction === "opened") {
    const issueBody = context.payload.issue.body || "";
    const issueTitle = context.payload.issue.title || "";
    // Check for exact match with word boundaries or punctuation
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );

    // Check in body
    if (regex.test(issueBody)) {
      console.log(
        `Issue body contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }

    // Check in title
    if (regex.test(issueTitle)) {
      console.log(
        `Issue title contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }
  }

  // Check for pull request body and title trigger
  if (isPullRequestEvent(context)) {
    const prBody = context.payload.pull_request.body || "";
    const prTitle = context.payload.pull_request.title || "";
    // Check for exact match with word boundaries or punctuation
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );

    // Check in body
    if (regex.test(prBody)) {
      console.log(
        `Pull request body contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }

    // Check in title
    if (regex.test(prTitle)) {
      console.log(
        `Pull request title contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }
  }

  // Check for pull request review body trigger
  if (
    isPullRequestReviewEvent(context) &&
    (context.eventAction === "submitted" || context.eventAction === "edited")
  ) {
    const reviewBody = context.payload.review.body || "";
    // Check for exact match with word boundaries or punctuation
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(reviewBody)) {
      console.log(
        `Pull request review contains exact trigger phrase '${triggerPhrase}'`,
      );
      return true;
    }
  }

  // Check for comment trigger
  if (
    isIssueCommentEvent(context) ||
    isPullRequestReviewCommentEvent(context)
  ) {
    const commentBody = isIssueCommentEvent(context)
      ? context.payload.comment.body
      : context.payload.comment.body;
    // Check for exact match with word boundaries or punctuation
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(commentBody)) {
      console.log(`Comment contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
  }

  console.log(`No trigger was met for ${triggerPhrase}`);

  return false;
}

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function checkTriggerAction(context: ParsedGitHubContext) {
  const containsTrigger = checkContainsTrigger(context);
  core.setOutput("contains_trigger", containsTrigger.toString());
  return containsTrigger;
}
