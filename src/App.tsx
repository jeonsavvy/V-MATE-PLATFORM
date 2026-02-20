import { useState, useEffect } from "react"
import { ChatView } from "@/components/ChatView"
import { Home } from "@/components/Home"
import { AuthDialog } from "@/components/AuthDialog"
import { Toaster } from "@/components/ui/sonner"
import { CHARACTERS } from "@/lib/data"
import { User } from "@supabase/supabase-js"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import type { Character } from "@/lib/data"

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
      <Toaster />
    </div>
  )
}

export default App
