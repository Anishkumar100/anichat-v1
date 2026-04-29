import React from 'react'
import { LeftSidebar, ChatContainer, RightSidebar } from '../components/indexComponents'
import { useState } from "react"
import { useAppContext } from '../context/ContextProvider'

export const HomePage = ({ setBg, bg }) => {
  const { selectedUser, selectedGroup } = useAppContext()
  const hasChat = selectedUser || selectedGroup

  return (
    <div className="w-full h-screen" style={{ height: "100dvh" }}>
      <div className={`
        backdrop-blur-xl border border-gray-600 sm:rounded-2xl overflow-hidden h-full
        grid
        ${hasChat
          ? 'grid-cols-1 md:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_240px]'
          : 'grid-cols-1 md:grid-cols-[260px_1fr]'
        }
      `}>
        {/* Left sidebar: always visible on md+, hidden on mobile when chat open */}
        <div className={`h-full overflow-hidden ${hasChat ? 'hidden md:block' : 'block'}`}>
          <LeftSidebar setBg={setBg} bg={bg} />
        </div>

        {/* Chat: always visible on md+, only visible on mobile when chat selected */}
        <div className={`h-full overflow-hidden relative ${hasChat ? 'block' : 'hidden md:block'}`}>
          <ChatContainer />
        </div>

        {/* Right sidebar: only on xl when chat open, hidden otherwise */}
        {hasChat && (
          <div className="hidden xl:block h-full overflow-hidden">
            <RightSidebar />
          </div>
        )}
      </div>
    </div>
  )
}
