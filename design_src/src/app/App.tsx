import { useState, useRef, useCallback, useEffect } from "react";
import { UploadCloud, FileText, X, AlertCircle, Loader2, Sun, Moon } from "lucide-react";

type AppState = "idle" | "ready" | "loading" | "done" | "error";

interface FileInfo {
  name: string;
  size: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MOCK_SUMMARY = `The dataset contains purchase records across 8 product categories, spanning January through March 2024. Electronics leads revenue at $142,380, followed by Apparel ($89,204) and Home Goods ($61,330). Average order value is $74.20, with a median of $58.00, suggesting a right-skewed distribution driven by occasional high-value electronics purchases.

Customer retention rate sits at 34% over the period, with returning customers spending 2.1× more per order than first-time buyers. The Pacific Northwest region accounts for 28% of all transactions despite representing just 14% of the customer base.

Two anomalies are worth reviewing: a cluster of 47 zero-revenue rows on February 12th (likely a processing error) and 13 duplicate order IDs across different customer accounts.`;

export default function App() {
  const [dark, setDark] = useState(false);
  const [state, setState] = useState<AppState>("idle");
  const [file, setFileInfo] = useState<FileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [rowCount] = useState(1847);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      setErrorMsg("Only .csv files are accepted. Please choose a different file.");
      setState("error");
      setFileInfo(null);
      return;
    }
    setErrorMsg("");
    setState("ready");
    setFileInfo({ name: f.name, size: formatBytes(f.size) });
    setStatusText("File ready. Click Summarize to analyze.");
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const clearFile = () => {
    setFileInfo(null);
    setState("idle");
    setStatusText("");
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSummarize = async () => {
    if (state !== "ready") return;
    setState("loading");
    setStatusText("Parsing rows and sending to model…");
    await new Promise((r) => setTimeout(r, 2200));
    setState("done");
    setStatusText("Analysis complete.");
  };

  const canSummarize = state === "ready";
  const isLoading = state === "loading";

  return (
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="mx-auto px-5 py-10 sm:py-14" style={{ maxWidth: 760 }}>

        {/* Header */}
        <header
          id="Header"
          className="flex items-center justify-between mb-10 sm:mb-14"
        >
          <span
            className="text-foreground font-semibold tracking-tight"
            style={{
              fontFamily: "'Geist Mono', 'Courier New', monospace",
              fontSize: "1.05rem",
              letterSpacing: "-0.02em",
            }}
          >
            Clearview Reports
          </span>
          <div className="flex items-center gap-3">
            <span
              className="text-muted-foreground border border-border rounded-full px-2.5 py-0.5 text-xs"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              v1.0.0
            </span>
            <button
              onClick={() => setDark((d) => !d)}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-full p-1.5 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150"
            >
              {dark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Instruction */}
        <p
          className="text-muted-foreground text-sm mb-8"
          style={{ lineHeight: 1.6 }}
        >
          Upload a CSV file and get an AI-generated plain-language summary in seconds.
        </p>

        {/* Error Banner */}
        {state === "error" && (
          <div
            id="ErrorBanner"
            className="flex items-start gap-3 rounded-xl px-4 py-3.5 mb-6 text-sm"
            style={{
              background: "var(--destructive)",
              color: "var(--destructive-foreground)",
              border: "1px solid rgba(139,32,32,0.15)",
            }}
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span style={{ lineHeight: 1.55 }}>{errorMsg}</span>
          </div>
        )}

        {/* Upload Zone */}
        <div
          id="UploadZone"
          className="mb-4 rounded-xl transition-colors duration-150"
          style={{
            border: isDragging
              ? "1.5px dashed #1a1a18"
              : "1.5px dashed rgba(26,26,24,0.22)",
            background: isDragging ? "rgba(26,26,24,0.03)" : "var(--card)",
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          {file ? (
            <div className="flex items-center gap-3 px-5 py-5">
              <div
                className="rounded-lg p-2 shrink-0"
                style={{ background: "var(--secondary)" }}
              >
                <FileText size={18} className="text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium text-foreground truncate"
                  style={{ fontFamily: "'Geist Mono', monospace", fontSize: "0.82rem" }}
                >
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{file.size}</p>
              </div>
              <button
                onClick={clearFile}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Remove file"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center gap-3 px-6 py-12 cursor-pointer"
              htmlFor="csv-input"
            >
              <div
                className="rounded-xl p-3"
                style={{ background: "var(--secondary)" }}
              >
                <UploadCloud size={22} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm text-foreground" style={{ lineHeight: 1.5 }}>
                  Drag and drop a CSV file here, or{" "}
                  <span
                    className="font-medium underline underline-offset-2 decoration-dotted"
                    style={{ textDecorationColor: "var(--muted-foreground)" }}
                  >
                    browse files
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  .csv only · up to 50 MB
                </p>
              </div>
            </label>
          )}
          <input
            ref={inputRef}
            id="csv-input"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={onInputChange}
          />
        </div>

        {/* Summarize Button */}
        <button
          id="SummarizeButton"
          onClick={handleSummarize}
          disabled={!canSummarize}
          className="w-full rounded-xl py-3.5 text-sm font-medium transition-all duration-150 mb-3 relative overflow-hidden"
          style={{
            background: canSummarize || isLoading ? "var(--primary)" : "var(--secondary)",
            color: canSummarize || isLoading ? "var(--primary-foreground)" : "var(--muted-foreground)",
            cursor: canSummarize ? "pointer" : "not-allowed",
            letterSpacing: "-0.01em",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={15} className="animate-spin" />
              Analyzing…
            </span>
          ) : (
            "Summarize"
          )}
        </button>

        {/* Status Text */}
        <p
          id="StatusText"
          className="text-xs text-muted-foreground text-center mb-8 min-h-[1.25rem] transition-opacity duration-200"
          style={{
            fontFamily: "'Geist Mono', monospace",
            opacity: statusText ? 1 : 0,
          }}
        >
          {statusText || "—"}
        </p>

        {/* Summary Card */}
        {state === "done" && (
          <div
            id="SummaryCard"
            className="rounded-xl px-7 py-6 border border-border"
            style={{ background: "var(--card)" }}
          >
            <p
              className="text-foreground"
              style={{ lineHeight: 1.75, fontSize: "0.9rem" }}
            >
              {MOCK_SUMMARY}
            </p>
            <p
              className="mt-5 text-xs text-muted-foreground"
              style={{ fontFamily: "'Geist Mono', monospace" }}
            >
              Analyzed {rowCount.toLocaleString()} rows
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
