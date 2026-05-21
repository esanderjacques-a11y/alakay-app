export function formatMessage(
  template: string,
  vars: Record<string, string | number>
) {
  return Object.entries(vars).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, String(value)),
    template
  );
}
