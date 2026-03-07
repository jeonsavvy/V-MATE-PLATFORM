import { motion } from "motion/react"

interface StoryFlowStep {
  title: string
  description: string
}

interface HomeStoryFlowSectionProps {
  steps: StoryFlowStep[]
}

export function HomeStoryFlowSection({ steps }: HomeStoryFlowSectionProps) {
  return (
    <section className="rounded-[2rem] border border-border/80 bg-card/82 p-6 shadow-paper md:p-8">
      <div className="max-w-2xl space-y-3">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Narrative flow</p>
        <h2 className="font-display text-[clamp(2rem,4vw,3rem)] text-foreground">대화를 여는 흐름도 단정하게</h2>
        <p className="text-base leading-7 text-muted-foreground">
          복잡한 설정을 보여주기보다, 캐릭터 선택부터 첫 장면 시작까지 필요한 동선만 또렷하게 정리했습니다.
        </p>
      </div>

      <ol className="mt-8 grid gap-4 lg:grid-cols-3">
        {steps.map((step, index) => (
          <motion.li
            key={step.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ delay: index * 0.08 }}
            className="relative overflow-hidden rounded-[1.8rem] border border-border/75 bg-background/70 p-5 shadow-inner-line"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Step {index + 1}</p>
                <h3 className="mt-3 text-xl font-semibold text-foreground">{step.title}</h3>
              </div>
              <span className="font-display text-4xl leading-none text-primary/28">0{index + 1}</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{step.description}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}
