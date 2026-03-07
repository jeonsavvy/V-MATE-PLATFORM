import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ClearChatDialogProps {
  open: boolean
  isSubmitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ClearChatDialog({
  open,
  isSubmitting,
  onOpenChange,
  onConfirm,
}: ClearChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-[2rem]">
        <DialogHeader>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Reset scene</p>
          <DialogTitle>이 캐릭터와의 대화를 비울까요?</DialogTitle>
          <DialogDescription>
            긴 대화는 전송 시 자동으로 압축됩니다. 초기화를 누르면 이 캐릭터의 저장된 기록과 현재 장면이 모두 삭제됩니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "초기화 중..." : "대화 초기화"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
