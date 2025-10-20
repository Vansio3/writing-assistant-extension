// constants.js

const Z_INDEX = {
  FAB: '2147483647',
  FAB_MENU: '2147483648',
  MIC_ICON: '2147443646',
  TRANSCRIPTION_BUTTON: '2247483648',
  SELECTOR_ICON: '2147483649'
};

const COLORS = {
  MIC_DEFAULT_BG: '#242424',
  MIC_HOVER_BG: '#3f3f3f',
  MIC_ACTIVE_BG: '#E53E3E',
  MIC_ICON_DEFAULT: '#afafaf',
  MIC_ICON_ACTIVE: '#FFFFFF',
  FAB_BG: '#242424',
  FAB_HOVER_BG: '#3f3f3f',
  FAB_ICON: '#afafaf',
  FAB_MENU_BG: 'rgba(44, 45, 48, 0.9)',
  FAB_MENU_BUTTON_BG: '#3c3d41',
  FAB_MENU_BUTTON_HOVER_BG: '#4a4b50',
  TRANSCRIPTION_BG: '#242424',
  TRANSCRIPTION_HOVER_BG: '#3f3f3f',
  SELECTOR_DEFAULT_BG: '#242424',
  SELECTOR_HOVER_BG: '#3f3f3f',
  SELECTOR_ACTIVE_BG: '#E53E3E',
  SELECTOR_ICON_DEFAULT: '#afafaf',
  SELECTOR_ICON_ACTIVE: '#FFFFFF',
  DETACHED_DRAG_HANDLE: 'rgba(0,0,0,0.2)',
  DETACHED_DRAG_HANDLE_DOT: 'rgba(255,255,255,0.4)'
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
  FAB_SVG: {
    width: '10', height: '10', viewBox: '8 7 8 11', fill: 'none'
  },
  FAB_SVG_PATH: `<path d="M15.25 10.75L12 7.5L8.75 10.75" stroke="${COLORS.FAB_ICON}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.25 16.75L12 13.5L8.75 16.75" stroke="${COLORS.FAB_ICON}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  FAB_MENU: {
    position: 'fixed', zIndex: Z_INDEX.FAB_MENU, display: 'flex', flexDirection: 'row',
    gap: '6px', padding: '6px', backgroundColor: COLORS.FAB_MENU_BG, borderRadius: '20px',
    backdropFilter: 'blur(5px)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
  },
  FAB_MENU_BUTTON: {
    backgroundColor: COLORS.FAB_MENU_BUTTON_BG, color: '#e1e1e6', border: 'none',
    borderRadius: '14px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px',
    transition: 'background-color 0.2s ease'
  },
  TRANSCRIPTION_BUTTON: {
    position: 'absolute', top: '0', left: '0', width: '28px', height: '28px', borderRadius: '50%',
    backgroundColor: COLORS.TRANSCRIPTION_BG, display: 'none', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', cursor: 'pointer',
    zIndex: Z_INDEX.TRANSCRIPTION_BUTTON, transition: 'transform 0.2s ease-out, background-color 0.2s ease',
    transform: 'translateY(10px)'
  },
  SELECTOR_ICON: {
    position: 'relative', top: 'auto', right: 'auto', width: '18px', height: '18px',
    borderRadius: '50%', backgroundColor: COLORS.SELECTOR_DEFAULT_BG,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    zIndex: Z_INDEX.SELECTOR_ICON, transition: 'background-color 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  SELECTOR_SVG: {
    width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none',
    stroke: COLORS.SELECTOR_ICON_DEFAULT, 'stroke-width': '2.5',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  }
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