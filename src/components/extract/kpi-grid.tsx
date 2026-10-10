import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fixed2, linesAddUp, PROVIDER_LABEL, whole } from "@/lib/format";
import type { Bill } from "@/lib/bill/types";

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <Badge tone="pri">{label}</Badge>;
  return ok ? <Badge tone="ok">✓ lines add up</Badge> : <Badge tone="warn">! lines differ from total</Badge>;
}

function Kpi({ label, value, badge }: { label: string; value: string; badge: React.ReactNode }) {
  return (
    <Card className="kpi">
      <div className="l">{label}</div>
      <div className="v">{value}</div>
      <div className="s">{badge}</div>
    </Card>
  );
}

/** Four at-a-glance numbers; the charge/tax cards verify that line items match the printed totals. */
export function KpiGrid({ bill }: { bill: Bill }) {
  const provider = [bill.provider && PROVIDER_LABEL[bill.provider], bill.tariff].filter(Boolean).join(" · ");
  const readings =
    bill.previous_reading != null && bill.current_reading != null
      ? `${whole(bill.previous_reading)} → ${whole(bill.current_reading)}`
      : "readings not printed";

  return (
    <div className="kpis">
      <Kpi label="Billing month" value={bill.bill_month ?? "n/a"} badge={<Badge tone="pri">{provider || "provider unknown"}</Badge>} />
      <Kpi label="Units used" value={whole(bill.units_consumed)} badge={<Badge tone="pri">{readings}</Badge>} />
      <Kpi
        label="Charges"
        value={bill.total_charges == null ? "n/a" : fixed2(bill.total_charges)}
        badge={<Check ok={linesAddUp(bill.charges, bill.total_charges)} label="no subtotal to check" />}
      />
      <Kpi
        label="Taxes"
        value={bill.total_taxes == null ? "n/a" : fixed2(bill.total_taxes)}
        badge={<Check ok={linesAddUp(bill.taxes, bill.total_taxes)} label="no line items to check" />}
      />
    </div>
  );
}
