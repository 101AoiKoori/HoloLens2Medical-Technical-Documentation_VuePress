// docs/.vuepress/config.js
import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'

// ---- 自动生成侧边栏的辅助函数（可复用） ----
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DOCS_ROOT = path.resolve(__dirname, '..') // 指向 docs/

// 将文件名转为更友好的标题：支持 01-xxx.md、01_xxx.md
function fileNameToTitle (fileName) {
  const base = fileName.replace(/\.md$/i, '')
  const noIndex = base.replace(/^README$/i, '索引')
  const noPrefix = noIndex.replace(/^\d+[-_]?/, '')
  return noPrefix
    .replace(/[-_]/g, ' ')
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
}

// 读取 md 第一行 H1 或 frontmatter title
function readTitleFromMd (absPath) {
  try {
    const raw = fs.readFileSync(absPath, 'utf8')
    // frontmatter: title: xxx
    const fm = raw.match(/^---[\s\S]*?^---/m)
    if (fm) {
      const m = fm[0].match(/^\s*title:\s*(.+)\s*$/mi)
      if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
    }
    // 第一行 H1
    const h1 = raw.match(/^\s*#\s+(.+)$/m)
    if (h1) return h1[1].trim()
  } catch {}
  return null
}

// 列出目录下的 md 页面，返回 { text, link } 列表
function listPages (relDir, { includeReadme = false } = {}) {
  // 使用 posix 路径，避免 Windows 反斜杠
  const absDir = path.resolve(DOCS_ROOT, relDir)
  if (!fs.existsSync(absDir)) return []

  const files = fs
    .readdirSync(absDir)
    .filter(f => f.toLowerCase().endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')) // 支持带数字的排序

  const items = []
  for (const f of files) {
    const isReadme = /^readme\.md$/i.test(f)
    if (!includeReadme && isReadme) continue

    const title =
      readTitleFromMd(path.resolve(absDir, f)) ||
      fileNameToTitle(f)

    // 目录式链接：README 用 /xxx/，其它用 /xxx/yyyy.html
    const base = '/' + path.posix.join(relDir).replace(/(^|\/)README\.md$/i, '')
    const link = isReadme
      ? '/' + path.posix.join(relDir.replace(/\/README\.md$/i, ''), '/') // /guide/loading/
      : '/' + path.posix.join(relDir, f.replace(/\.md$/i, '.html'))      // /guide/loading/step-1.html

    items.push({ text: title, link })
  }
  return items
}

// 为某个模块（如 guide/loading）生成「多分区」侧边栏
function makeModuleSidebar (moduleKey, humanName) {
  // 统一的 4 个子分区（可按需增删）
  const groups = [
    { text: '基础教程',     subdir: '' },
    { text: '操作指南How-to', subdir: 'how-to' },
    { text: '原理解读Explanation', subdir: 'explanations' },
    { text: '故障排除Troubleshooting', subdir: 'troubleshooting' },
  ]

  const base = `guide/${moduleKey}` // 相对 docs 的路径
  const result = []

  // 模块索引页（/guide/<module>/README.md）
  const indexItems = listPages(`${base}`, { includeReadme: true })
  if (indexItems.length) {
    result.push({
      text: `${humanName} · 索引`,
      collapsible: true,
      collapsed: false,
      children: indexItems,
    })
  }

  for (const g of groups) {
    const rel = g.subdir ? `${base}/${g.subdir}` : `${base}`
    const children = listPages(rel, { includeReadme: g.subdir !== '' })
    if (children.length) {
      result.push({
        text: g.text,
        collapsible: true,
        collapsed: true,
        children,
      })
    }
  }
  return result
}

// ---- 你可以在这里配置模块清单（教程线） ----
// TODO: 按需增删模块；第二列是显示名
const MODULES = [
  ['core',            'Core'],
  ['imaging',         'Imaging'],
  ['loading',         'Loading'],
  ['ui',              'UI'],
  ['viewers',         'Viewers'],
  ['visualization3d', 'Visualization3D'],
]

// 参考线（/reference/）：自动读取该目录下的 md
function makeReferenceSidebar () {
  const items = [
    { text: '总览', link: '/reference/' }
  ].concat(listPages('reference'))
  return [
    {
      text: '参考与 API',
      collapsible: true,
      collapsed: false,
      children: items,
    },
  ]
}

// /guide/ 的“模块目录”分组（指向各模块首页）
function makeGuideHomeSidebar () {
  const moduleLinks = MODULES.map(([k, name]) => ({
    text: name,
    link: `/guide/${k}/`, // 指向模块 README
  }))
  return [
    {
      text: '开始',
      collapsible: true,
      collapsed: false,
      children: [
        { text: '简介',     link: '/guide/' },
        { text: '环境搭建', link: '/guide/setup/' },
      ],
    },
    {
      text: '功能模块（教程）',
      collapsible: true,
      collapsed: false,
      children: moduleLinks,
    },
  ]
}

// 组装所有 sidebar 映射
function buildSidebarMapping () {
  const map = {
    '/guide/': makeGuideHomeSidebar(),
    '/reference/': makeReferenceSidebar(),
  }
  // 为每个模块添加独立的多分区侧边栏
  for (const [key, name] of MODULES) {
    map[`/guide/${key}/`] = makeModuleSidebar(key, name)
  }
  return map
}

// -----------------------------------------------

export default defineUserConfig({
  lang: 'zh-CN',
  title: 'MRTK Medical Technical Documentation',
  description: 'DICOM + MRTK3 in Unity — 医学影像可视化与交互方案',
  bundler: viteBundler(),

  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
  ],

  theme: defaultTheme({
    navbar: [
      { text: '指南', link: '/guide/' },
      { text: '参考', link: '/reference/' },
      { text: 'HoloLens2Medical', link: 'https://github.com/Fantastic2020/HoloLens2Medical' }, // TODO: 替换为你的仓库
    ],

    // 仓库信息（可选）
    repo: '101AoiKoori/MRTK-Medical-Technical-Documentation_VuePress',           // TODO: 替换
    docsDir: 'docs',
    editLink: true,
    editLinkText: '在 GitHub 上编辑此页',
    lastUpdated: true,
    contributors: false,

    // 关键：侧边栏映射（自动生成）
    sidebar: buildSidebarMapping(),
  }),
})
