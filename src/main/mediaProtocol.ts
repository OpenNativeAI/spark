/**
 * sparkmedia:// 协议处理
 * 支持 HTTP Range 分段请求，供 <video> 元素流式播放与 seek
 */

import * as fs from 'node:fs'
import { Readable } from 'node:stream'

/** 视频扩展名 → MIME 类型 */
const MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  ts: 'video/mp2t',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  '3gp': 'video/3gpp',
  ogv: 'video/ogg'
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return MIME_MAP[ext] || 'application/octet-stream'
}

/**
 * 处理媒体文件请求，返回支持 Range 的 Response
 * @param filePath 本地文件绝对路径
 * @param rangeHeader 请求头中的 Range（如 "bytes=0-"）
 */
export async function serveMediaFile(
  filePath: string,
  rangeHeader: string | null
): Promise<Response> {
  if (!fs.existsSync(filePath)) {
    return new Response('Not Found', { status: 404 })
  }

  const stat = fs.statSync(filePath)
  const fileSize = stat.size
  const mimeType = getMimeType(filePath)

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
    let start = match && match[1] ? parseInt(match[1], 10) : 0
    let end = match && match[2] ? parseInt(match[2], 10) : fileSize - 1

    if (isNaN(start) || start >= fileSize) start = 0
    if (isNaN(end) || end >= fileSize) end = fileSize - 1
    if (start > end) start = end

    const chunkSize = end - start + 1
    const nodeStream = fs.createReadStream(filePath, { start, end })
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Type': mimeType
      }
    })
  }

  const nodeStream = fs.createReadStream(filePath)
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream

  return new Response(webStream, {
    status: 200,
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes'
    }
  })
}
