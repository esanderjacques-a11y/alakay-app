type SavePicker = (options: {
  suggestedName?: string;
  types?: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: ArrayBuffer | Uint8Array | Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

type WindowWithSavePicker = Window & {
  showSaveFilePicker?: SavePicker;
};

type NavigatorWithActivation = Navigator & {
  userActivation?: { isActive?: boolean; hasBeenActive?: boolean };
};

/** Prevents concurrent exports from stacking multiple save dialogs. */
let saveInFlight = false;

function triggerAnchorDownload(blob: Blob, suggestedName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isNotAllowedError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "NotAllowedError") ||
    (error instanceof Error && /not allowed/i.test(error.message))
  );
}

/**
 * File System Access APIs require a transient user gesture. PDF builds are
 * async (logo fetch, layout), so the gesture is usually gone by save time.
 */
function canUseSavePicker() {
  const picker = (window as WindowWithSavePicker).showSaveFilePicker;
  if (typeof picker !== "function") return false;
  const activation = (navigator as NavigatorWithActivation).userActivation;
  // If the browser exposes userActivation and the gesture is gone, skip picker.
  if (activation && activation.isActive === false) return false;
  return true;
}

async function writePdfToHandle(
  handle: {
    createWritable: () => Promise<{
      write: (data: ArrayBuffer | Uint8Array | Blob | string) => Promise<void>;
      close: () => Promise<void>;
    }>;
  },
  pdfBlob: Blob
) {
  const writable = await handle.createWritable();
  try {
    await writable.write(pdfBlob);
  } catch {
    await writable.write(new Uint8Array(await pdfBlob.arrayBuffer()));
  }
  await writable.close();
}

function downloadPdf(
  pdfBlob: Blob,
  suggestedName: string,
  fallback?: () => void
) {
  if (fallback) {
    fallback();
    return;
  }
  triggerAnchorDownload(pdfBlob, suggestedName);
}

export async function saveBlobWithPicker(
  blob: Blob,
  suggestedName: string,
  mimeType: string,
  extension: string,
  fallback?: () => void
) {
  if (saveInFlight) return;
  saveInFlight = true;

  try {
    const bytes = await blob.arrayBuffer();
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    const pdfBlob =
      blob.type === mimeType
        ? blob
        : new Blob([bytes], { type: mimeType });

    if (signature !== "%PDF-") {
      downloadPdf(pdfBlob, suggestedName, fallback);
      return;
    }

    // After async PDF work the user gesture is typically expired — prefer a
    // normal download instead of a blocked File System Access call.
    if (!canUseSavePicker()) {
      downloadPdf(pdfBlob, suggestedName, fallback);
      return;
    }

    const picker = (window as WindowWithSavePicker).showSaveFilePicker!;
    let picked = false;
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
      picked = true;
      await writePdfToHandle(handle, pdfBlob);
    } catch (error) {
      if (isAbortError(error)) return;

      // NotAllowedError (lost gesture / permission) and other write failures:
      // fall back to jsPDF.save / anchor download so export still works.
      if (picked || isNotAllowedError(error)) {
        downloadPdf(pdfBlob, suggestedName, fallback);
        return;
      }

      downloadPdf(pdfBlob, suggestedName, fallback);
    }
  } finally {
    saveInFlight = false;
  }
}
