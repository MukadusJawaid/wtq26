import type { IconName } from "@/components/ui/icon";

/** Suggested questions shown on the Ask step. The 12 scored questions come from level2.csv. */
export const SUGGESTED_QUESTIONS: { text: string; icon: IconName }[] = [
  { text: "How much of my bill is taxes?", icon: "tax" },
  { text: "How many months exceeded 200 units?", icon: "bars" },
  { text: "What do I pay if I'm late?", icon: "clock" },
  { text: "What is the FCA line?", icon: "bolt" },
  { text: "What will next month's bill be?", icon: "help" },
];
