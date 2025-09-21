import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DOCS_ROOT = path.resolve(__dirname, '..')

// ---------- 基础工具（保持你的实现风格） ----------
function fileNameToTitle (fileName) {
  const base = fileName.replace(/\.md$/i, '')
  const noIndex = base.replace(/^README$/i, 'API')
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

// 递归列出任意深度的子目录（不依赖 README）→ 返回分组数组
function listMdTree (relDir) {
  const absDir = path.resolve(DOCS_ROOT, relDir)
  if (!fs.existsSync(absDir)) return []

  // 只看下一级子目录
  const subDirs = fs.readdirSync(absDir).filter(d => {
    const p = path.join(absDir, d)
    return fs.statSync(p).isDirectory()
  })

  const groups = []
  for (const sub of subDirs) {
    const subRel = path.posix.join(relDir, sub)
    const subAbs = path.resolve(DOCS_ROOT, subRel)

    // 本子目录下的 md（包含 README 也可、但不是必须）
    const pages = listPages(subRel, { includeReadme: true })

    // 更深层继续递归
    const deeper = listMdTree(subRel)

    const children = []
    if (pages.length) children.push(...pages)
    if (deeper.length) children.push(...deeper)

    if (children.length) {
      groups.push({
        text: fileNameToTitle(sub),
        collapsible: true,
        collapsed: true,
        children,
      })
    }
  }
  return groups
}

// ---------- 模块侧边栏（保留你的结构 + 递归增强） ----------
function makeModuleSidebar (modulePath, humanName) {
  const base = `guide/${modulePath}`
  const result = []

  // 索引（含 README 与根层其它 md）
  const indexItems = listPages(base, { includeReadme: true })
  if (indexItems.length) {
    result.push({
      text: `${humanName} · 索引`,
      collapsible: true,
      collapsed: false,
      children: indexItems,
    })
  }

  // 原理解读（顶层 md + 任意深度子目录）
  const expBase = `${base}/explanations`
  if (fs.existsSync(path.resolve(DOCS_ROOT, expBase))) {
    const expTop = listPages(expBase, { includeReadme: false })
    const expTree = listMdTree(expBase)
    const expChildren = []
    if (expTop.length) expChildren.push(...expTop)
    if (expTree.length) expChildren.push(...expTree)
    if (expChildren.length) {
      result.push({
        text: '原理解读',
        collapsible: true,
        collapsed: true,
        children: expChildren,
      })
    }
  }

  // 操作指南（同上）
  const howtoBase = `${base}/implementation`
  if (fs.existsSync(path.resolve(DOCS_ROOT, howtoBase))) {
    const howTop = listPages(howtoBase, { includeReadme: false })
    const howTree = listMdTree(howtoBase)
    const howChildren = []
    if (howTop.length) howChildren.push(...howTop)
    if (howTree.length) howChildren.push(...howTree)
    if (howChildren.length) {
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

// 扫描 guide 下的模块（保持你原来的写法）
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
            !['explanations', 'implementation', 'troubleshooting'].includes(sub.toLowerCase())) {
          modules.push([`${item}/${sub}`, `${fileNameToTitle(item)} · ${fileNameToTitle(sub)}`])
        }
      }
    }
  }
  return modules
}

// Reference：根层“总览” + 每个一级目录成组，并对其子目录递归
function makeReferenceSidebar () {
  const res = []

  // 根层
  const root = [{ text: '总览', link: '/reference/' }].concat(listPages('reference'))
  if (root.length) {
    res.push({
      text: '参考与API',
      collapsible: true,
      collapsed: false,
      children: root,
    })
  }

  const refRoot = path.resolve(DOCS_ROOT, 'reference')
  if (!fs.existsSync(refRoot)) return res

  const firstLevel = fs.readdirSync(refRoot).filter(d => {
    const p = path.join(refRoot, d)
    return fs.statSync(p).isDirectory()
  }).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

  for (const d of firstLevel) {
    const rel = path.posix.join('reference', d)
    const children = []
    // 该组的直接 md（含 README 可选）
    const top = listPages(rel, { includeReadme: true })
    if (top.length) children.push(...top)
    // 递归其子树
    const tree = listMdTree(rel)
    if (tree.length) children.push(...tree)

    if (children.length) {
      res.push({
        text: d, 
        collapsible: true,
        collapsed: true,
        children,
      })
    }
  }

  return res
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
        { text: '工程搭建', link: '/guide/00setup/' },
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
      { text: 'API', link: '/reference/' },
      { text: 'HoloLens2Medical', link: 'https://github.com/Fantastic2020/HoloLens2Medical' }, // TODO: 如需修改
    ],
    repo: '101AoiKoori/HoloLens2Medical-Technical-Documentation_VuePress', // TODO: 如需修改
    docsDir: 'docs',
    editLink: true,
    lastUpdated: false,
    editLinkText: '在 GitHub 上编辑此页',
    contributors: false,

    sidebar: buildSidebarMapping(MODULES),
  }),
})
