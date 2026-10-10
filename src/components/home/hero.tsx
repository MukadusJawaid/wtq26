"use client";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { useSampleBill } from "@/hooks/use-sample-bill";
import { STEPS, useAppStore } from "@/store/app-store";

const PROVIDERS = ["K-Electric", "LESCO", "IESCO"];

export function Hero() {
  const go = useAppStore((s) => s.go);
  const loadSample = useSampleBill();

  return (
    <div className="hero-card wide">
      <div className="hero-mascot" aria-hidden="true">
        <Mascot state="idle" />
      </div>
      <div>
        <Eyebrow>AI utility bill analysis</Eyebrow>
        <h1>
          Decode any electricity bill in <span className="hl">plain language.</span>
        </h1>
        <p className="lead">
          Add a scan, screenshot or photo. We read every line, pull out the numbers exactly as printed, then
          answer your questions using only what is on the bill.
        </p>
        <div className="hero-cta">
          <Button variant="volt" big onClick={() => go(STEPS.upload)}>
            <Icon name="upload" size={20} strokeWidth={2.6} />
            Upload your bill
          </Button>
          <Button variant="ghost" onClick={() => loadSample({ goTo: STEPS.upload })}>
            Try the sample bill
          </Button>
        </div>
      </div>
      <div className="provs">
        <small>Supports</small>
        {PROVIDERS.map((p) => (
          <span key={p} className="prov">
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
