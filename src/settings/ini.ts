// Minimal INI helpers for the game's config.ini. Edits keep every other line
// (unknown keys, sections the web build does not use) and the file's line endings.

const sectionRe = /^\s*\[([^\]]*)\]\s*$/;
const keyRe = /^\s*([^=;\s][^=]*?)\s*=\s*(.*?)\s*$/;

function eol(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

export function getIni(text: string, section: string, key: string): string | undefined {
  let current = "";
  for (const line of text.split(/\r?\n/)) {
    const s = sectionRe.exec(line);
    if (s) {
      current = s[1];
      continue;
    }
    const k = keyRe.exec(line);
    if (k && current === section && k[1] === key) return k[2];
  }
  return undefined;
}

export function setIni(text: string, section: string, key: string, value: string): string {
  const nl = eol(text);
  const lines = text.split(/\r?\n/);
  let current = "";
  let sectionEnd = -1; // index after the last line of the wanted section
  for (let i = 0; i < lines.length; i++) {
    const s = sectionRe.exec(lines[i]);
    if (s) {
      current = s[1];
      if (current === section) sectionEnd = i + 1;
      continue;
    }
    if (current !== section) continue;
    const k = keyRe.exec(lines[i]);
    if (k && k[1] === key) {
      lines[i] = `${key} = ${value}`;
      return lines.join(nl);
    }
    if (lines[i].trim() !== "") sectionEnd = i + 1;
  }
  if (sectionEnd >= 0) {
    lines.splice(sectionEnd, 0, `${key} = ${value}`);
  } else {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
    lines.push("", `[${section}]`, `${key} = ${value}`, "");
  }
  return lines.join(nl);
}
