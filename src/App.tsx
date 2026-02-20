import { useState, useEffect, Suspense, lazy } from "react"
import { Toaster } from "@/components/ui/sonner"
import { CHARACTERS } from "@/lib/data"
import { User } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import type { Character } from "@/lib/data"

const Home = lazy(() => import("@/components/Home").then((module) => ({ default: module.Home })))
const ChatView = lazy(() => import("@/components/ChatView").then((module) => ({ default: module.ChatView })))
const AuthDialog = lazy(() => import("@/components/AuthDialog").then((module) => ({ default: module.AuthDialog })))

function App() {
  const [currentView, setCurrentView] = useState<"home" | "chat">("home")
  const [currentCharId, setCurrentCharId] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    }).catch((error) => {
      console.error("Failed to get session:", error)
    })

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
      })

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error("Failed to set up auth state change listener:", error)
    }
  }, [])

  const handleCharacterSelect = (character: Character) => {
    setCurrentCharId(character.id)
    setCurrentView("chat")
  }

  const handleBackToHome = () => {
    setCurrentView("home")
    setCurrentCharId(null)
  }

  const character = currentCharId ? CHARACTERS[currentCharId] : null

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#e7dfd3]">
      <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-sm text-[#6f695e]">불러오는 중...</div>}>
        {currentView === "home" ? (
          <Home
            onCharacterSelect={handleCharacterSelect}
            user={user}
            onAuthRequest={() => setIsAuthDialogOpen(true)}
          />
        ) : (
          character && (
            <ChatView
              character={character}
              onCharacterChange={setCurrentCharId}
              user={user}
              onBack={handleBackToHome}
            />
          )
        )}

        <AuthDialog
          open={isAuthDialogOpen}
          onOpenChange={setIsAuthDialogOpen}
          onSuccess={() => {
            setIsAuthDialogOpen(false)
          }}
        />
      </Suspense>
      <Toaster />
    </div>
  )
}

export default App
