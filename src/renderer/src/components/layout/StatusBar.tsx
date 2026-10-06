/**
 * 底部状态栏
 * 显示：文件数量、选中数量、总大小、当前路径等
 */

import { useDiskStore } from '../../store/diskStore'
import { useAppStore } from '../../store/appStore'
import { useMediaStore } from '../../store/mediaStore'
import { Icon } from '../common/Icon'
import './StatusBar.css'

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StatusBar(): React.JSX.Element {
  const { currentPage, portableStatus } = useAppStore()
  const { files, selectedPaths, currentPath } = useDiskStore()
  const { videos, scanning } = useMediaStore()

  const selectedSize = files
    .filter((f) => selectedPaths.has(f.path))
    .reduce((sum, f) => sum + (f.size ?? 0), 0)

  return (
    <div className="statusbar">
      {/* 左侧：项目统计 */}
      <div className="statusbar-left">
        {currentPage === 'files' && (
          <>
            <span className="statusbar-item">{files.length} 个项目</span>
            {selectedPaths.size > 0 && (
              <>
                <span className="statusbar-divider">·</span>
                <span className="statusbar-item">
                  已选 {selectedPaths.size} 个 · {formatSize(selectedSize)}
                </span>
              </>
            )}
          </>
        )}
        {currentPage === 'media' && (
          <>
            <span className="statusbar-item">{videos.length} 个视频</span>
            {scanning && (
              <>
                <span className="statusbar-divider">·</span>
                <span className="statusbar-item statusbar-scanning">
                  <Icon name="refresh" size={12} />
                  扫描中...
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* 右侧：路径 / 便携标识 */}
      <div className="statusbar-right">
        {portableStatus?.isPortable && (
          <>
            <span className="statusbar-item statusbar-portable">
              <Icon name="usb" size={11} />
              便携模式
            </span>
            <span className="statusbar-divider">·</span>
          </>
        )}
        {currentPath && (
          <span className="statusbar-item statusbar-path text-ellipsis">{currentPath}</span>
        )}
      </div>
    </div>
  )
}
