export function normalizeModelOutput(value) {
  let output = String(value || "").trim();
  output = unwrapCodeFence(output);

  const jsonContent = extractJsonContent(output);
  if (jsonContent) {
    output = jsonContent.trim();
  }

  if (!output.includes("\n") && output.includes("\\n")) {
    output = output.replaceAll("\\n", "\n");
  }

  return output.trim();
}

export function parseMarkdownBlocks(value) {
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```(?:\w+)?\s*$/);
    if (fence) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      blocks.push({ type: "code", text: codeLines.join("\n") });
      continue;
    }

    const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-+*•]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const orderedList = Boolean(ordered);
      const items = [];
      while (index < lines.length) {
        const item = orderedList
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-+*•]\s+(.+)$/);
        if (!item) {
          break;
        }
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "list", ordered: orderedList, items });
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      const quoteLines = [];
      while (index < lines.length) {
        const quotedLine = lines[index].match(/^\s*>\s?(.*)$/);
        if (!quotedLine) {
          break;
        }
        quoteLines.push(quotedLine[1]);
        index += 1;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ") });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

export function renderMarkdown(container, value) {
  const documentRef = container.ownerDocument;
  const fragment = documentRef.createDocumentFragment();

  for (const block of parseMarkdownBlocks(value)) {
    if (block.type === "rule") {
      fragment.append(documentRef.createElement("hr"));
      continue;
    }

    if (block.type === "code") {
      const pre = documentRef.createElement("pre");
      const code = documentRef.createElement("code");
      code.textContent = block.text;
      pre.append(code);
      fragment.append(pre);
      continue;
    }

    if (block.type === "list") {
      const list = documentRef.createElement(block.ordered ? "ol" : "ul");
      for (const item of block.items) {
        const listItem = documentRef.createElement("li");
        appendInlineContent(listItem, item, documentRef);
        list.append(listItem);
      }
      fragment.append(list);
      continue;
    }

    const tagName = block.type === "heading"
      ? `h${Math.min(6, block.level + 1)}`
      : block.type === "quote" ? "blockquote" : "p";
    const element = documentRef.createElement(tagName);
    appendInlineContent(element, block.text, documentRef);
    fragment.append(element);
  }

  container.replaceChildren(fragment);
}

function appendInlineContent(parent, value, documentRef) {
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let cursor = 0;

  for (const match of String(value || "").matchAll(pattern)) {
    if (match.index > cursor) {
      parent.append(documentRef.createTextNode(value.slice(cursor, match.index)));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      const code = documentRef.createElement("code");
      code.textContent = token.slice(1, -1);
      parent.append(code);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      const strong = documentRef.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      const link = documentRef.createElement("a");
      link.textContent = linkMatch[1];
      link.href = linkMatch[2];
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      parent.append(link);
    }

    cursor = match.index + token.length;
  }

  if (cursor < value.length) {
    parent.append(documentRef.createTextNode(value.slice(cursor)));
  }
}

function isBlockStart(line) {
  return /^\s*(?:#{1,6}\s+|```|[-+*•]\s+|\d+[.)]\s+|>\s?|---+\s*$|___+\s*$)/.test(line);
}

function unwrapCodeFence(value) {
  const match = value.match(/^```(?:json|markdown|md|text)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : value;
}

function extractJsonContent(value) {
  if (!value.startsWith("{") || !value.endsWith("}")) {
    return "";
  }

  try {
    const parsed = JSON.parse(value);
    const content = parsed.content || parsed.text || parsed.body || parsed["本文"];
    return typeof content === "string" ? content : "";
  } catch {
    return "";
  }
}
