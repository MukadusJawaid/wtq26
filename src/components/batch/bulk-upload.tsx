"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Mascot } from "@/components/ui/mascot";
import { useBulkUpload, type BulkItem } from "@/hooks/use-bulk-upload";
import { fileSizeLabel, monthLabel, PROVIDER_LABEL, whole } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One-line result for a finished bill, built only from the extracted fields. */
function summary(item: BulkItem): string | null {
  const bill = item.analysis?.bill;
  if (!bill) return null;
  const amount = bill.payable_within_due_date ?? bill.current_bill;
  return [
    bill.provider && PROVIDER_LABEL[bill.provider],
    monthLabel(bill.bill_month),
    amount != null && `PKR ${whole(amount)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function BillTile({
  item,
  billId,
  index,
  questions,
}: {
  item: BulkItem;
  billId: string;
  index: number;
  questions: number;
}) {
  const { status } = item;
  const busy = status === "reading" || status === "answering";
  return (
    <li className={cn("btile", busy ? "reading" : status)} style={{ "--i": index } as CSSProperties}>
      <div className="bthumb">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not an optimisable asset */}
        <img src={item.previewUrl} alt="" />
        {busy && <i className="beam" aria-hidden="true" />}
        {status === "done" && (
          <span className="btick" aria-hidden="true">
            <Icon name="check" size={12} strokeWidth={3.4} />
          </span>
        )}
        {status === "failed" && (
          <span className="btick bad" aria-hidden="true">
            <Icon name="close" size={12} strokeWidth={3.4} />
          </span>
        )}
      </div>

      <div className="bmeta">
        <span className="bname" title={billId}>
          {item.file.name}
        </span>
        <span className="bstate" title={status === "failed" ? item.error : (summary(item) ?? undefined)}>
          {status === "queued" && `Waiting · ${fileSizeLabel(item.file.size)}`}
          {status === "reading" && (
            <>
              <i className="mini-spin" aria-hidden="true" /> Reading the bill…
            </>
          )}
          {status === "answering" && (
            <>
              <i className="mini-spin" aria-hidden="true" /> Answering {questions} questions…
            </>
          )}
          {status === "done" && [summary(item), item.answers && `${questions} answers`].filter(Boolean).join(" · ")}
          {status === "failed" && item.error}
        </span>
      </div>

      {busy && <i className="bbar" aria-hidden="true" />}
    </li>
  );
}

function FileRow({
  label,
  custom,
  note,
  disabled,
  onPick,
  onReset,
}: {
  label: string;
  custom: string | null;
  note: string;
  disabled: boolean;
  onPick: (file: File) => void;
  onReset: () => void;
}) {
  return (
    <span className="tpl-ok">
      <Icon name="check" size={14} strokeWidth={3} />
      {custom ? `${label} · your file: ${custom}` : `${label} · ${note}`}
      <label className="tpl-link">
        {custom ? "Replace" : "Upload your own"}
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          aria-label={`Upload your own ${label}`}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
      </label>
      {custom && (
        <button type="button" className="tpl-link" disabled={disabled} onClick={onReset}>
          Use preselected
        </button>
      )}
    </span>
  );
}

/**
 * The competition flow in the browser: add the bills, attach the supplied question file (level2.csv),
 * and download level1.csv and level2.csv written from the model's results.
 */
export function BulkUpload() {
  const bulk = useBulkUpload();
  const { items, ids, running, counts } = bulk;
  const has = items.length > 0;
  const settled = counts.done + counts.failed;
  const allDone = has && !running && counts.done === counts.total;
  const readsOnly = !bulk.hasQuestions;

  const runLabel = running
    ? "Working…"
    : counts.pending === 0
      ? "All done"
      : counts.failed && counts.pending === counts.failed
        ? `Retry ${counts.failed} failed`
        : `${readsOnly ? "Read" : "Read and answer"} ${counts.pending} bill${counts.pending === 1 ? "" : "s"}`;

  return (
    <Card className="bulk">
      <div className="bulk-head">
        <div>
          <h3>Generate the CSV files</h3>
          <p>
            level1.csv, level2.csv and the supplied bills are already selected. Press Generate output and Wattwise reads each bill,
            answers its questions, then lets you download the new level1.csv and level2.csv. Upload your own files only if you want to replace them.
          </p>
        </div>
        {has && (
          <Badge tone="pri">
            {counts.done} of {counts.total} done
          </Badge>
        )}
      </div>

      {has && (
        <div
          className="bprog"
          role="progressbar"
          aria-label="Bills finished"
          aria-valuemin={0}
          aria-valuemax={counts.total}
          aria-valuenow={settled}
        >
          <i style={{ width: `${(settled / counts.total) * 100}%` }} />
        </div>
      )}

      {(!has || running) && (
      <div className="tpl">
        {!has && (
        <div className="tpl-text">
          <b>Selected files</b>
          {!bulk.templatesLoaded ? (
            <span className="tpl-hint">Loading level1.csv and level2.csv…</span>
          ) : (
            <>
              <FileRow
                label="level1.csv"
                custom={bulk.customFiles.level1}
                note={bulk.hasLevel1Template ? "preselected" : "not found"}
                disabled={running}
                onPick={(f) => void bulk.chooseTemplate("level1", f)}
                onReset={() => bulk.resetTemplate("level1")}
              />
              <FileRow
                label="level2.csv"
                custom={bulk.customFiles.level2}
                note={bulk.hasQuestions ? `preselected · ${counts.questionsPerBill} questions per bill` : "not found"}
                disabled={running}
                onPick={(f) => void bulk.chooseTemplate("level2", f)}
                onReset={() => bulk.resetTemplate("level2")}
              />
            </>
          )}
          {!has && (
            <span className="tpl-ok">
              {bulk.defaultBillCount > 0 ? (
                <>
                  <Icon name="check" size={14} strokeWidth={3} /> {bulk.defaultBillCount} bills preselected
                </>
              ) : (
                <span className="tpl-warn-inline">
                  No bill images found in test/bills. Put the bills (named like KESC_0002.png) in that folder and refresh, or run: npm run generate -- --bills &lt;folder&gt;
                </span>
              )}
              <label className="tpl-link">
                Upload your own
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg"
                  aria-label="Upload your own bill images"
                  onChange={(e) => {
                    void bulk.add([...(e.target.files ?? [])]);
                    e.target.value = "";
                  }}
                />
              </label>
            </span>
          )}
        </div>
        )}
        {running && (
          <div className="tpl-busy" role="status">
            <div className="tpl-mascot">
              <Mascot state="load" />
            </div>
            <span>
              Generating your files…
              <small>
                {counts.done} of {counts.total} bills done
              </small>
            </span>
          </div>
        )}
      </div>
      )}

      {bulk.missingBills.length > 0 && has && (
        <p className="tpl-warn" role="status">
          The question file lists {bulk.missingBills.length} bill{bulk.missingBills.length > 1 ? "s" : ""} you haven&apos;t added yet:{" "}
          {bulk.missingBills.slice(0, 6).join(", ")}
          {bulk.missingBills.length > 6 && "…"}
        </p>
      )}

      {has && (
        <ul className="bgrid">
          {items.map((item, i) => (
            <BillTile
              key={item.id}
              item={item}
              billId={ids[i]}
              index={i}
              questions={counts.questionsPerBill}
            />
          ))}
        </ul>
      )}

      {(
        <div className="bulk-actions">
          <Button variant="volt" disabled={running || !bulk.hasQuestions || (has ? counts.pending === 0 : bulk.defaultBillCount === 0)} onClick={() => void bulk.generate()}>
            {has ? runLabel : "Generate output"}
          </Button>
          <Button variant="pri" disabled={!allDone} onClick={bulk.downloadLevel1}>
            <Icon name="arrow" size={16} strokeWidth={2.4} className="down" />
            Download level1.csv
          </Button>
          <Button variant="pri" disabled={!allDone || !bulk.hasQuestions} onClick={bulk.downloadLevel2}>
            <Icon name="arrow" size={16} strokeWidth={2.4} className="down" />
            Download level2.csv
          </Button>
          {has && (
            <Button variant="sec" disabled={running} onClick={bulk.clear}>
              Clear
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
