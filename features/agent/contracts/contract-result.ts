export type AgentContractParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AgentContractParseError };

export type AgentContractParseErrorCode =
  | "DUPLICATE_OPERATION"
  | "INVALID_FIELD"
  | "INVALID_SCHEMA_VERSION"
  | "MISSING_REQUIRED_FIELD"
  | "UNSUPPORTED_RESULT_TYPE";

export type AgentContractParseError = {
  code: AgentContractParseErrorCode;
  message: string;
  path?: string;
};

export function createAgentContractParseError(
  code: AgentContractParseErrorCode,
  message: string,
  path?: string,
): AgentContractParseResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      path,
    },
  };
}
