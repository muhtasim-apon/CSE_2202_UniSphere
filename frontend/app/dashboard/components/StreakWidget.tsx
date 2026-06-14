import { Flame, Target } from 'lucide-react'
import ModuleCard from './ModuleCard'

type StreakWidgetProps = {
  days: number
  weeklyGoalLabel: string
  weeklyProgress: number
}

export default function StreakWidget({ days, weeklyGoalLabel, weeklyProgress }: StreakWidgetProps) {
  return (
    <ModuleCard title="Streak & Goals" icon={Flame} iconBgClassName="bg-amber-50" iconClassName="text-accent">
      <div className="flex items-center gap-3">
        <Flame className="h-8 w-8 text-accent" />
        <div>
          <p className="text-2xl font-bold text-text-primary">{days} day streak</p>
          <p className="text-sm text-text-muted">Keep it up, you're on fire!</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 font-medium text-text-primary">
            <Target className="h-4 w-4 text-success" />
            {weeklyGoalLabel}
          </span>
          <span className="text-text-muted">{weeklyProgress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${weeklyProgress}%` }}
          />
        </div>
      </div>
    </ModuleCard>
  )
}
