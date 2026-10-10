"use client";

import { useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useSampleBill } from "@/hooks/use-sample-bill";
import { fileSizeLabel } from "@/lib/format";
import { shrinkForUpload } from "@/lib/image-client";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { startDecode } from "@/store/decode-controller";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED = /^image\/(png|jpeg)$/;

/** Drag-and-drop / click-to-browse area that turns into a preview with the Decode action. */
export function DropZone() {
  const file = useAppStore((s) => s.file);
  const previewUrl = useAppStore((s) => s.previewUrl);
  const setFile = useAppStore((s) => s.setFile);
  const showToast = useAppStore((s) => s.showToast);
  const loadSample = useSampleBill();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function take(candidate: File | undefined) {
    if (!candidate) return;
    if (!ACCEPTED.test(candidate.type)) return showToast("Please choose a PNG or JPG image", true);
    if (candidate.size > MAX_UPLOAD_BYTES) return showToast("That image is over 10 MB. Try a smaller one.", true);
    setFile(await shrinkForUpload(candidate));
  }

  function remove() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const stop = (e: DragEvent) => e.preventDefault();

  return (
    <div
      className={cn("drop", "wide", file && "has", over && "over")}
      onDragEnter={(e) => (stop(e), setOver(true))}
      onDragOver={(e) => (stop(e), setOver(true))}
      onDragLeave={(e) => (stop(e), setOver(false))}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        take(e.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        aria-label="Upload a bill image"
        onChange={(e) => take(e.target.files?.[0])}
      />
      <div className="empty">
        <div className="ic" aria-hidden="true">
          <Icon name="upload" size={32} />
        </div>
        <h3>Drag and drop your bill here</h3>
        <p>or click to browse your files</p>
        <small>PNG or JPG · K-Electric, LESCO or IESCO bills only</small>
        <Button
          variant="sec"
          style={{ position: "relative", zIndex: 2, marginTop: 4 }}
          onClick={(e) => {
            e.stopPropagation();
            loadSample();
          }}
        >
          Try the sample bill (KESC_0008)
        </Button>
      </div>
      {file && previewUrl && (
        <div className="prev">
          <div className="thumbwrap">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset */}
            <img src={previewUrl} alt="Preview of the uploaded bill" />
            <div className="scan" aria-hidden="true" />
          </div>
          <div className="meta">
            <span className="name">
              {file.name} · {fileSizeLabel(file.size)}
            </span>
            <Badge tone="ok">Ready to decode</Badge>
          </div>
          <div className="acts">
            <Button variant="volt" onClick={() => startDecode()}>
              <span>Decode this bill</span>
              <Icon name="arrow" strokeWidth={2.4} />
            </Button>
            <Button variant="sec" onClick={remove}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
