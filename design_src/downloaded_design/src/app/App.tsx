import { useState, useRef, useCallback, useEffect } from "react";
import { CloudUpload, FileText, Sun, Moon, CheckCircle2, AlertCircle, Send, X } from "lucide-react";

// ── Mock summary generator ──────────────────────────────────────────────────
const MOCK_BULLETS = [
  "Total ad spend reached $12,450 — within the $13k monthly ceiling and down 4.2% vs. prior period.",
  "1,204 conversions recorded at an average cost per conversion of $10.34, beating the $12.00 target by 14%.",
  "Top-performing campaign drove 38% of total conversions on just 22% of spend — a strong efficiency signal.",
  "Recommend reallocating $1,800 from the two underperforming ad sets to scale the top campaign in Q3.",
];

function simulateSummary(): Promise<string[]> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_BULLETS), 1800));
}

// ── Theme toggle ────────────────────────────────────────────────────────────
type Theme = "light" | "dark";

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

// ── Upload zone ─────────────────────────────────────────────────────────────
interface UploadZoneProps {
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  disabled: boolean;
}

function UploadZone({ file, onFile, onClear, disabled }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = (f: File) => {
    if (f.name.endsWith(".csv") || f.type === "text/csv") onFile(f);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files[0];
      if (f) accept(f);
    },
    [disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) accept(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-border bg-card shadow-sm animate-fade-in">
        <FileText className="w-5 h-5 text-primary shrink-0" strokeWidth={1.5} />
        <span className="flex-1 text-sm font-mono text-foreground truncate">{file.name}</span>
        <span className="text-xs font-mono text-muted-foreground shrink-0">
          {(file.size / 1024).toFixed(1)} KB
        </span>
        {!disabled && (
          <button
            onClick={onClear}
            className="ml-1 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={[
        "w-full rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
        "flex flex-col items-center justify-center gap-3 py-14 px-6",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        dragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border bg-card hover:border-primary/50 hover:bg-card",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
      aria-label="Upload CSV file"
    >
      <CloudUpload
        className={`w-9 h-9 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`}
        strokeWidth={1.25}
      />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {dragOver ? "Release to upload" : "Drop your CSV here"}
        </p>
        <p className="mt-0.5 text-xs font-mono text-muted-foreground">or click to browse</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={handleChange}
        tabIndex={-1}
      />
    </button>
  );
}

// ── Summary card ────────────────────────────────────────────────────────────
function SummaryCard({ bullets }: { bullets: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-md animate-fade-in overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-primary" strokeWidth={2} />
        <span className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-widest">
          Performance Summary
        </span>
      </div>
      <ul className="px-5 py-5 space-y-4">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex gap-3 items-start animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <span className="mt-[3px] shrink-0 w-[6px] h-[6px] rounded-full bg-primary" />
            <p className="text-sm leading-relaxed text-foreground">{bullet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Email form ───────────────────────────────────────────────────────────────
type EmailStatus = "idle" | "sending" | "sent" | "error";

function EmailForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<EmailStatus>("idle");

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setStatus("sending");
    await new Promise((r) => setTimeout(r, 1200));
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-primary" strokeWidth={2} />
        Summary sent to {email}
      </div>
    );
  }

  return (
    <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-2 animate-fade-in">
      <input
        type="email"
        placeholder="you@agency.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={[
          "flex-1 px-4 py-2.5 rounded-full border border-border bg-card text-sm font-mono",
          "placeholder:text-muted-foreground text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
          "transition-shadow",
        ].join(" ")}
      />
      <button
        type="submit"
        disabled={!valid || status === "sending"}
        className={[
          "flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-mono font-medium",
          "bg-primary text-primary-foreground",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !valid || status === "sending"
            ? "opacity-40 cursor-not-allowed"
            : "hover:opacity-90 active:scale-[0.98]",
        ].join(" ")}
      >
        <Send className="w-3.5 h-3.5" strokeWidth={2} />
        {status === "sending" ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}

// ── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" strokeWidth={2} />
      <p className="flex-1 text-sm text-destructive">{message}</p>
      <button onClick={onDismiss} className="text-destructive/60 hover:text-destructive transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
type AppStatus = "idle" | "loading" | "success" | "error";

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [summary, setSummary] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    if (!file) return;
    setStatus("loading");
    setError(null);
    setSummary(null);
    try {
      const bullets = await simulateSummary();
      setSummary(bullets);
      setStatus("success");
    } catch {
      setError("Something went wrong generating the summary. Please try again.");
      setStatus("error");
    }
  };

  const handleClear = () => {
    setFile(null);
    setSummary(null);
    setStatus("idle");
    setError(null);
  };

  return (
    <>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.35s ease both;
        }
        body { font-family: 'Inter', sans-serif; }
        .font-mono, input, button { font-family: 'DM Mono', monospace; }
      `}</style>

      <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
        {/* ── Header ── */}
        <header className="max-w-[640px] mx-auto flex items-center justify-between mb-12">
          <div>
            <span className="font-mono text-xs font-medium tracking-[0.18em] uppercase text-muted-foreground">
              Insight
            </span>
            <h1 className="font-mono text-xl font-medium text-foreground leading-tight mt-0.5">
              CSV Summarizer
            </h1>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            className={[
              "w-9 h-9 rounded-full flex items-center justify-center border border-border",
              "bg-card text-muted-foreground hover:text-foreground hover:border-primary/40",
              "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ].join(" ")}
          >
            {theme === "light" ? <Moon className="w-4 h-4" strokeWidth={1.75} /> : <Sun className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        </header>

        {/* ── Main ── */}
        <main className="max-w-[640px] mx-auto space-y-4">
          {/* Upload zone */}
          <UploadZone
            file={file}
            onFile={setFile}
            onClear={handleClear}
            disabled={status === "loading"}
          />

          {/* Error */}
          {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

          {/* Status text */}
          {status === "loading" && (
            <p className="text-xs font-mono text-muted-foreground animate-fade-in px-1">
              Reading CSV and generating summary…
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleSummarize}
            disabled={!file || status === "loading" || status === "success"}
            className={[
              "w-full py-3 rounded-full font-mono text-sm font-medium",
              "bg-primary text-primary-foreground",
              "transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              !file || status === "loading" || status === "success"
                ? "opacity-35 cursor-not-allowed"
                : "hover:opacity-90 active:scale-[0.99] shadow-sm hover:shadow",
            ].join(" ")}
          >
            {status === "loading" ? "Summarizing…" : "Summarize"}
          </button>

          {/* Summary card */}
          {summary && <SummaryCard bullets={summary} />}

          {/* Email form */}
          {summary && (
            <div className="pt-2 space-y-2 animate-fade-in">
              <p className="text-xs font-mono text-muted-foreground px-1 uppercase tracking-widest">
                Email report
              </p>
              <EmailForm />
            </div>
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="max-w-[640px] mx-auto mt-20 pt-6 border-t border-border">
          <p className="text-xs font-mono text-muted-foreground">
            No data is stored. Summaries are generated locally.
          </p>
        </footer>
      </div>
    </>
  );
}
