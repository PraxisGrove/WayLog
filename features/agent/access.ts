export type AgentAccessState = "loading" | "ready" | "signed_out";

export function resolveAgentAccessState(
  authUser: { session?: { accessToken?: string } } | null,
  isLoading: boolean,
): AgentAccessState {
  if (isLoading) return "loading";

  return authUser?.session?.accessToken?.trim() ? "ready" : "signed_out";
}
