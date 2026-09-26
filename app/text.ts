// Emails carry CRLF and leading blank lines, which the HTML parser normalizes inside <pre>:
// render the normalized text so server and client markup match.
export const plain = (t: string | null) => (t ?? "").replace(/\r\n?/g, "\n").trim();
