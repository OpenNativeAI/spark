/**
 * Markdown 编辑页面（Typora 式实时渲染）
 * - 富文本模式：直接编辑渲染后的内容，所见即所得
 * - 源码模式：编辑原始 Markdown（带 # 的语法）
 * 两者共享同一份内容，切换时就地转换并保留滚动位置（不从头加载）
 * ⌘/Ctrl+S 保存回原文件，未保存退出会提示
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Icon } from '../components/common/Icon'
import { renderMarkdown, serializeDomToMarkdown } from '../utils/markdown'
import './MarkdownEditor.css'

type EditorMode = 'rich' | 'source'

function fileName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 滚动位置比例（0~1），用于跨视图保持阅读位置 */
function scrollRatio(el: HTMLElement | null): number {
  if (!el) return 0
  const range = el.scrollHeight - el.clientHeight
  return range > 0 ? el.scrollTop / range : 0
}

function applyScrollRatio(el: HTMLElement | null, ratio: number): void {
  if (!el) return
  const range = el.scrollHeight - el.clientHeight
  el.scrollTop = range > 0 ? ratio * range : 0
}

export function MarkdownEditor(): React.JSX.Element {
  const { markdownPath, setPage, setMarkdownPath } = useAppStore()
  const path = markdownPath ?? ''

  const [mode, setMode] = useState<EditorMode>('rich')
  const [sourceText, setSourceText] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportedFlash, setExportedFlash] = useState(false)

  const richRef = useRef<HTMLDivElement>(null)
  const richScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const savedRef = useRef('')

  /** 当前 Markdown 文本（富文本模式则序列化编辑区） */
  const currentMarkdown = useCallback((): string => {
    if (mode === 'rich' && richRef.current) {
      return serializeDomToMarkdown(richRef.current)
    }
    return sourceText
  }, [mode, sourceText])

  // 读取文件（无路径时为新建未命名文档，直接进入空白编辑）
  useEffect(() => {
    if (!path) {
      savedRef.current = ''
      setSourceText('')
      if (richRef.current) richRef.current.innerHTML = ''
      setDirty(false)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    window.api
      .readFile(path)
      .then((text) => {
        savedRef.current = text
        setSourceText(text)
        if (richRef.current) richRef.current.innerHTML = renderMarkdown(text)
        setDirty(false)
        setLoading(false)
      })
      .catch((err: unknown) => {
        console.error('读取 Markdown 失败:', err)
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [path])

  // 让回车生成 <p> 而非 <div>，保证块结构可预测、往返稳定
  useEffect(() => {
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p')
    } catch {
      /* 忽略 */
    }
  }, [])

  const handleRichInput = (): void => {
    setDirty(currentMarkdown() !== savedRef.current)
  }

  /** 切换模式：就地转换 + 保留滚动位置 */
  const switchMode = (): void => {
    if (mode === 'rich') {
      // 富文本 -> 源码
      const ratio = scrollRatio(richScrollRef.current)
      setSourceText(serializeDomToMarkdown(richRef.current as Element))
      setMode('source')
      requestAnimationFrame(() => applyScrollRatio(textareaRef.current, ratio))
    } else {
      // 源码 -> 富文本
      const ratio = scrollRatio(textareaRef.current)
      if (richRef.current) richRef.current.innerHTML = renderMarkdown(sourceText)
      setDirty(sourceText !== savedRef.current)
      setMode('rich')
      requestAnimationFrame(() => applyScrollRatio(richScrollRef.current, ratio))
    }
  }

  const handleSave = useCallback(async (): Promise<void> => {
    const md = currentMarkdown()
    let target = path
    // 新建文档：先弹另存为框选位置
    if (!target) {
      const p = await window.api.saveMarkdownFile('未命名.md')
      if (!p) return
      target = p
    }
    if (md === savedRef.current && path) return
    try {
      await window.api.writeFile(target, md)
      savedRef.current = md
      setDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1500)
      // 首次保存后切换到该文件路径
      if (!path) setMarkdownPath(target)
    } catch (err) {
      console.error('保存失败:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [path, currentMarkdown, setMarkdownPath])

  /** 打开本地 Markdown 文件（文档模式独立入口） */
  const handleOpenFile = useCallback(async (): Promise<void> => {
    if (dirty && !confirm('有未保存的修改，打开其他文件将丢弃修改，继续吗？')) {
      return
    }
    try {
      const p = await window.api.selectMarkdownFile()
      if (p) setMarkdownPath(p)
    } catch (err) {
      console.error('打开文件失败:', err)
    }
  }, [dirty, setMarkdownPath])

  const handleBack = (): void => {
    if (dirty && !confirm('有未保存的修改，确定放弃并返回吗？')) {
      return
    }
    const { setMarkdownPath } = useAppStore.getState()
    setMarkdownPath(null)
    setPage('files')
  }

  /** 导出 PDF：将当前内容（含未保存修改）渲染为 HTML 后交给主进程打印 */
  const handleExportPdf = useCallback(async (): Promise<void> => {
    if (exporting) return
    setExporting(true)
    try {
      const html = renderMarkdown(currentMarkdown())
      const base = fileName(path).replace(/\.(md|markdown)$/i, '') || 'document'
      const saved = await window.api.exportMarkdownPdf(html, `${base}.pdf`)
      if (saved) {
        setExportedFlash(true)
        setTimeout(() => setExportedFlash(false), 1500)
      }
    } catch (err) {
      console.error('导出 PDF 失败:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setExporting(false)
    }
  }, [currentMarkdown, exporting, path])

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSave, dirty])

  /* ===== 工具栏命令（仅富文本模式） ===== */
  const exec = (cmd: string, val?: string): void => {
    richRef.current?.focus()
    document.execCommand(cmd, false, val)
    handleRichInput()
  }
  const insertInlineCode = (): void => {
    const sel = window.getSelection()?.toString() ?? '代码'
    exec('insertHTML', `<code>${escapeHtml(sel)}</code>`)
  }
  const insertLink = (): void => {
    const url = prompt('链接地址（https://…）：')
    if (url) exec('createLink', url)
  }

  return (
    <div className="markdown-editor">
      {/* 顶栏 */}
      <div className="md-topbar">
        <button className="md-back" onClick={handleBack} title="返回文件管理">
          <Icon name="arrow-left" size={15} />
        </button>

        <button className="md-open" onClick={() => void handleOpenFile()} title="打开 Markdown 文件">
          <Icon name="folder" size={13} />
          <span>打开</span>
        </button>

        <div className="md-filename">
          <Icon name="file" size={13} />
          <span className="text-ellipsis" title={path}>
            {path ? fileName(path) : '未命名文档'}
          </span>
          {dirty && <span className="md-dirty" title="未保存">●</span>}
        </div>

        <div className="md-spacer" />

        {/* 模式切换 */}
        <div className="md-mode-toggle">
          <button
            className={`md-mode-btn ${mode === 'rich' ? 'active' : ''}`}
            onClick={() => mode === 'source' && switchMode()}
            title="实时渲染编辑（所见即所得）"
          >
            <Icon name="eye" size={13} />
            <span>编辑</span>
          </button>
          <button
            className={`md-mode-btn ${mode === 'source' ? 'active' : ''}`}
            onClick={() => mode === 'rich' && switchMode()}
            title="查看 / 编辑原始 Markdown"
          >
            <Icon name="code" size={13} />
            <span>Markdown</span>
          </button>
        </div>

        <button
          className={`md-export ${exportedFlash ? 'done' : ''}`}
          onClick={() => void handleExportPdf()}
          disabled={exporting || loading || !!error}
          title="导出为 PDF（保留标题、横线、表格、代码块等样式）"
        >
          <Icon name="download" size={13} />
          <span>{exportedFlash ? '已导出' : exporting ? '导出中…' : '导出 PDF'}</span>
        </button>

        <button
          className={`md-save ${savedFlash ? 'saved' : ''}`}
          onClick={() => void handleSave()}
          disabled={!dirty && !savedFlash}
          title="保存 (⌘S)"
        >
          {savedFlash ? <Icon name="check" size={13} /> : <Icon name="upload" size={13} />}
          <span>{savedFlash ? '已保存' : '保存'}</span>
        </button>
      </div>

      {/* 工具栏（仅富文本模式） */}
      {mode === 'rich' && !loading && !error && (
        <div className="md-toolbar">
          <button title="加粗" onClick={() => exec('bold')}>
            <b>B</b>
          </button>
          <button title="斜体" onClick={() => exec('italic')}>
            <i>I</i>
          </button>
          <button title="删除线" onClick={() => exec('strikeThrough')}>
            <s>S</s>
          </button>
          <span className="md-toolbar-sep" />
          <button title="一级标题" onClick={() => exec('formatBlock', '<h1>')}>
            H1
          </button>
          <button title="二级标题" onClick={() => exec('formatBlock', '<h2>')}>
            H2
          </button>
          <button title="三级标题" onClick={() => exec('formatBlock', '<h3>')}>
            H3
          </button>
          <button title="正文" onClick={() => exec('formatBlock', '<p>')}>
            正文
          </button>
          <span className="md-toolbar-sep" />
          <button title="无序列表" onClick={() => exec('insertUnorderedList')}>
            •≡
          </button>
          <button title="有序列表" onClick={() => exec('insertOrderedList')}>
            1≡
          </button>
          <button title="引用" onClick={() => exec('formatBlock', '<blockquote>')}>
            ❝
          </button>
          <button title="行内代码" onClick={insertInlineCode}>
            &lt;/&gt;
          </button>
          <button title="代码块" onClick={() => exec('formatBlock', '<pre>')}>
            {'{ }'}
          </button>
          <button title="链接" onClick={insertLink}>
            <Icon name="link" size={13} />
          </button>
          <button title="分隔线" onClick={() => exec('insertHTML', '<hr>')}>
            ―
          </button>
        </div>
      )}

      {/* 内容区 */}
      <div className="md-content">
        {loading ? (
          <div className="md-status">
            <Icon name="refresh" size={22} strokeWidth={1} />
            <span>加载中…</span>
          </div>
        ) : error ? (
          <div className="md-status md-error">
            <Icon name="x" size={22} strokeWidth={1} />
            <span>无法打开文件：{error}</span>
          </div>
        ) : (
          <>
            <div
              ref={richScrollRef}
              className={`md-rich-scroll ${mode === 'rich' ? '' : 'hidden'}`}
            >
              <div
                ref={richRef}
                className="md-rich md-preview-body"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="开始编写 Markdown…"
                onInput={handleRichInput}
                onBlur={handleRichInput}
              />
            </div>
            <textarea
              ref={textareaRef}
              className={`md-textarea ${mode === 'source' ? '' : 'hidden'}`}
              value={sourceText}
              spellCheck={false}
              placeholder="# 开始编写 Markdown…"
              onChange={(e) => {
                setSourceText(e.target.value)
                setDirty(e.target.value !== savedRef.current)
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
