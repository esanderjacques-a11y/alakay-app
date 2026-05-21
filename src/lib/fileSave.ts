type SavePicker = (options: {
  suggestedName?: string;
  types?: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: ArrayBuffer | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: SavePicker;
};

export async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
  extension: string,
  fallback?: () => void
) {
  const picker = (window as WindowWithSavePicker).showSaveFilePicker;
  const bytes = await blob.arrayBuffer();
  const signature = new TextDecoder().decode(bytes.slice(0, 5));

  if (signature !== "%PDF-") {
    fallback?.();
    return;
  }

  if (picker) {
    try {
      const handle = await picker({
        suggestedName,
        types: [
          {
            description: "PDF document",
            accept: {
              [mimeType]: [extension],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      fallback?.();
      return;
    }
  }

  if (fallback) {
    fallback();
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
