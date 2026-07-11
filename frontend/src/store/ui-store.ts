import { create } from "zustand";

interface UIStore {
  isCategoryMenuOpen: boolean;
  openCategoryMenu: () => void;
  closeCategoryMenu: () => void;
  toggleCategoryMenu: () => void;
}

/**
 * Not persisted — this is purely transient UI state for the current page
 * view (whether the floating category menu overlay is open). Used to:
 *   1. Hide the bottom nav while the category menu is open
 *   2. Show the premium back button while the category menu is open
 *
 * CategoryDrawer.tsx should call openCategoryMenu()/closeCategoryMenu()
 * wherever it currently manages its own open/closed state.
 */
export const useUIStore = create<UIStore>()((set) => ({
  isCategoryMenuOpen: false,
  openCategoryMenu: () => set({ isCategoryMenuOpen: true }),
  closeCategoryMenu: () => set({ isCategoryMenuOpen: false }),
  toggleCategoryMenu: () => set((s) => ({ isCategoryMenuOpen: !s.isCategoryMenuOpen })),
}));
