// Audio
export const AUDIO_VOLUME = 0.3;

// Timing
export const TRANSITION_DELAY_MS = 600;
export const THINKING_TIME_MS = { min: 1000, max: 3000 };
export const getThinkingTime = () =>
  THINKING_TIME_MS.min + Math.random() * (THINKING_TIME_MS.max - THINKING_TIME_MS.min);

// Addresses
export const AI_OPPONENT_ADDRESS = '0x0000000000000000000000000000000000000000';

// Menu animation
export const MENU_ACCENT_CELLS = [0, 6, 12, 18, 24];
export const MENU_ANIMATION_DELAY_INCREMENT = 0.05;

// Units
export const UNIT_CONFIG = [
  { name: 'Assassin', emoji: '🗡️', type: 'assassin' },
  { name: 'Guard', emoji: '🛡️', type: 'guard' },
  { name: 'Guard', emoji: '🛡️', type: 'guard' },
  { name: 'Decoy', emoji: '👤', type: 'decoy' },
  { name: 'Decoy', emoji: '👤', type: 'decoy' },
] as const;

export const UNIT_NAMES = UNIT_CONFIG.map(u => u.name);
export const UNIT_EMOJIS = UNIT_CONFIG.map(u => u.emoji);

// Board
export const INITIAL_EMPTY_BOARD = {
  assassinPos: -1,
  guard1Pos: -1,
  guard2Pos: -1,
  decoy1Pos: -1,
  decoy2Pos: -1,
};
