/* pyodide-worker.js
   Runs Pyodide inside a Web Worker so input() can genuinely pause
   execution — via Atomics.wait on a SharedArrayBuffer — until the main
   thread supplies a typed value. This is the same technique Thonny /
   in-browser REPLs use for real inline interactive input.

   Requires crossOriginIsolated (see coi-serviceworker.js) so
   SharedArrayBuffer is available. The main thread feature-detects this
   and only uses this worker when it's supported.

   Message protocol:
     main -> worker: { type: "run", code, sab }
       sab layout: Int32Array[0] = wake flag (0=waiting,1=ready),
                   Int32Array[1] = byte length of the typed input,
                   remaining bytes = UTF-8 input text (max 4096 bytes).
     worker -> main: { type: "stdout", text }
                     { type: "input-request" }
                     { type: "done", images }
                     { type: "error", message }
*/

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodideReadyPromise = null;
function ensurePyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodide().then(async (py) => {
      await py.loadPackage(["micropip"]);
      return py;
    });
  }
  return pyodideReadyPromise;
}

function extractMissingModule(message) {
  const m = message.match(/No module named ['"]([\w.]+)['"]/);
  return m ? m[1].split(".")[0] : null;
}

const MPL_SETUP = `
try:
    import matplotlib
    matplotlib.use("AGG")
except Exception:
    pass
`;

async function captureFigures(py) {
  const hasMpl = py.runPython(`"matplotlib" in __import__("sys").modules`);
  if (!hasMpl) return [];
  return py
    .runPython(
      `
import io, base64
_out = []
try:
    import matplotlib.pyplot as _plt
    for _num in _plt.get_fignums():
        _fig = _plt.figure(_num)
        _buf = io.BytesIO()
        _fig.savefig(_buf, format="png", bbox_inches="tight")
        _out.append(base64.b64encode(_buf.getvalue()).decode("ascii"))
    _plt.close("all")
except Exception:
    pass
_out
  `
    )
    .toJs();
}

self.onmessage = async (event) => {
  if (event.data.type !== "run") return;
  const { code, sab } = event.data;

  const sync = new Int32Array(sab, 0, 2);
  const inputBytes = new Uint8Array(sab, 8);

  let outBuf = "";
  const flush = () => {
    if (outBuf) {
      self.postMessage({ type: "stdout", text: outBuf });
      outBuf = "";
    }
  };

  try {
    const py = await ensurePyodide();

    py.setStdout({
      raw: (ch) => {
        outBuf += String.fromCharCode(ch);
        if (ch === 10) flush(); // flush on newline for a live, line-by-line feel
      },
    });
    py.setStderr({
      raw: (ch) => {
        outBuf += String.fromCharCode(ch);
        if (ch === 10) flush();
      },
    });
    py.setStdin({
      stdin: () => {
        flush(); // send the just-printed prompt (no trailing \n) before blocking
        Atomics.store(sync, 0, 0);
        self.postMessage({ type: "input-request" });
        Atomics.wait(sync, 0, 0); // <-- genuinely pauses this thread
        const len = Atomics.load(sync, 1);
        const text = new TextDecoder().decode(inputBytes.slice(0, len));
        return text + "\n";
      },
    });

    const freshGlobals = py.globals.get("dict")();

    try {
      await py.runPythonAsync(MPL_SETUP, { globals: freshGlobals });
    } catch (_) {
      /* matplotlib not installed — fine */
    }

    async function execute() {
      await py.runPythonAsync(code, { globals: freshGlobals });
    }

    try {
      await execute();
    } catch (err) {
      const missing = extractMissingModule(err.message);
      if (missing) {
        flush();
        self.postMessage({ type: "stdout", text: `Package "${missing}" not found — attempting install...\n` });
        try {
          const micropip = py.pyimport("micropip");
          await micropip.install(missing);
          await execute();
        } catch (e2) {
          throw err;
        }
      } else {
        throw err;
      }
    }

    flush();
    const images = await captureFigures(py);
    freshGlobals.destroy();
    self.postMessage({ type: "done", images });
  } catch (err) {
    flush();
    self.postMessage({ type: "error", message: (err && err.message) || String(err) });
  }
};
