"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";

const MIN = 60;
const MAX = 220;
const STEP = 20;

/** The uploaded bill with zoom controls. */
export function DocViewer() {
  const file = useAppStore((s) => s.file);
  const previewUrl = useAppStore((s) => s.previewUrl);
  const [zoom, setZoom] = useState(100);
  const change = (d: number) => setZoom((z) => Math.max(MIN, Math.min(MAX, z + d)));

  return (
    <Card className="doc">
      <div className="tb">
        <span className="fn">{file?.name}</span>
        <div className="zoom">
          <button type="button" aria-label="Zoom out" onClick={() => change(-STEP)}>
            −
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => change(STEP)}>
            +
          </button>
        </div>
      </div>
      <div className="viewer">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset
          <img src={previewUrl} alt="The uploaded electricity bill" style={{ width: `${zoom}%` }} />
        )}
      </div>
    </Card>
  );
}
