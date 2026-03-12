import { useEffect, useRef } from 'react'
import type { OnboardingController } from './useOnboardingController'
import MobileSubjectPicker from './MobileSubjectPicker'
import MobileSubjectConfig from './MobileSubjectConfig'

interface MobileFlowProps {
  ctrl: OnboardingController
  onBack?: (() => void) | null
}

export default function MobileFlow({ ctrl, onBack }: MobileFlowProps) {
  const scrollPositionRef = useRef(0)

  // Scroll to top when entering config, preserve picker scroll via ref
  useEffect(() => {
    if (ctrl.mobileStep === 'configure') {
      scrollPositionRef.current = window.scrollY
      window.scrollTo(0, 0)
    } else {
      // Restore picker scroll
      window.scrollTo(0, scrollPositionRef.current)
    }
  }, [ctrl.mobileStep])

  if (ctrl.mobileStep === 'configure') {
    return <MobileSubjectConfig ctrl={ctrl} />
  }

  return <MobileSubjectPicker ctrl={ctrl} onBack={onBack} />
}
