import React from 'react'
import { LeftSidebar, ChatContainer, RightSidebar } from '../components/indexComponents'
import { useAppContext } from '../context/ContextProvider'

export const HomePage = ({ setBg, bg }) => {
  const { selectedUser, selectedGroup } = useAppContext()
  const hasChat = selectedUser || selectedGroup

  /*
   *  RESPONSIVE LAYOUT STRATEGY
   *  ─────────────────────────────────────────────────────────────
   *  Mobile  (<768px):  One column — sidebar OR chat, not both.
   *    • No chat selected → sidebar fills screen
   *    • Chat selected    → chat fills screen (back arrow returns to sidebar)
   *
   *  Tablet (768–1279px): Two columns — sidebar (260px) + chat.
   *    Right sidebar hidden (too narrow).
   *
   *  Desktop (≥1280px): Three columns when chat open, two otherwise.
   *
   *  dvh (dynamic viewport height) fixes the iOS Safari address-bar bug
   *  where 100vh includes the browser chrome, clipping the bottom.
   *  Fallback `h-screen` for browsers that don't support dvh.
   */
  return (
    <div className="w-full h-screen" style={{ height: '100dvh' }}>
      <div className={`
        backdrop-blur-xl border border-gray-600 sm:rounded-2xl h-full
        overflow-hidden grid
        ${hasChat
          ? 'grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_240px]'
          : 'grid-cols-1 md:grid-cols-[260px_1fr]'
        }
      `}>
        {/* Sidebar: full-screen on mobile when no chat, always visible md+ */}
        <div className={`h-full overflow-hidden ${hasChat ? 'hidden md:block' : 'block'}`}>
          <LeftSidebar setBg={setBg} bg={bg} />
        </div>

        {/* Chat column */}
        <div className={`h-full overflow-hidden relative ${hasChat ? 'block' : 'hidden md:block'}`}>
          <ChatContainer />
        </div>

        {/* Right sidebar: xl+ only when chat open */}
        {hasChat && (
          <div className="hidden xl:block h-full overflow-hidden">
            <RightSidebar />
          </div>
        )}
      </div>
    </div>
  )
}
