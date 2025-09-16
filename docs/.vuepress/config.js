import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DOCS_ROOT = path.resolve(__dirname, '..')

// ---------- 基础工具 ----------
function fileNameToTitle (fileName) {
  const base = fileName.replace(/\.md$/i, '')
  const noIndex = base.replace(/^README$/i, '索引')
  const noPrefix = noIndex.replace(/^\d+[-_]?/, '')
  return noPrefix
    .replace(/[-_]/g, ' ')
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
}

function readTitleFromMd (absPath) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8')
    const fm = raw.match(/^---[\s\S]*?^---/m)
    if (fm) {
      const m = fm[0].match(/^\s*title:\s*(.+)\s*$/mi)
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
    }
    const h1 = raw.match(/^\s*#\s+(.+)$/m)
    if (h1) return h1[1].trim()
  } catch {}
  return null
}

function listPages (relDir, { includeReadme = false } = {}) {
  const absDir = path.resolve(DOCS_ROOT, relDir)
  if (!fs.existsSync(absDir)) return []

  const files = fs
    .readdirSync(absDir)
    .filter(f => f.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

  const items = []
  for (const f of files) {
    const isReadme = /^readme\.md$/i.test(f)
    if (!includeReadme && isReadme) continue

    const title = readTitleFromMd(path.resolve(absDir, f)) || fileNameToTitle(f)
    const link = isReadme
      ? '/' + path.posix.join(relDir.replace(/\/README\.md$/i, ''), '/')
      : '/' + path.posix.join(relDir, f.replace(/\.md$/i, '.html'))
    items.push({ text: title, link })
  }
  return items
}

function listMdInSubdir (relDir) {
  const absDir = path.resolve(DOCS_ROOT, relDir)
  if (!fs.existsSync(absDir)) return []

  const dirs = fs.readdirSync(absDir).filter(d => {
    const p = path.join(absDir, d)
    return fs.statSync(p).isDirectory()
  })

  const groups = []
  for (const sub of dirs) {
    const subRel = path.posix.join(relDir, sub)
    const subAbs = path.resolve(DOCS_ROOT, subRel)
    const mdFiles = fs.readdirSync(subAbs)
      .filter(f => f.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

    const children = mdFiles.map(f => {
      const abs = path.join(subAbs, f)
      const title = readTitleFromMd(abs) || fileNameToTitle(f)
      const isReadme = /^readme\.md$/i.test(f)
      const link = isReadme
        ? '/' + path.posix.join(subRel, '/')
        : '/' + path.posix.join(subRel, f.replace(/\.md$/i, '.html'))
      return { text: title, link }
    })

    if (children.length > 0) {
      groups.push({
        text: fileNameToTitle(sub),
        collapsible: true,
        collapsed: true,
        children
      })
    }
  }
  return groups
}

// ---------- 模块侧边栏 ----------
function makeModuleSidebar (modulePath, humanName) {
  const base = `guide/${modulePath}`
  const result = []

  const indexItems = listPages(base, { includeReadme: true })
  if (indexItems.length) {
    result.push({
      text: `${humanName} · 索引`,
      collapsible: true,
      collapsed: false,
      children: indexItems,
    })
  }

  const expBase = `${base}/explanations`
  if (fs.existsSync(path.resolve(DOCS_ROOT, expBase))) {
    const expTop = listPages(expBase, { includeReadme: false }) 
    const expSub = listMdInSubdir(expBase)
    const expChildren = [...expTop]

    if (expSub.length > 0) expChildren.push(...expSub)

    if (expChildren.length > 0) {
      result.push({
        text: '原理解读',
        collapsible: true,
        collapsed: true,
        children: expChildren,
      })
    }
  }

  const howtoBase = `${base}/how-to`
  if (fs.existsSync(path.resolve(DOCS_ROOT, howtoBase))) {
    const howTop = listPages(howtoBase, { includeReadme: false })
    const howSub = listMdInSubdir(howtoBase)
    const howChildren = [...howTop]
    if (howSub.length > 0) howChildren.push(...howSub)

    if (howChildren.length > 0) {
      result.push({
        text: '操作指南',
        collapsible: true,
        collapsed: true,
        children: howChildren,
      })
    }
  }

  return result
}

function scanModules () {
  const guideDir = path.resolve(DOCS_ROOT, 'guide')
  const modules = []
  if (!fs.existsSync(guideDir)) return modules

  for (const item of fs.readdirSync(guideDir)) {
    const absPath = path.join(guideDir, item)
    if (fs.statSync(absPath).isDirectory()) {
      modules.push([item, fileNameToTitle(item)])

      for (const sub of fs.readdirSync(absPath)) {
        const subPath = path.join(absPath, sub)
        if (fs.statSync(subPath).isDirectory() &&
            !['explanations', 'how-to', 'troubleshooting'].includes(sub.toLowerCase())) {
          modules.push([`${item}/${sub}`, `${fileNameToTitle(item)} · ${fileNameToTitle(sub)}`])
        }
      }
    }
  }
  return modules
}

function makeReferenceSidebar () {
  const items = [{ text: '总览', link: '/reference/' }].concat(listPages('reference'))
  return [
    {
      text: '参考与 API',
      collapsible: true,
      collapsed: false,
      children: items,
    },
  ]
}

function makeGuideHomeSidebar (modules) {
  const moduleLinks = modules
    .filter(([k]) => !k.includes('/'))
    .map(([k, name]) => ({ text: name, link: `/guide/${k}/` }))
  return [
    {
      text: '开始',
      collapsible: true,
      collapsed: false,
      children: [
        { text: '简介', link: '/guide/' },
        { text: '工程搭建', link: '/guide/setup/' },
      ],
    },
    {
      text: '功能模块(教程)',
      collapsible: true,
      collapsed: false,
      children: moduleLinks,
    },
  ]
}

function buildSidebarMapping (modules) {
  const map = {
    '/guide/': makeGuideHomeSidebar(modules),
    '/reference/': makeReferenceSidebar(),
  }
  for (const [key, name] of modules) {
    map[`/guide/${key}/`] = makeModuleSidebar(key, name)
  }
  return map
}

// ---------- 导出 ----------
const MODULES = scanModules()

export default defineUserConfig({
  lang: 'zh-CN',
  title: 'HoloLens2Medical Technical Documentation',
  description: 'DICOM + MRTK3 in Unity — 医学影像可视化与交互方案',
  bundler: viteBundler(),

  head: [['meta', { name: 'theme-color', content: '#3eaf7c' }]],

  theme: defaultTheme({
    navbar: [
      { text: '指南', link: '/guide/' },
      { text: '参考', link: '/reference/' },
      { text: 'HoloLens2Medical', link: 'https://github.com/Fantastic2020/HoloLens2Medical' },
    ],
    repo: '101AoiKoori/HoloLens2Medical-Technical-Documentation_VuePress',
    docsDir: 'docs',
    editLink: true,
    lastUpdated: false,
    editLinkText: '在 GitHub 上编辑此页',
    contributors: false,
    sidebar: buildSidebarMapping(MODULES),
  }),
})
