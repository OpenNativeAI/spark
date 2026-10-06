/**
 * Markdown 导出 PDF
 * 渲染进程将 Markdown 转为 HTML 后传来，主进程拼装完整文档（内嵌打印样式），
 * 写入临时文件 -> 隐藏 BrowserWindow 加载 -> webContents.printToPDF -> 保存到用户选择的路径。
 * 样式覆盖：标题、段落、粗体/斜体/删除线、行内代码、代码块、引用、列表、
 * 分隔线（横线）、链接、图片、表格（含表头底色与斑马纹）。
 */
import { app, BrowserWindow, dialog } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { writeFile, unlink, mkdir } from 'node:fs/promises'

/** 内嵌打印样式：强制浅色纸面，保证各 Markdown 元素在 PDF 中完整呈现 */
const PDF_CSS = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
  }
  body {
    color: #1f2328;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
      'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
    font-size: 14px;
    line-height: 1.7;
    word-wrap: break-word;
  }
  body > *:first-child { margin-top: 0; }

  /* 标题 */
  h1, h2, h3, h4, h5, h6 {
    margin: 1.6em 0 0.6em;
    font-weight: 600;
    line-height: 1.3;
    break-after: avoid-page;
  }
  h1 { font-size: 26px; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
  h2 { font-size: 20px; padding-bottom: 0.25em; border-bottom: 1px solid #d8dee4; }
  h3 { font-size: 17px; }
  h4 { font-size: 15px; }
  h5, h6 { font-size: 14px; color: #57606a; }

  /* 段落 */
  p { margin: 0.9em 0; }

  /* 粗体 / 斜体 / 删除线 */
  strong { font-weight: 700; }
  em { font-style: italic; }
  del { color: #6e7781; text-decoration: line-through; }

  /* 行内代码 */
  code {
    padding: 0.15em 0.4em;
    border-radius: 4px;
    background: #f0f2f5;
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    font-size: 0.88em;
  }

  /* 代码块 */
  pre {
    margin: 1em 0;
    padding: 14px 16px;
    border-radius: 8px;
    background: #f6f8fa;
    border: 1px solid #eaeef2;
    white-space: pre-wrap;
    word-break: break-all;
    break-inside: avoid-page;
  }
  pre code {
    padding: 0;
    background: transparent;
    border: none;
    font-size: 12.5px;
    line-height: 1.6;
  }

  /* 引用 */
  blockquote {
    margin: 1em 0;
    padding: 0.2em 1em;
    border-left: 3px solid #d0d7de;
    color: #57606a;
    background: #f6f8fa;
    border-radius: 0 4px 4px 0;
  }
  blockquote p { margin: 0.4em 0; }

  /* 列表 */
  ul, ol { margin: 0.8em 0; padding-left: 1.8em; }
  li { margin: 0.3em 0; }
  li > ul, li > ol { margin: 0.2em 0; }

  /* 分隔线（横线） */
  hr {
    margin: 1.8em 0;
    border: none;
    border-top: 2px solid #d8dee4;
    break-inside: avoid-page;
  }

  /* 链接 */
  a {
    color: #0969da;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* 图片 */
  img {
    max-width: 100%;
    border-radius: 6px;
  }

  /* 表格 */
  table {
    margin: 1em 0;
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
    break-inside: auto;
  }
  th, td {
    padding: 7px 12px;
    border: 1px solid #d0d7de;
    text-align: left;
  }
  th {
    background: #f6f8fa;
    font-weight: 600;
  }
  tr:nth-child(even) td { background: #fbfcfd; }
  tr { break-inside: avoid-page; }
`

/** 拼装完整可打印 HTML 文档 */
function buildPrintDocument(html: string, title: string): string {
  const safeTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${safeTitle}</title>`,
    `<style>${PDF_CSS}</style>`,
    '</head>',
    '<body>',
    html,
    '</body>',
    '</html>'
  ].join('\n')
}

/** 等待页面（含图片）完全加载，保证代码块底色、图片等出现在 PDF 中 */
async function waitForRender(win: BrowserWindow): Promise<void> {
  await win.webContents
    .executeJavaScript(
      `new Promise((resolve) => {
        const done = () => {
          const pending = Array.from(document.images).filter((img) => !img.complete);
          if (pending.length === 0) { resolve(true); return; }
          let left = pending.length;
          pending.forEach((img) => {
            const finish = () => { if (--left <= 0) resolve(true); };
            img.addEventListener('load', finish);
            img.addEventListener('error', finish);
          });
        };
        if (document.readyState === 'complete') done();
        else window.addEventListener('load', done);
      })`
    )
    .catch(() => undefined)
  // 留一帧给浏览器完成最终布局绘制
  await new Promise((r) => setTimeout(r, 150))
}

/**
 * 导出 PDF：弹出保存对话框，用户选择路径后生成 PDF。
 * 返回保存成功的文件路径；用户取消返回 null。
 */
export async function exportMarkdownToPdf(
  parent: BrowserWindow,
  html: string,
  defaultFileName: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(parent, {
    title: '导出 PDF',
    defaultPath: defaultFileName,
    filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return null

  const tmpDir = join(app.getPath('temp'), 'spark-md-pdf')
  await mkdir(tmpDir, { recursive: true })
  const tmpFile = join(tmpDir, `export-${Date.now()}.html`)

  let win: BrowserWindow | null = null
  try {
    await writeFile(tmpFile, buildPrintDocument(html, defaultFileName), 'utf-8')

    win = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: { sandbox: true, offscreen: false }
    })
    await win.loadURL(pathToFileURL(tmpFile).toString())
    await waitForRender(win)

    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0.6, bottom: 0.6, left: 0.55, right: 0.55 }
    })
    await writeFile(result.filePath, pdf)
    return result.filePath
  } finally {
    win?.destroy()
    await unlink(tmpFile).catch(() => undefined)
  }
}
