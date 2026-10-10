import { FeatureCarousel } from "./feature-carousel";
import { Hero } from "./hero";

export function HomeStep() {
  return (
    <div className="bento">
      <Hero />
      <FeatureCarousel />
    </div>
  );
}
