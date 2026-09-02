/* Test entry point: node test/run.js, or npm test which builds first. */
import { report } from "./harness.js";
import "./rules.test.js";
import "./scoring.test.js";
import "./seed.test.js";
import "./i18n.test.js";
import "./render.test.js";
import "./build.test.js";

process.exit(report() ? 1 : 0);
