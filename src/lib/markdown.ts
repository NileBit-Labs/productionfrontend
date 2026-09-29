// The assistant writes short paragraphs, "- " bullets and **bold**. Everything is escaped first,
// so the result is safe to show with v-html no matter what the text contains.

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const inline = (s: string) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

export function renderAnswer(text: string): string {
  let html = ''
  let list: 'ul' | 'ol' | null = null
  let paragraph: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) html += `<p>${inline(paragraph.join(' '))}</p>`
    paragraph = []
  }
  const closeList = () => {
    if (list) html += `</${list}>`
    list = null
  }

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) {
      flushParagraph()
      closeList()
      continue
    }

    const bullet = /^[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line)

    if (bullet || numbered) {
      flushParagraph()
      const kind = bullet ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        html += `<${kind}>`
        list = kind
      }
      html += `<li>${inline((bullet ?? numbered)![1]!)}</li>`
      continue
    }

    closeList()
    paragraph.push(line)
  }

  flushParagraph()
  closeList()
  return html
}
