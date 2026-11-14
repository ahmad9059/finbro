/**
 * A readable message for a failed mutation. tRPC serialises Zod issues as a
 * JSON array in `message`; showing that raw is unhelpful, so it is unwrapped.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong.") {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (message.startsWith("[")) {
    try {
      const issues = JSON.parse(message) as {
        message?: string;
        path?: (string | number)[];
      }[];
      const parts = issues
        .map((issue) => {
          const field = issue.path?.[0];
          return issue.message
            ? field
              ? `${String(field)}: ${issue.message}`
              : issue.message
            : null;
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join(" ");
    } catch {
      // not JSON after all
    }
  }
  return message || fallback;
}
