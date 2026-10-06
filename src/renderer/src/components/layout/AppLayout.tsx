/**
 * 整体应用布局
 * TitleBar 顶部 + Sidebar 左侧 + 主内容区 + StatusBar 底部
 */

import { TitleBar } from './TitleBar'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { ContextMenuHost } from '../common/ContextMenu'
import './AppLayout.css'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  return (
    <div className="app-layout">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <div className="app-main">
          <main className="app-content">{children}</main>
          <StatusBar />
        </div>
      </div>
      <ContextMenuHost />
    </div>
  )
}
