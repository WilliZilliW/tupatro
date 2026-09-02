/* Minimal assertion harness. No dependencies on purpose: the project ships none,
   and the rule functions are pure, so a test runner would be the only devDep
   doing real work here. */
let pass = 0;
const failures = [];
let current = "";

export function group(name) {
  current = name;
  console.log("\n" + name);
}

export function ok(name, cond, extra) {
  if (cond) {
    pass++;
    return;
  }
  failures.push({ group: current, name, extra });
}

export function eq(name, got, want) {
  ok(name, got === want, "got " + JSON.stringify(got) + ", expected " + JSON.stringify(want));
}

export function near(name, got, want) {
  ok(name, Math.abs(got - want) < 1e-6, "got " + got + ", expected " + want);
}

export function report() {
  console.log("\n" + "-".repeat(52));
  if (failures.length) {
    console.log("FAILED:");
    for (const f of failures) {
      console.log(`  x [${f.group}] ${f.name}` + (f.extra ? `  -> ${f.extra}` : ""));
    }
  }
  console.log((failures.length ? "x" : "v") + ` ${pass} passed, ${failures.length} failed`);
  return failures.length;
}
