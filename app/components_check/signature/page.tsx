import { readAccepted } from "../accepted";
import { Demo } from "./Demo";

export default function SignatureCheck() {
  return <Demo accepted={"signature" in readAccepted()} />;
}
