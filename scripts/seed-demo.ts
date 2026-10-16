// Create the demo workspace (simulated messages and payments only).
import { ensureDemoWorkspace, DEMO_EMAIL } from "../lib/services/demo";

ensureDemoWorkspace()
  .then((r) => {
    console.log(`demo workspace ready: org ${r.orgId}, user ${DEMO_EMAIL}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
