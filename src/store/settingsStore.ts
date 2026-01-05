import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ConversionOptions, TransposeValue } from "@/api/types";

interface SettingsState {
  globalOptions: ConversionOptions;
  queueConcurrency: number;
  backgroundImageFile: File | null;
  setGlobalOptions: (options: Partial<ConversionOptions>) => void;
  setQueueConcurrency: (value: number) => void;
  setBackgroundImageFile: (file: File | null) => void;
  resetToDefaults: () => void;
}

const DEFAULT_OPTIONS: ConversionOptions = {
  width: null,
  height: null,
  transpose: 0,
  input_fps: null,
  output_fps: null,
  minterpolate_fps: null,
  background_color: null,
  background_image_id: null,
  compress_output: false,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      globalOptions: DEFAULT_OPTIONS,
      queueConcurrency: 2,
      backgroundImageFile: null,

      setGlobalOptions: (options) =>
        set((state) => ({
          globalOptions: { ...state.globalOptions, ...options },
        })),

      setQueueConcurrency: (value) =>
        set({ queueConcurrency: Math.max(1, Math.min(10, value)) }),

      setBackgroundImageFile: (file) => set({ backgroundImageFile: file }),

      resetToDefaults: () =>
        set({
          globalOptions: DEFAULT_OPTIONS,
          queueConcurrency: 2,
          backgroundImageFile: null,
        }),
    }),
    {
      name: "gif-converter-settings",
      partialize: (state) => ({
        globalOptions: state.globalOptions,
        queueConcurrency: state.queueConcurrency,
        // Don't persist backgroundImageFile - it's a File object
      }),
    }
  )
);

export { DEFAULT_OPTIONS };
