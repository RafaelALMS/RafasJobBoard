import { extractText, getDocumentProxy } from 'unpdf'

/**
 * Extracts the text layer of a PDF. Scanned/image-only PDFs return ~nothing
 * and the caller surfaces a friendly error.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const doc = pdf as unknown as {
    destroy?: () => Promise<void> | void
    cleanup?: () => Promise<void> | void
  }
  try {
    const result = await extractText(pdf, { mergePages: false })
    const pages = Array.isArray(result.text) ? result.text : [result.text]
    return pages
      .map((p) => String(p ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim())
      .filter(Boolean)
      .join('\n\n')
      .trim()
  } finally {
    await doc.cleanup?.()
    await doc.destroy?.()
  }
}
