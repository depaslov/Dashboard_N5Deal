import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { prisma } from '@/lib/db'
import { safeResolveVaultPath } from './safe-path'

function safeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'untitled'
}

async function writeNote(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf-8')
}

// Build a properly-escaped Markdown note with YAML front matter.
function buildNote(title: string, frontMatter: Record<string, any>, body: string) {
  return matter.stringify(`# ${title}\n\n${body.trim()}\n`, { title, ...frontMatter })
}

export async function exportProjectToObsidianVault(projectId: string, vaultPath: string) {
  const resolvedRoot = safeResolveVaultPath(vaultPath)

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      icps: true,
      contents: true,
      redFlagWords: true,
      internalLinks: true,
    },
  })

  if (!project) {
    throw new Error('Project not found')
  }

  const baseDir = path.join(resolvedRoot, 'n5deal-project')

  const createdFiles: string[] = []

  const projectNote = buildNote(
    project.name,
    {
      type: 'project',
      companyName: project.companyName,
      description: project.description ?? '',
      projectId: project.id,
    },
    project.description ?? 'No description.',
  )
  const projectFile = path.join(baseDir, 'Project.md')
  await writeNote(projectFile, projectNote)
  createdFiles.push(projectFile)

  for (const icp of project.icps) {
    const filePath = path.join(baseDir, 'ICPs', `${safeFileName(icp.name)}.md`)
    const note = buildNote(
      icp.name,
      {
        type: 'icp',
        industry: icp.industry,
        companySize: icp.companySize,
        budgetRange: icp.budgetRange,
      },
      `## ICP profile\n\n- Name: ${icp.name}\n- Industry: ${icp.industry}\n- Company size: ${icp.companySize}\n- Demographics: ${icp.demographics}\n- Budget range: ${icp.budgetRange}\n- Decision process: ${icp.decisionProcess}\n\n### Pain points\n${icp.painPoints.map((item) => `- ${item}`).join('\n')}\n\n### Goals\n${icp.goals.map((item) => `- ${item}`).join('\n')}`,
    )
    await writeNote(filePath, note)
    createdFiles.push(filePath)
  }

  for (const content of project.contents) {
    const filePath = path.join(baseDir, 'Generated Content', `${safeFileName(content.topic)}.md`)
    const briefData = content.briefData ? JSON.stringify(content.briefData, null, 2) : 'No structured brief available.'
    const note = buildNote(
      content.topic,
      {
        type: 'generated_content',
        contentType: content.contentType,
        targetAudience: content.targetAudience,
        tone: content.tone,
      },
      `## Content brief\n\n- Topic: ${content.topic}\n- Type: ${content.contentType}\n- Audience: ${content.targetAudience}\n- Tone: ${content.tone}\n\n### Generated brief\n${content.generatedBrief}\n\n### Brief metadata\n\n\`\`\`json\n${briefData}\n\`\`\``,
    )
    await writeNote(filePath, note)
    createdFiles.push(filePath)
  }

  for (const flag of project.redFlagWords) {
    const filePath = path.join(baseDir, 'Red Flags', `${safeFileName(flag.word)}.md`)
    const note = buildNote(
      flag.word,
      {
        type: 'red_flag',
        category: flag.category,
        severity: flag.severity,
        language: flag.language,
      },
      `## Red flag\n\n- Word: ${flag.word}\n- Category: ${flag.category}\n- Severity: ${flag.severity}\n- Language: ${flag.language}\n- Reason: ${flag.reason ?? 'N/A'}`,
    )
    await writeNote(filePath, note)
    createdFiles.push(filePath)
  }

  for (const link of project.internalLinks) {
    const filePath = path.join(baseDir, 'Internal Links', `${safeFileName(link.anchor)}.md`)
    const note = buildNote(
      link.anchor,
      {
        type: 'internal_link',
        url: link.url,
        category: link.category ?? '',
        priority: link.priority,
      },
      `## Internal link\n\n- URL: ${link.url}\n- Anchor: ${link.anchor}\n- Category: ${link.category ?? 'N/A'}\n- Priority: ${link.priority}\n- Context: ${link.context ?? 'N/A'}`,
    )
    await writeNote(filePath, note)
    createdFiles.push(filePath)
  }

  return { createdFiles }
}
