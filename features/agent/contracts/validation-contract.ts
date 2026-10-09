export type AgentValidationSeverity = "error" | "warning";

export type AgentValidationIssue = {
  code: string;
  message: string;
  path?: string;
  severity: AgentValidationSeverity;
};

export type AgentValidationResult<T> =
  | {
      data: T;
      issues?: AgentValidationIssue[];
      ok: true;
    }
  | {
      issues: AgentValidationIssue[];
      ok: false;
    };
