import { launchPhone } from "./phone-launch.mjs";

await launchPhone(["--port", "5173", "--server", "dev", "--keep-alive"]);
