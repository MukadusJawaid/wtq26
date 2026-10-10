"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PageHead } from "@/components/ui/card";
import { CHARGE_LABELS, TAX_LABELS } from "@/lib/labels";
import { STEPS, useAppStore } from "@/store/app-store";
import { AmountBanner } from "./amount-banner";
import { DocViewer } from "./doc-viewer";
import { KpiGrid } from "./kpi-grid";
import { LineItems } from "./line-items";
import { ReadingsGrid } from "./readings-grid";

export function ExtractStep() {
  const analysis = useAppStore((s) => s.analysis);
  const go = useAppStore((s) => s.go);

  if (!analysis) {
    return (
      <>
        <PageHead eyebrow="Your bill" title="Your bill, decoded" />
        <EmptyState
          title="No bill decoded yet"
          text="Upload a bill and press Decode. The details will appear here."
          action={<Button variant="volt" onClick={() => go(STEPS.upload)}>Go to upload</Button>}
        />
      </>
    );
  }

  const { bill } = analysis;
  return (
    <>
      <PageHead eyebrow="Your bill" title="Your bill, decoded" />
      <div className="split fit-body">
        <DocViewer />
        <div className="pane-scroll">
          <AmountBanner bill={bill} />
          <KpiGrid bill={bill} />

          <Collapsible
            defaultOpen
            title="Itemised charges"
            badge={<Badge tone="warn">Subsidies appear as negatives</Badge>}
          >
            <LineItems items={bill.charges} labels={CHARGE_LABELS} totalLabel="Total charges" total={bill.total_charges} />
          </Collapsible>
          <Collapsible title="Taxes and duties">
            <LineItems items={bill.taxes} labels={TAX_LABELS} totalLabel="Total taxes" total={bill.total_taxes} />
          </Collapsible>
          <Collapsible title="Readings and dates">
            <ReadingsGrid bill={bill} />
          </Collapsible>

          <div className="nextrow">
            <Button variant="volt" onClick={() => go(STEPS.ask)}>
              <span>Ask about this bill</span>
              <Icon name="arrow" strokeWidth={2.4} />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
