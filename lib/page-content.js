export const MAX_SOURCE_CHARACTERS = 100000;

export function normalizeExtractedText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function limitExtractedText(value, maximum = MAX_SOURCE_CHARACTERS) {
  const text = normalizeExtractedText(value);
  if (text.length <= maximum) {
    return { content: text, truncated: false, originalLength: text.length };
  }

  const boundary = text.lastIndexOf("\n", maximum);
  const end = boundary >= Math.floor(maximum * 0.8) ? boundary : maximum;
  return {
    content: `${text.slice(0, end).trim()}\n\n[Content truncated by the extension]`,
    truncated: true,
    originalLength: text.length
  };
}
