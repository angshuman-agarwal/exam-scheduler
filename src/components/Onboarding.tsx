import CustomSubjectWizard from './CustomSubjectWizard'
import { useOnboardingController } from './onboarding/useOnboardingController'
import MobileFlow from './onboarding/MobileFlow'
import DesktopFlow from './onboarding/DesktopFlow'

interface OnboardingProps {
  mode?: 'initial' | 'edit'
  onComplete: () => void
  onCancel?: () => void
  onBackToHome?: () => void
}

export default function Onboarding({ mode = 'initial', onComplete, onCancel, onBackToHome }: OnboardingProps) {
  const ctrl = useOnboardingController({ mode, onComplete, onCancel, onBackToHome })

  // Qualification picker (initial mode only, when studyMode is null)
  if (ctrl.studyMode === null && mode === 'initial') {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-8">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200/80 bg-white text-gray-700 text-sm font-semibold tracking-tight pl-1.5 pr-4 py-1.5 shadow-sm hover:bg-gray-50 hover:shadow-md hover:border-gray-300/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all duration-150 mb-6"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-xl bg-slate-100">
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </span>
              Back to home
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
            What are you studying?
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-10">
            We'll tailor subjects, boards, and exam dates to this course type.
          </p>

          <div className="flex flex-col md:flex-row gap-4">
            <button
              data-testid="qual-gcse"
              onClick={() => { ctrl.resetForQualificationChange(); ctrl.setLocalStudyMode('gcse') }}
              className="flex-1 rounded-2xl border-2 border-gray-100 bg-white p-6 text-left transition-all hover:border-blue-500 hover:ring-2 hover:ring-blue-100 hover:shadow"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">GCSE</h3>
              <p className="text-sm text-gray-500">Typical Year 10-11 subjects and papers</p>
            </button>
            <button
              data-testid="qual-alevel"
              onClick={() => { ctrl.resetForQualificationChange(); ctrl.setLocalStudyMode('alevel') }}
              className="flex-1 rounded-2xl border-2 border-gray-100 bg-white p-6 text-left transition-all hover:border-blue-500 hover:ring-2 hover:ring-blue-100 hover:shadow"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">A-Level</h3>
              <p className="text-sm text-gray-500">Sixth-form subjects and exam structure</p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Determine back button behavior for desktop
  const showBackButton = ctrl.isEdit
    ? false
    : !ctrl.persistedStudyMode
      ? true // "Change qualification"
      : !!onBackToHome // "Back to home"
  const backLabel = !ctrl.isEdit && !ctrl.persistedStudyMode
    ? 'Change qualification'
    : 'Back to home'
  const handleDesktopBack = !ctrl.isEdit && !ctrl.persistedStudyMode
    ? () => { ctrl.resetForQualificationChange(); ctrl.setLocalStudyMode(null) }
    : onBackToHome

  // Mobile back: in edit mode prefer onCancel, then onBackToHome
  const mobileBackHandler = !ctrl.isEdit && !ctrl.persistedStudyMode
    ? () => { ctrl.resetForQualificationChange(); ctrl.setLocalStudyMode(null) }
    : ctrl.isEdit
      ? (onCancel ?? onBackToHome ?? null)
      : (onBackToHome ?? null)
  // handleMobileBack fallback removed — null hides the button on mobile

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Mobile flow */}
      <div className="md:hidden">
        <MobileFlow ctrl={ctrl} onBack={mobileBackHandler} />
      </div>

      {/* Desktop flow */}
      <div className="hidden md:block">
        <DesktopFlow
          ctrl={ctrl}
          onBack={handleDesktopBack}
          showBackButton={showBackButton}
          backLabel={backLabel}
          onCancel={ctrl.isEdit ? onCancel : undefined}
        />
      </div>

      {/* Wizard overlay */}
      {ctrl.wizardMode && ctrl.studyMode && (
        <CustomSubjectWizard
          studyMode={ctrl.studyMode}
          mode={ctrl.wizardMode}
          onClose={() => ctrl.setWizardMode(null)}
          draftMode={!ctrl.isEdit}
          onDraftCreated={ctrl.handleDraftCreated}
          onCreated={ctrl.handleWizardCreated}
          allSubjects={ctrl.subjects}
          allOfferings={ctrl.offerings}
          onExistingOffering={ctrl.handleExistingOffering}
        />
      )}
    </div>
  )
}
