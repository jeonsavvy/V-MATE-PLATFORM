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
      <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold bg-gradient-to-r from-[#FF007F] to-rose-600 bg-clip-text text-transparent">
            V-MATE
          </DialogTitle>
          <DialogDescription className="text-center text-neutral-400">
            로그인하여 대화 내역을 저장하고 동기화하세요.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-neutral-800">
            <TabsTrigger value="signin" className="data-[state=active]:bg-[#FF007F] data-[state=active]:text-white">로그인</TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-[#FF007F] data-[state=active]:text-white">회원가입</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300">이메일</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="hello@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-300">비밀번호</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <Button type="submit" className="w-full bg-[#FF007F] hover:bg-[#E00070] text-white" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                로그인
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-neutral-300">이름</Label>
                <Input 
                  id="name" 
                  placeholder="표시할 이름" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-neutral-300">이메일</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  placeholder="hello@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-neutral-300">비밀번호</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-neutral-800 border-neutral-700 text-white"
                />
              </div>
              <Button type="submit" className="w-full bg-[#FF007F] hover:bg-[#E00070] text-white" disabled={isLoading}>
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

