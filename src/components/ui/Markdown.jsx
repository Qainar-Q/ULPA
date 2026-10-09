// Small, safe Markdown renderer (no HTML is ever injected): headings (#, ##, ###),
// paragraphs, - / * / 1. lists, > quotes, ``` code blocks, `code`, **bold**, *italic*,
// and plain http(s) links. Enough for class notes and translations.

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"»])/g;

function inline(text, keyBase) {
  const out = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${index++}`;
    if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith("*")) out.push(<em key={key}>{token.slice(1, -1)}</em>);
    else
      out.push(
        <a key={key} href={token} target="_blank" rel="noreferrer noopener">
          {token}
        </a>
      );
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function parse(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i++]);
      i += 1;
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: `h${heading[1].length}`, text: heading[2] });
      i += 1;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i += 1;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push({ type: "quote", text: quote.join("\n") });
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>\s?|\s*([-*•]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ type: "p", text: para.join("\n") });
  }
  return blocks;
}

function withBreaks(text, key) {
  return text.split("\n").flatMap((part, index) => (index === 0 ? inline(part, `${key}-${index}`) : [<br key={`${key}-br${index}`} />, ...inline(part, `${key}-${index}`)]));
}

export default function Markdown({ text, className = "" }) {
  const blocks = parse(text);
  return (
    <div className={`md ${className}`.trim()}>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.type) {
          case "h1":
            return <h2 key={key}>{inline(block.text, key)}</h2>;
          case "h2":
            return <h3 key={key}>{inline(block.text, key)}</h3>;
          case "h3":
            return <h4 key={key}>{inline(block.text, key)}</h4>;
          case "ul":
            return (
              <ul key={key}>
                {block.items.map((item, n) => (
                  <li key={n}>{inline(item, `${key}-${n}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key}>
                {block.items.map((item, n) => (
                  <li key={n}>{inline(item, `${key}-${n}`)}</li>
                ))}
              </ol>
            );
          case "quote":
            return <blockquote key={key}>{withBreaks(block.text, key)}</blockquote>;
          case "code":
            return (
              <pre key={key}>
                <code>{block.text}</code>
              </pre>
            );
          default:
            return <p key={key}>{withBreaks(block.text, key)}</p>;
        }
      })}
    </div>
  );
}

/** Plain-text preview of Markdown (for list cards). */
export function markdownPreview(text, max = 160) {
  const plain = String(text ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*([-*•]|\d+[.)])\s+/gm, "• ")
    .replace(/[*`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
}

/** One line of text with `code`, **bold** and *italic* (for quiz options and the like). */
export function InlineMarkdown({ text }) {
  return <>{inline(String(text ?? ""), "inl")}</>;
}
