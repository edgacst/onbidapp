import { launchPhone } from "./phone-launch.mjs";

launchPhone(["--port", "5173", "--server", "dev", "--keep-alive", "--no-browser"]).catch((error) => {
  console.error(error);
  process.exit(1);
});
