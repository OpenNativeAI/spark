/**
 * 应用入口
 * 根据 currentPage 渲染对应页面
 */

import { useEffect } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { FileExplorer } from './pages/FileExplorer'
import { MediaLibrary } from './pages/MediaLibrary'
import { VideoPlayer } from './components/media/VideoPlayer'
import { MarkdownEditor } from './pages/MarkdownEditor'
import { Settings } from './pages/Settings'
import { Bookmarks } from './pages/Bookmarks'
import { useAppStore } from './store/appStore'
import { useDiskStore } from './store/diskStore'

export default function App(): React.JSX.Element {
  const { currentPage, setPortableStatus } = useAppStore()
  const { setDisks } = useDiskStore()

  // 初始化：加载便携模式状态 + 磁盘列表
  useEffect(() => {
    window.api
      .getPortableStatus()
      .then(setPortableStatus)
      .catch((err) => console.error('获取便携模式状态失败:', err))

    window.api
      .listDisks()
      .then(setDisks)
      .catch((err) => console.error('获取磁盘列表失败:', err))
  }, [setPortableStatus, setDisks])

  return (
    <AppLayout>
      {currentPage === 'files' && <FileExplorer />}
      {currentPage === 'media' && <MediaLibrary />}
      {currentPage === 'bookmarks' && <Bookmarks />}
      {currentPage === 'settings' && <Settings />}
      {currentPage === 'mediaDetail' && <VideoPlayer />}
      {currentPage === 'markdown' && <MarkdownEditor />}
    </AppLayout>
  )
}
