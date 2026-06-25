import Cursor from "@/components/Cursor";
import ExploreClient from "./ExploreClient";

export const metadata = {
  title: "vasudevan.ai · explore (3D)",
  description: "An immersive 3D entry to Vasudevan's portfolio.",
};

export default function ExplorePage() {
  return (
    <>
      <Cursor />
      <ExploreClient />
    </>
  );
}
