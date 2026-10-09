import { Suspense } from "react";

import { PoiReviewPage } from "@/components/pages/poi-review-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PoiReviewPage />
    </Suspense>
  );
}
