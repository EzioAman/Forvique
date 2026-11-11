import { readAccepted } from "../accepted";
import { Demo } from "./Demo";

export default function GenerateCheck() {
  return <Demo accepted={"generate" in readAccepted()} />;
}
