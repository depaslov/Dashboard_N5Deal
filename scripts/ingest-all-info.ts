import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const SOURCE_ROOT = '/Users/andriykrechkivsky/Documents/All information'
const VAULT_ROOT = '/Users/andriykrechkivsky/Documents/MyVault'
const OUT_BASE = path.join(VAULT_ROOT, 'sources')

const TEXT_EXTS = new Set(['.docx', '.pdf', '.xlsx', '.html', '.htm', '.txt', '.md'])
const SKIP_NAMES = new Set(['.DS_Store'])
const SKIP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.zip', '.mp4', '.mov', '.mp3'])

interface Extracted {
  text: string
  warnings: string[]
}

function slug(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'untitled'
}

async function extractDocx(buf: Buffer): Promise<Extracted> {
  const r = await mammoth.extractRawText({ buffer: buf })
  return { text: r.value, warnings: r.messages.map((m) => m.message) }
}

async function extractPdf(buf: Buffer): Promise<Extracted> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buf) })
  try {
    const r = await parser.getText()
    return { text: r.text ?? '', warnings: [] }
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

function extractXlsx(buf: Buffer): Extracted {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const parts: string[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false })
    if (csv.trim()) parts.push(`## Sheet: ${sheetName}\n\n${csv.trim()}`)
  }
  return { text: parts.join('\n\n---\n\n'), warnings: [] }
}

function extractHtml(buf: Buffer): Extracted {
  const html = buf.toString('utf-8')
  // Strip script/style blocks completely
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  // Convert headings to markdown-ish
  const stripped = cleaned
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, body) => `\n${'#'.repeat(Number(lvl))} ${body.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<\/?(p|div|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { text: stripped, warnings: [] }
}

async function extract(filePath: string): Promise<Extracted | null> {
  const ext = path.extname(filePath).toLowerCase()
  if (!TEXT_EXTS.has(ext)) return null
  const buf = await fs.readFile(filePath)
  switch (ext) {
    case '.docx': return extractDocx(buf)
    case '.pdf':  return extractPdf(buf)
    case '.xlsx': return extractXlsx(buf)
    case '.html':
    case '.htm':  return extractHtml(buf)
    case '.txt':
    case '.md':   return { text: buf.toString('utf-8'), warnings: [] }
  }
  return null
}

interface Stat {
  ingested: number
  skipped: number
  failed: number
  bytesOut: number
}

async function walk(srcDir: string, relParent: string, stats: Stat) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true })
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const srcPath = path.join(srcDir, e.name)
    if (e.isDirectory()) {
      await walk(srcPath, path.join(relParent, slug(e.name)), stats)
      continue
    }
    if (!e.isFile() || SKIP_NAMES.has(e.name)) continue
    const ext = path.extname(e.name).toLowerCase()
    if (SKIP_EXTS.has(ext)) {
      stats.skipped++
      console.log(`  SKIP (binary): ${path.relative(SOURCE_ROOT, srcPath)}`)
      continue
    }
    if (!TEXT_EXTS.has(ext)) {
      stats.skipped++
      console.log(`  SKIP (unknown): ${path.relative(SOURCE_ROOT, srcPath)}`)
      continue
    }

    const baseName = path.basename(e.name, ext)
    const outDir = path.join(OUT_BASE, relParent)
    await fs.mkdir(outDir, { recursive: true })
    const outPath = path.join(outDir, `${slug(baseName)}.md`)

    try {
      const result = await extract(srcPath)
      if (!result) { stats.skipped++; continue }
      const text = result.text.trim()
      if (!text) {
        stats.skipped++
        console.log(`  SKIP (empty): ${path.relative(SOURCE_ROOT, srcPath)}`)
        continue
      }
      const fm = {
        title: baseName,
        type: 'source',
        source: 'all-information-folder',
        originalPath: srcPath,
        originalExt: ext,
        addedAt: new Date().toISOString(),
        category: relParent || 'root',
        ...(result.warnings.length ? { extractWarnings: result.warnings.slice(0, 5) } : {}),
      }
      const md = matter.stringify(`# ${baseName}\n\n${text}\n`, fm)
      await fs.writeFile(outPath, md, 'utf-8')
      stats.ingested++
      stats.bytesOut += Buffer.byteLength(md)
      console.log(`  OK ${(text.length).toString().padStart(7)} chars → ${path.relative(VAULT_ROOT, outPath)}`)
    } catch (err: any) {
      stats.failed++
      console.error(`  FAIL ${srcPath}: ${err?.message ?? err}`)
    }
  }
}

async function main() {
  const stats: Stat = { ingested: 0, skipped: 0, failed: 0, bytesOut: 0 }
  console.log(`Source: ${SOURCE_ROOT}`)
  console.log(`Out:    ${OUT_BASE}\n`)
  await fs.mkdir(OUT_BASE, { recursive: true })
  await walk(SOURCE_ROOT, '', stats)
  console.log('\n' + '='.repeat(60))
  console.log(`Ingested: ${stats.ingested}`)
  console.log(`Skipped:  ${stats.skipped}`)
  console.log(`Failed:   ${stats.failed}`)
  console.log(`Output:   ${(stats.bytesOut / 1024).toFixed(1)} KB`)
}

main().catch((e) => { console.error(e); process.exit(1) })
