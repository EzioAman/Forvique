import { readAccepted } from "../accepted";
import { Demo } from "./Demo";

export default function WatcherCheck() {
  return <Demo accepted={"watcher" in readAccepted()} />;
}
