"use client";

import { Badge } from "@/components/ui/badge";
import { useCountUp } from "@/hooks/use-count-up";
import { lateExtra, longDate, whole } from "@/lib/format";
import type { Bill } from "@/lib/bill/types";

/** The headline: what to pay, by when, and what lateness costs. All from the extracted bill. */
export function AmountBanner({ bill }: { bill: Bill }) {
  const amount = bill.payable_within_due_date ?? bill.current_bill;
  const animated = useCountUp(amount);
  const due = longDate(bill.due_date);
  const extra = lateExtra(bill);

  return (
    <div className="banner">
      <div className="l">Amount to pay</div>
      <div className="v">
        PKR {amount == null ? "n/a" : animated != null && animated !== amount ? Math.round(animated).toLocaleString("en-US") : whole(amount)}
      </div>
      <div className="by">{due ? `by ${due}` : "no due date printed"}</div>
      <div className="brow">
        {bill.payable_after_due_date != null && (
          <Badge tone="late">After the due date: PKR {whole(bill.payable_after_due_date)}</Badge>
        )}
        {extra != null && extra > 0 && <Badge>Pay on time to avoid PKR {whole(extra)} extra</Badge>}
      </div>
    </div>
  );
}
