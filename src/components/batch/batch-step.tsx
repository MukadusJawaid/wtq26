import { PageHead } from "@/components/ui/card";
import { BulkUpload } from "./bulk-upload";

export function BatchStep() {
  return (
    <>
      <PageHead
        eyebrow="Batch run"
        title="Generate level1.csv and level2.csv"
        sub="Everything is preselected. Press Generate output, then download the new level1.csv and level2.csv."
      />
      <BulkUpload />
    </>
  );
}
