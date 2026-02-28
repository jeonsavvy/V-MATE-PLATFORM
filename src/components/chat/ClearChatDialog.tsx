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
  onCompress: () => void
}

export function ClearChatDialog({
  open,
  isSubmitting,
  onOpenChange,
  onConfirm,
  onCompress,
}: ClearChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl border border-[#dfd3c1] bg-[#f8f2e9] p-5">
        <DialogHeader>
          <DialogTitle className="text-[#2f3138]">대화를 초기화할까요?</DialogTitle>
          <DialogDescription className="text-[#6f665a]">
            전체 삭제 대신 최근 흐름을 남기고 요약 후 정리할 수도 있습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-xl border border-[#d8ccbb] bg-white/70 text-[#5f584f] hover:bg-white"
          >
            취소
          </Button>
          <Button
            onClick={onCompress}
            disabled={isSubmitting}
            className="rounded-xl bg-[#4b5776] text-white hover:bg-[#434e6c]"
          >
            {isSubmitting ? "압축 중..." : "요약 후 정리"}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-red-600 text-white hover:bg-red-500"
          >
            {isSubmitting ? "초기화 중..." : "초기화"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
