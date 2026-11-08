import { readAccepted } from "../accepted";
import { Demo } from "./Demo";

export default function SeekCheck() {
  return <Demo accepted={"seek" in readAccepted()} />;
}
