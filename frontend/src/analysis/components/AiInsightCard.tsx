// Gemini가 현재 추세·AI 예측을 문장으로 풀어 주는 "AI 분석" 카드.
import { Panel } from './Panel'
import { Badge } from './Badge'
import { AI } from '../config'

export type InsightState = 'loading' | 'error' | 'ready'

interface Props {
  state: InsightState
  summary?: string
  onClick?: () => void
  expanded?: boolean
}

const MESSAGES: Record<Exclude<InsightState, 'ready'>, string> = {
  loading: 'AI가 분석 중...',
  error: 'AI 해설을 불러오지 못했습니다',
}

export function AiInsightCard({ state, summary, onClick, expanded }: Props) {
  return (
    <Panel title="AI 분석" badge={<Badge label={AI.insightModel} severity="normal" />} onClick={onClick} expanded={expanded}>
      <p className={`ai-insight__text${state === 'ready' ? '' : ' is-muted'}`} aria-live="polite">
        {state === 'ready' ? summary : MESSAGES[state]}
      </p>
      <p className="ai-insight__models">예측 {AI.forecastModel} · 해설 {AI.insightModel}</p>
    </Panel>
  )
}
