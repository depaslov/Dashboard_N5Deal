import fs from 'fs/promises'
import mammoth from 'mammoth'

async function main() {
  const buf = await fs.readFile('/Users/andriykrechkivsky/Downloads/Marketing_Dashboard_TT.docx')
  const r = await mammoth.extractRawText({ buffer: buf })
  console.log(r.value)
}
main().catch((e) => { console.error(e); process.exit(1) })
