import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";

import { getInputTypeFromFile } from "@/api/client";
import type { ConversionOptions, InputType } from "@/api/types";

// Supported file types
const SUPPORTED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/webp",
];

export interface PendingFile {
  id: string;
  file: File;
  preview: string;
  inputType: InputType;
  options: ConversionOptions | null; // null = use global defaults
}

interface UploadState {
  files: PendingFile[];
  isUploading: boolean;
  selectedIds: Set<string>;

  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: (revokeUrls?: boolean) => void;
  setFileOptions: (id: string, options: ConversionOptions | null) => void;
  getFileOptions: (id: string) => ConversionOptions | null;
  setUploading: (value: boolean) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => ({
  files: [],
  isUploading: false,
  selectedIds: new Set(),

  addFiles: (files) =>
    set((state) => ({
      files: [
        ...state.files,
        ...files
          .filter((f) => SUPPORTED_TYPES.includes(f.type))
          .map((file) => ({
            id: uuidv4(),
            file,
            preview: URL.createObjectURL(file),
            inputType: getInputTypeFromFile(file),
            options: null,
          })),
      ],
    })),

  removeFile: (id) =>
    set((state) => {
      const file = state.files.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      const newSelectedIds = new Set(state.selectedIds);
      newSelectedIds.delete(id);
      return {
        files: state.files.filter((f) => f.id !== id),
        selectedIds: newSelectedIds,
      };
    }),

  clearFiles: (revokeUrls = true) =>
    set((state) => {
      if (revokeUrls) {
        state.files.forEach((f) => URL.revokeObjectURL(f.preview));
      }
      return { files: [], selectedIds: new Set() };
    }),

  setFileOptions: (id, options) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, options } : f)),
    })),

  getFileOptions: (id) => {
    const file = get().files.find((f) => f.id === id);
    return file?.options ?? null;
  },

  setUploading: (isUploading) => set({ isUploading }),

  toggleSelected: (id) =>
    set((state) => {
      const newSelectedIds = new Set(state.selectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return { selectedIds: newSelectedIds };
    }),

  selectAll: () =>
    set((state) => ({
      selectedIds: new Set(state.files.map((f) => f.id)),
    })),

  deselectAll: () => set({ selectedIds: new Set() }),
}));
