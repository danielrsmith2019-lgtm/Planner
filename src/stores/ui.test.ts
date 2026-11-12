import { beforeEach, describe, expect, it } from "vitest";
import { createStore, type StoreApi } from "zustand/vanilla";
import { createUiState, type UiState } from "./ui";

let store: StoreApi<UiState>;
const state = () => store.getState();

beforeEach(() => {
  store = createStore<UiState>()(createUiState);
});

describe("ui store", () => {
  it("starts empty until the clock is synced", () => {
    expect(state()).toMatchObject({ today: null, selectedDate: null, mode: "plan", modeOverridden: false });
  });

  it("fills today, the selected date and the default mode on first sync", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "do" });
    expect(state()).toMatchObject({ today: "2026-11-12", selectedDate: "2026-11-12", mode: "do" });
  });

  it("moves the selected date and jumps back to today", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "plan" });
    state().shiftSelectedDate(-1);
    expect(state().selectedDate).toBe("2026-11-11");
    state().shiftSelectedDate(7);
    expect(state().selectedDate).toBe("2026-11-18");
    state().goToToday();
    expect(state().selectedDate).toBe("2026-11-12");
    state().setSelectedDate("2026-12-31");
    state().shiftSelectedDate(1);
    expect(state().selectedDate).toBe("2027-01-01");
  });

  it("keeps a hand-picked mode when the clock syncs again the same day", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "plan" });
    state().setMode("reflect");
    state().syncClock({ today: "2026-11-12", defaultMode: "do" });
    expect(state()).toMatchObject({ mode: "reflect", modeOverridden: true });
  });

  it("updates the mode with the clock when nothing was picked by hand", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "plan" });
    state().syncClock({ today: "2026-11-12", defaultMode: "do" });
    expect(state().mode).toBe("do");
  });

  it("follows the rollover to a new day if the user was looking at today", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "reflect" });
    state().setMode("do");
    state().syncClock({ today: "2026-11-13", defaultMode: "plan" });
    expect(state()).toMatchObject({ today: "2026-11-13", selectedDate: "2026-11-13", mode: "plan", modeOverridden: false });
  });

  it("stays on a browsed day across the rollover", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "reflect" });
    state().setSelectedDate("2026-11-20");
    state().syncClock({ today: "2026-11-13", defaultMode: "plan" });
    expect(state().selectedDate).toBe("2026-11-20");
  });

  it("clears the override back to the clock's mode", () => {
    state().syncClock({ today: "2026-11-12", defaultMode: "plan" });
    state().setMode("reflect");
    state().clearModeOverride("plan");
    expect(state()).toMatchObject({ mode: "plan", modeOverridden: false });
  });

  it("opens and closes quick add", () => {
    state().openQuickAdd();
    expect(state().quickAddOpen).toBe(true);
    state().closeQuickAdd();
    expect(state().quickAddOpen).toBe(false);
  });
});
