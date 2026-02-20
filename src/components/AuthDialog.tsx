import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AuthDialog({ open, onOpenChange, onSuccess }: AuthDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("signin")
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured()) {
      toast.error("Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
      return
    }
    
    setIsLoading(true)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success("로그인 성공!")
      onOpenChange(false)
      setEmail("")
      setPassword("")
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message || "로그인에 실패했습니다")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isSupabaseConfigured()) {
      toast.error("Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
      return
    }
    
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) {
        if (error.message.includes('secret') || error.message.includes('Forbidden')) {
          toast.error("Supabase 설정 오류입니다. 관리자에게 문의해주세요.")
          console.error("Supabase auth error:", error)
          return
        }
        throw error
      }

      if (data.user) {
        if (data.session) {
          toast.success("회원가입 및 로그인 성공!")
          onOpenChange(false)
          setEmail("")
          setPassword("")
          setName("")
          onSuccess?.()
        } else {
          toast.success("회원가입 성공! 이메일을 확인해주세요.")
          onOpenChange(false)
          setEmail("")
          setPassword("")
          setName("")
        }
      }
    } catch (error: any) {
      console.error("Sign up error:", error)
      toast.error(error.message || "회원가입에 실패했습니다")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md border-white/45 bg-[#f2ebe0]/88 text-[#1f2128] shadow-[0_30px_56px_-34px_rgba(18,17,15,0.82)] backdrop-blur-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-black tracking-[0.03em] text-[#2d3039]">
            V-MATE
          </DialogTitle>
          <DialogDescription className="text-center text-[#716a61]">
            로그인하여 대화 내역을 저장하고 동기화하세요.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-2 border border-[#d8ccba] bg-[#ebe3d7]/80 p-1">
            <TabsTrigger value="signin" className="rounded-md text-[#6c655b] transition data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3a3d45] data-[state=active]:to-[#4a454f] data-[state=active]:text-white">로그인</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-md text-[#6c655b] transition data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3a3d45] data-[state=active]:to-[#4a454f] data-[state=active]:text-white">회원가입</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#6f6a61]">이메일</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="hello@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-[#d1c4b3] bg-white/75 text-[#22242b] placeholder:text-[#8f8b82] focus-visible:border-[#e05d4e]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#6f6a61]">비밀번호</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-[#d1c4b3] bg-white/75 text-[#22242b] focus-visible:border-[#e05d4e]"
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-[#3a3d45] to-[#4a454f] text-white shadow-[0_14px_26px_-18px_rgba(26,27,33,0.95)] transition hover:brightness-110" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                로그인
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#6f6a61]">이름</Label>
                <Input 
                  id="name" 
                  placeholder="표시할 이름" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="border-[#d1c4b3] bg-white/75 text-[#22242b] placeholder:text-[#8f8b82] focus-visible:border-[#e05d4e]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-[#6f6a61]">이메일</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  placeholder="hello@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="border-[#d1c4b3] bg-white/75 text-[#22242b] placeholder:text-[#8f8b82] focus-visible:border-[#e05d4e]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-[#6f6a61]">비밀번호</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="border-[#d1c4b3] bg-white/75 text-[#22242b] focus-visible:border-[#e05d4e]"
                />
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-[#3a3d45] to-[#4a454f] text-white shadow-[0_14px_26px_-18px_rgba(26,27,33,0.95)] transition hover:brightness-110" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                회원가입
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
