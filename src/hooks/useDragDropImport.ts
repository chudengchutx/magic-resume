import { useState, useEffect, useCallback, useRef } from "react";

interface UseDragDropImportOptions {
  onJsonDrop: (file: File) => Promise<void>;
  onPdfDrop: (file: File) => Promise<void>;
  disabled?: boolean;
}

/**
 * Hook to handle drag & drop file import on a container element.
 * Supports .json and .pdf files.
 */
export function useDragDropImport({
  onJsonDrop,
  onPdfDrop,
  disabled = false,
}: UseDragDropImportOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
    },
    [disabled]
  );

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const name = file.name.toLowerCase();

      if (name.endsWith(".json")) {
        await onJsonDrop(file);
      } else if (name.endsWith(".pdf")) {
        await onPdfDrop(file);
      }
    },
    [disabled, onJsonDrop, onPdfDrop]
  );

  useEffect(() => {
    if (disabled) return;

    const el = document;
    el.addEventListener("dragenter", handleDragEnter);
    el.addEventListener("dragleave", handleDragLeave);
    el.addEventListener("dragover", handleDragOver);
    el.addEventListener("drop", handleDrop);

    return () => {
      el.removeEventListener("dragenter", handleDragEnter);
      el.removeEventListener("dragleave", handleDragLeave);
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("drop", handleDrop);
    };
  }, [disabled, handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  return { isDragging };
}
