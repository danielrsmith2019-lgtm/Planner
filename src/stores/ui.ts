import { create, type StateCreator } from "zustand";
import { addDays, type LocalDate } from "@/lib/domain/dates";
import type { DayMode } from "@/lib/domain/mode";

/**
 * UI state only (blueprint: selected date, mode, panel state). Server data
 * lives in TanStack Query, never here.
 *
 * Dates start as null and are filled in on the client by syncClock(), which
 * the Header calls with getLocalToday(user) and getDefaultMode(). Nothing is
 * set during server rendering, so this module-level store is never shared
 * between users.
 */
export type UiState = {
  /** The user's current day (getLocalToday). */
  today: LocalDate | null;
  /** The day being viewed. */
  selectedDate: LocalDate | null;
  mode: DayMode;
  /** True once the user picks a mode by hand; the clock stops changing it. */
  modeOverridden: boolean;
  quickAddOpen: boolean;

  /** Called on first load and whenever the app regains focus. */
  syncClock: (clock: { today: LocalDate; defaultMode: DayMode }) => void;
  setSelectedDate: (date: LocalDate) => void;
  shiftSelectedDate: (days: number) => void;
  goToToday: () => void;
  setMode: (mode: DayMode) => void;
  clearModeOverride: (defaultMode: DayMode) => void;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
};

export const createUiState: StateCreator<UiState> = (set) => ({
  today: null,
  selectedDate: null,
  mode: "plan",
  modeOverridden: false,
  quickAddOpen: false,

  syncClock: ({ today, defaultMode }) =>
    set((state) => {
      // First load.
      if (state.today === null) {
        return { today, selectedDate: state.selectedDate ?? today, mode: state.modeOverridden ? state.mode : defaultMode };
      }
      // The day rolled over while the app was open: follow it if the user
      // was looking at "today", and let the clock pick the mode again.
      if (state.today !== today) {
        return {
          today,
          selectedDate: state.selectedDate === state.today ? today : state.selectedDate,
          mode: defaultMode,
          modeOverridden: false,
        };
      }
      return state.modeOverridden ? {} : { mode: defaultMode };
    }),

  setSelectedDate: (date) => set({ selectedDate: date }),
  shiftSelectedDate: (days) =>
    set((state) => (state.selectedDate === null ? {} : { selectedDate: addDays(state.selectedDate, days) })),
  goToToday: () => set((state) => (state.today === null ? {} : { selectedDate: state.today })),
  setMode: (mode) => set({ mode, modeOverridden: true }),
  clearModeOverride: (defaultMode) => set({ mode: defaultMode, modeOverridden: false }),
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
});

export const useUiStore = create<UiState>()(createUiState);
