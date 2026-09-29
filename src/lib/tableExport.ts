/** Downloads rows as a CSV file that opens cleanly in Excel. */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null)[][],
) {
  const escape = (cell: string | number | null) => {
    const text = cell === null ? '' : String(cell)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const body = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  // The byte-order mark makes Excel read UTF-8 (names with accents) correctly.
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
