import { Card, PageHead } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { DropZone } from "./drop-zone";

type Tip = { text: string; icon: IconName; no?: boolean };

const CARDS: { title: string; items: Tip[] }[] = [
  {
    title: "Accepted bills",
    items: [
      { text: "K-Electric electricity bill", icon: "check" },
      { text: "LESCO electricity bill", icon: "check" },
      { text: "IESCO electricity bill", icon: "check" },
      { text: "Any other bill or document is rejected", icon: "close", no: true },
    ],
  },
  {
    title: "For a great read",
    items: [
      { text: "Lay the bill flat in good light", icon: "check" },
      { text: "Keep all four corners in frame", icon: "check" },
      { text: "Tilted or partly Urdu is fine", icon: "check" },
      { text: "PNG or JPG, up to 10 MB", icon: "check" },
    ],
  },
];

export function UploadStep() {
  return (
    <>
      <PageHead
        eyebrow="Step 1 · Upload"
        title="Add your bill"
        sub="Upload a K-Electric, LESCO or IESCO electricity bill. Anything else will be rejected."
      />
      <div className="bento">
        <DropZone />
        {CARDS.map((card) => (
          <Card key={card.title} className="tipc">
            <h3>{card.title}</h3>
            <ul>
              {card.items.map((item) => (
                <li key={item.text} className={item.no ? "no" : undefined}>
                  <Icon name={item.icon} size={16} strokeWidth={3} />
                  {item.text}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
