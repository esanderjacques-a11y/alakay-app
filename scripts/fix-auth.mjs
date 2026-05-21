import { readFileSync, writeFileSync } from "fs";

let s = readFileSync("src/components/AuthPanel.tsx", "utf8");
s = s.replace(/<\/?motion\b/g, (m) => m.replace("motion", "div"));

const duplicate = `      </div>
      <motion className="p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-green-900">
            {mode === "login" ? text.login : text.createAccount}
          </h2>

          <p className="mt-1 text-sm text-slate-600">{text.saveReports}</p>
        </motion>

        <button
          type="button"
          onClick={onContinueAsGuest}
          className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {text.continueGuest}
        </button>
      </motion>

      <motion className="mt-6 grid gap-4">`;

const replacement = `      </motion>
      <motion className="p-6">
        <motion className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <motion className="flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={\`touch-target flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold \${
                mode === "login"
                  ? "bg-white text-green-800 shadow-sm"
                  : "text-slate-600"
              }\`}
            >
              {text.login}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMessage("");
              }}
              className={\`touch-target flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold \${
                mode === "signup"
                  ? "bg-white text-green-800 shadow-sm"
                  : "text-slate-600"
              }\`}
            >
              {text.createAccount}
            </button>
          </motion>
          <button
            type="button"
            onClick={onContinueAsGuest}
            className="touch-target rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-900 active:scale-[0.98]"
          >
            {text.continueGuest}
          </button>
        </motion>
      <motion className="grid gap-4">`;

let dup = duplicate.replace(/motion/g, "motion");
dup = dup.replace(/<\/?motion\b/g, (m) => m.replace("motion", "div"));
let rep = replacement.replace(/<\/?motion\b/g, (m) => m.replace("motion", "motion"));
rep = rep.replace(/motion/g, "div");

if (s.includes(dup)) {
  s = s.replace(dup, rep);
  console.log("auth header replaced");
} else {
  console.log("dup not found, fixing tags only");
}

s = s.replace(/<\/?motion\b/g, (m) => m.replace("motion", "motion"));
s = s.replace(/<\/?motion\b/g, (m) => m.replace("motion", "div"));

// close extra div at end - ensure section closes properly
s = s.replace(
  "      </motion>\n    </section>",
  "      </motion>\n      </motion>\n    </section>"
);
s = s.replace(/motion/g, "div");

writeFileSync("src/components/AuthPanel.tsx", s);
console.log("done");
