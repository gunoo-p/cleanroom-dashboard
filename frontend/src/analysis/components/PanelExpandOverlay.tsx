// 클릭한 패널이 원래 자리에서 자라나 패널 그리드 영역(사이드바·탭 제목은 침범하지 않음)을
// 꽉 채우며 확대되는 트랜지션. 배경 클릭·ESC·닫기 버튼으로 원래 자리로 되돌아가며 사라진다.
//
// 박스 자체는 처음부터 끝까지 최종(꽉 찬) 크기/위치로 두고, transform(translate+scale)만으로
// "작게 시작 → 커짐"을 표현한다(FLIP 기법). top/left/width/height를 직접 애니메이션하면 매
// 프레임 실제 레이아웃이 다시 계산되어 내부 차트가 계속 리사이즈를 반복하며 뚝뚝 끊기고
// 그래서 "계속 늘어나는" 것처럼 보인다 — transform은 합성(compositing)만 되므로 부드럽다.
import { useEffect, useState, type ReactNode } from 'react'

type Phase = 'opening' | 'open' | 'closing'

interface Props {
  sourceRect: DOMRect
  // 확대 후 채울 영역. 그리드가 스크롤로 화면 밖까지 이어질 수 있으므로 호출부에서 화면에 보이는 부분으로 잘라서 넘긴다.
  targetRect: { top: number; left: number; width: number; height: number }
  onClosed: () => void
  children: ReactNode
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function PanelExpandOverlay({ sourceRect, targetRect, onClosed, children }: Props) {
  const [phase, setPhase] = useState<Phase>('opening')
  // 클릭 시점 기준으로 한 번만 고정 — 애니메이션 도중 다시 계산되지 않게.
  const [target] = useState(targetRect)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('open'))
    return () => cancelAnimationFrame(id)
  }, [])

  // 모션 감소 설정이면 transition이 없어서 transitionend가 오지 않는다 — 바로 닫는다.
  useEffect(() => {
    if (phase === 'closing' && prefersReducedMotion()) onClosed()
  }, [phase, onClosed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPhase('closing') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const requestClose = () => setPhase('closing')

  const scaleX = sourceRect.width / target.width
  const scaleY = sourceRect.height / target.height
  const translateX = sourceRect.left - target.left
  const translateY = sourceRect.top - target.top

  const transform = phase === 'open'
    ? 'translate(0, 0) scale(1, 1)'
    : `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`

  return (
    <>
      {/* 배경 클릭으로 닫기 위한 투명 캐처 (덮는 느낌을 위해 어둡게 하지 않는다) */}
      <div className="expand-overlay__backdrop" onClick={requestClose} />

      <div
        className="expand-overlay"
        role="dialog"
        aria-modal="true"
        onTransitionEnd={e => {
          // 자식(패널 hover 등)의 transitionend가 버블링되어 오는 것과 자기 자신의
          // transform 트랜지션이 끝난 것을 구분한다 — 안 그러면 애니메이션이 중간에 잘린다.
          if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
          if (phase === 'closing') onClosed()
        }}
        style={{ top: target.top, left: target.left, width: target.width, height: target.height, transform }}
      >
        <div className="expand-overlay__inner">
          <button type="button" className="expand-overlay__close" onClick={requestClose} title="닫기 (ESC)" aria-label="닫기">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          {children}
        </div>
      </div>
    </>
  )
}
