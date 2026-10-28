const readFileSync =
  typeof process !== 'undefined' && process.versions?.node
    ? (await import('node:fs')).readFileSync
    : null;
const browserManuscripts = new Map(
  readFileSync
    ? []
    : await Promise.all(
        ['chapter-1', 'chapter-2', 'chapter-3', 'endings'].map(async (name) => {
          const url = new URL(`../../docs/manuscript/${name}.md`, import.meta.url);
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(
              `Manuscript ${url.pathname} returned HTTP ${response.status}; publish the docs/manuscript files with the game.`
            );
          return [url.href, await response.text()];
        })
      )
);

// Markdown only supplies text boundaries; each chapter owns its narrative conditions.
export function readManuscript(url) {
  const raw = readFileSync ? readFileSync(url, 'utf8') : browserManuscripts.get(url.href);
  if (typeof raw !== 'string')
    throw new Error(`Manuscript ${url.href} was not loaded; use a published game manuscript.`);
  const headings = [...raw.matchAll(/^## (.+)$/gm)];
  const scenes = new Map();
  for (const [index, match] of headings.entries()) {
    const name = match[1];
    const identity = /^([A-Z]\d+) — (.+)$/.exec(name);
    const id = identity?.[1] ?? name;
    const body = raw.slice(
      match.index + match[0].length,
      headings[index + 1]?.index ?? raw.length
    );
    const sections = new Map();
    const sectionHeadings = [...body.matchAll(/^### (.+)$/gm)];
    for (const [sectionIndex, heading] of sectionHeadings.entries()) {
      if (sections.has(heading[1]))
        throw new Error(
          `Duplicate manuscript section "${heading[1]}" in ${id}; use distinct headings.`
        );
      sections.set(
        heading[1],
        body
          .slice(
            heading.index + heading[0].length,
            sectionHeadings[sectionIndex + 1]?.index ?? body.length
          )
          .trim()
      );
    }
    if (scenes.has(id))
      throw new Error(`Duplicate manuscript scene "${id}"; assign a unique scene ID.`);
    scenes.set(id, { id, title: identity?.[2] ?? name, raw: body, sections });
  }
  return scenes;
}

// Missing authored sections are content errors, never a silent empty player scene.
export function section(source, heading) {
  if (typeof source !== 'string' && source.sections.has(heading))
    return source.sections.get(heading);
  const raw = typeof source === 'string' ? source : source.raw;
  const headings = [...raw.matchAll(/^(#{3,4}) (.+)$/gm)];
  const index = headings.findIndex((match) => match[2] === heading);
  if (index < 0)
    throw new Error(
      `Manuscript section "${heading}" is missing; restore the heading or update its content mapping.`
    );
  const match = headings[index];
  const end =
    headings.slice(index + 1).find((next) => next[1].length <= match[1].length)?.index ??
    raw.length;
  return raw.slice(match.index + match[0].length, end).trim();
}

export function messages(raw) {
  const result = [];
  for (const paragraph of raw.split(/\n\s*\n/)) {
    const match = /^\*\*([^*]+?):\*\*\s*([\s\S]+)$/.exec(paragraph.trim());
    if (!match || /^(조건|상태|다음|힌트|제작|삽입)/.test(match[1])) continue;
    result.push({ speaker: match[1], text: match[2].replace(/\n/g, ' ').trim() });
  }
  return result;
}
