// constants.js

const Z_INDEX = {
  FAB: '2147483647',
  FAB_MENU: '2147483648',
  MIC_ICON: '2147443646', // Lowered to be under FAB in detached mode
  TRANSCRIPTION_BUTTON: '2247483648',
  // START: MODIFIED CODE BLOCK
  SELECTOR_ICON: '2147483649' 
  // END: MODIFIED CODE BLOCK
};

const COLORS = {
  MIC_DEFAULT_BG: '#242424',
  MIC_HOVER_BG: '#3f3f3f',
  MIC_ACTIVE_BG: '#E53E3E',
  MIC_ICON_DEFAULT: '#afafaf',
  MIC_ICON_ACTIVE: '#FFFFFF',
  FAB_BG: '#242424',
  TRANSCRIPTION_BG: '#242424',
  TRANSCRIPTION_HOVER_BG: '#3f3f3f',
  // START: MODIFIED CODE BLOCK
  SELECTOR_DEFAULT_BG: '#242424',
  SELECTOR_HOVER_BG: '#3f3f3f',
  SELECTOR_ACTIVE_BG: '#E53E3E',
  SELECTOR_ICON_DEFAULT: '#afafaf',
  SELECTOR_ICON_ACTIVE: '#FFFFFF',
  DETACHED_DRAG_HANDLE: 'rgba(0,0,0,0.2)',
  DETACHED_DRAG_HANDLE_DOT: 'rgba(255,255,255,0.4)'
  // END: MODIFIED CODE BLOCK
};

const STYLES = {
  MIC_ICON: {
    position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
    backgroundColor: COLORS.MIC_DEFAULT_BG, display: 'none', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
    zIndex: Z_INDEX.MIC_ICON, transition: 'opacity 0.2s ease-in-out, background-color 0.2s ease',
    opacity: '0', pointerEvents: 'auto'
  },
  FAB: {
    position: 'absolute', top: '0', left: '0', width: '24px', height: '24px', borderRadius: '50%',
    backgroundColor: COLORS.FAB_BG, display: 'none', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', cursor: 'pointer',
    zIndex: Z_INDEX.FAB, transition: 'opacity 0.2s ease-in-out',
    opacity: '0', pointerEvents: 'auto'
  },
  TRANSCRIPTION_BUTTON: {
    position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
    backgroundColor: COLORS.TRANSCRIPTION_BG, display: 'none', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
    zIndex: Z_INDEX.TRANSCRIPTION_BUTTON, transition: 'transform 0.2s ease-out, background-color 0.2s ease',
    transform: 'translateY(10px)'
  },
  // START: MODIFIED CODE BLOCK
  SELECTOR_ICON: {
    position: 'relative', top: 'auto', right: 'auto', width: '32px', height: '32px',
    borderRadius: '50%', backgroundColor: COLORS.SELECTOR_DEFAULT_BG,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    zIndex: Z_INDEX.SELECTOR_ICON, transition: 'background-color 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  }
  // END: MODIFIED CODE BLOCK
};

const TIMING = {
  TYPING_DELAY: 1000,
  ICON_FADE_DURATION: 200,
  HOLD_DURATION: 200,
  FOCUS_OUT_DELAY: 400
};

const FAB_OUTPUT_STYLES = [
    { value: 'default', name: 'Clear' },
    { value: 'professional', name: 'Professional' },
    { value: 'friendly', name: 'Friendly' },
    { value: 'casual', name: 'Casual' },
    { value: 'technical', name: 'Technical' },
    { value: 'creative', name: 'Creative' }
];