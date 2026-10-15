import { Page } from "../layout/Page";
import { LIBRARY, type RouteParams } from "../router";

/** One book at `/books/:id`. A stub until brief 10. */
export function BookPage({ params: _params }: { params: RouteParams<"book"> }) {
  return <Page title="Book" back={{ to: LIBRARY, label: "Library" }} />;
}
