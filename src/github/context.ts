import * as github from "@actions/github";
import type {
  IssuesEvent,
  IssueCommentEvent,
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewCommentEvent,
  WorkflowDispatchEvent,
  RepositoryDispatchEvent,
} from "@octokit/webhooks-types";

export type ParsedGitHubContext = {
  runId: string;
  eventName: string;
  eventAction?: string;
  repository: {
    owner: string;
    repo: string;
    full_name: string;
  };
  actor: string;
  payload:
    | IssuesEvent
    | IssueCommentEvent
    | PullRequestEvent
    | PullRequestReviewEvent
    | PullRequestReviewCommentEvent
    | WorkflowDispatchEvent
    | RepositoryDispatchEvent;
  entityNumber: number;
  isPR: boolean;
  inputs: {
    triggerPhrase: string;
    assigneeTrigger: string;
    labelTriggers: string[];
    allowedTools: string[];
    disallowedTools: string[];
    customInstructions: string;
    directPrompt: string;
    baseBranch?: string;
  };
};

export function parseGitHubContext(): ParsedGitHubContext {
  const context = github.context;

  const commonFields = {
    runId: process.env.GITHUB_RUN_ID!,
    eventName: context.eventName,
    eventAction: context.payload.action,
    repository: {
      owner: context.repo.owner,
      repo: context.repo.repo,
      full_name: `${context.repo.owner}/${context.repo.repo}`,
    },
    actor: context.actor,
    inputs: {
      triggerPhrase: process.env.TRIGGER_PHRASE ?? "@claude",
      assigneeTrigger: process.env.ASSIGNEE_TRIGGER ?? "",
      labelTriggers: (() => {
        const labelTriggerInput = process.env.LABEL_TRIGGER ?? "";
        if (!labelTriggerInput) return [];
        
        // If input contains newlines, treat as multi-line array
        if (labelTriggerInput.includes('\n')) {
          return labelTriggerInput
            .split('\n')
            .map((label) => label.trim())
            .filter((label) => label.length > 0);
        }
        
        // Otherwise treat as comma-separated string
        return labelTriggerInput
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0);
      })(),
      allowedTools: (process.env.ALLOWED_TOOLS ?? "")
        .split(",")
        .map((tool) => tool.trim())
        .filter((tool) => tool.length > 0),
      disallowedTools: (process.env.DISALLOWED_TOOLS ?? "")
        .split(",")
        .map((tool) => tool.trim())
        .filter((tool) => tool.length > 0),
      customInstructions: process.env.CUSTOM_INSTRUCTIONS ?? "",
      directPrompt: process.env.DIRECT_PROMPT ?? "",
      baseBranch: process.env.BASE_BRANCH,
    },
  };

  switch (context.eventName) {
    case "issues": {
      return {
        ...commonFields,
        payload: context.payload as IssuesEvent,
        entityNumber: (context.payload as IssuesEvent).issue.number,
        isPR: false,
      };
    }
    case "issue_comment": {
      return {
        ...commonFields,
        payload: context.payload as IssueCommentEvent,
        entityNumber: (context.payload as IssueCommentEvent).issue.number,
        isPR: Boolean(
          (context.payload as IssueCommentEvent).issue.pull_request,
        ),
      };
    }
    case "pull_request": {
      return {
        ...commonFields,
        payload: context.payload as PullRequestEvent,
        entityNumber: (context.payload as PullRequestEvent).pull_request.number,
        isPR: true,
      };
    }
    case "pull_request_review": {
      return {
        ...commonFields,
        payload: context.payload as PullRequestReviewEvent,
        entityNumber: (context.payload as PullRequestReviewEvent).pull_request
          .number,
        isPR: true,
      };
    }
    case "pull_request_review_comment": {
      return {
        ...commonFields,
        payload: context.payload as PullRequestReviewCommentEvent,
        entityNumber: (context.payload as PullRequestReviewCommentEvent)
          .pull_request.number,
        isPR: true,
      };
    }
    case "repository_dispatch": {
      const payload = context.payload as RepositoryDispatchEvent;
      // For repository_dispatch, check for PR number in client_payload
      const prNumber = payload.client_payload?.pr_number;
      const isPR = payload.client_payload?.is_pr === true || Boolean(prNumber);
      
      return {
        ...commonFields,
        payload: payload,
        entityNumber: prNumber ? parseInt(prNumber.toString(), 10) : 0,
        isPR: isPR,
      };
    }
    case "workflow_dispatch": {
      const payload = context.payload as WorkflowDispatchEvent;
      // For workflow_dispatch, check for PR number in inputs
      const prNumber = payload.inputs?.pr_number;
      const isPR = payload.inputs?.is_pr === "true" || Boolean(prNumber);
      
      return {
        ...commonFields,
        payload: payload,
        entityNumber: prNumber ? parseInt(prNumber.toString(), 10) : 0,
        isPR: isPR,
      };
    }
    default:
      throw new Error(`Unsupported event type: ${context.eventName}`);
  }
}

export function isIssuesEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: IssuesEvent } {
  return context.eventName === "issues";
}

export function isIssueCommentEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: IssueCommentEvent } {
  return context.eventName === "issue_comment";
}

export function isPullRequestEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: PullRequestEvent } {
  return context.eventName === "pull_request";
}

export function isPullRequestReviewEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: PullRequestReviewEvent } {
  return context.eventName === "pull_request_review";
}

export function isPullRequestReviewCommentEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & { payload: PullRequestReviewCommentEvent } {
  return context.eventName === "pull_request_review_comment";
}

export function isWorkflowDispatchEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & {
  eventName: "workflow_dispatch";
  payload: WorkflowDispatchEvent;
} {
  return context.eventName === "workflow_dispatch";
}

export function isRepositoryDispatchEvent(
  context: ParsedGitHubContext,
): context is ParsedGitHubContext & {
  eventName: "repository_dispatch";
  payload: RepositoryDispatchEvent;
} {
  return context.eventName === "repository_dispatch";
}
