import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  CheckCircle2,
  Download,
  FileImage,
  Gauge,
  ImageIcon,
  Loader2,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import quickheicMark from "@/assets/quickheic-mark.png";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type OutputFormat = "jpg" | "png";
type ThemeMode = "dark" | "light";
type JobStatus = "queued" | "processing" | "done" | "error";

type ConversionJob = {
  id: string;
  file: File;
  status: JobStatus;
  progress: number;
  inputSize: number;
  outputSize?: number | undefined;
  outputBlob?: Blob | undefined;
  outputUrl?: string | undefined;
  outputName?: string | undefined;
  error?: string | undefined;
};

const supportedExtensions = new Set(["heic", "heif", "png", "jpg", "jpeg", "webp"]);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QuickHEIC — Convert HEIC to JPG Online" },
      {
        name: "description",
        content:
          "Convert HEIC and HEIF photos to JPG or PNG online with QuickHEIC. Fast, private, browser-based batch conversion with ZIP downloads.",
      },
      { property: "og:title", content: "QuickHEIC — Private HEIC to JPG Converter" },
      {
        property: "og:description",
        content:
          "Fast browser-based HEIC, HEIF, JPG, PNG, and WEBP conversion with quality controls and batch ZIP downloads.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://quickheic-convert-fast.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://quickheic-convert-fast.lovable.app/" }],
    scripts: [
      {
        src: "https://pl31479961.profitableratecpmnetwork.com/b1/5d/2a/b15d2a45d8363cd1a8008f0368464e3b.js",
      },
    ],
  }),
  component: QuickHeicPage,
});

function QuickHeicPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [format, setFormat] = useState<OutputFormat>("jpg");
  const [quality, setQuality] = useState(92);
  const [jobs, setJobs] = useState<ConversionJob[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("quickheic-theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("quickheic-theme", theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      jobs.forEach((job) => {
        if (job.outputUrl) {
          URL.revokeObjectURL(job.outputUrl);
        }
      });
    };
  }, [jobs]);

  const completedJobs = useMemo(() => jobs.filter((job) => job.status === "done"), [jobs]);
  const totalInputSize = useMemo(
    () => jobs.reduce((total, job) => total + job.inputSize, 0),
    [jobs],
  );
  const totalOutputSize = useMemo(
    () => completedJobs.reduce((total, job) => total + (job.outputSize ?? 0), 0),
    [completedJobs],
  );

  const updateJob = useCallback((id: string, patch: Partial<ConversionJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    const validFiles = incoming.filter(isSupportedFile);
    const rejectedCount = incoming.length - validFiles.length;

    if (rejectedCount > 0) {
      toast.error("Some files were skipped", {
        description: "QuickHEIC supports HEIC, HEIF, PNG, JPG, and WEBP images.",
      });
    }

    if (validFiles.length === 0) {
      return;
    }

    const nextJobs = validFiles.map((file) => ({
      id: createJobId(file),
      file,
      status: "queued" as const,
      progress: 0,
      inputSize: file.size,
    }));

    setJobs((current) => [...current, ...nextJobs]);
    toast.success(`${validFiles.length} file${validFiles.length === 1 ? "" : "s"} ready`);
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
      event.target.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const removeJob = (id: string) => {
    setJobs((current) => {
      const target = current.find((job) => job.id === id);
      if (target?.outputUrl) {
        URL.revokeObjectURL(target.outputUrl);
      }
      return current.filter((job) => job.id !== id);
    });
  };

  const clearJobs = () => {
    jobs.forEach((job) => {
      if (job.outputUrl) {
        URL.revokeObjectURL(job.outputUrl);
      }
    });
    setJobs([]);
  };

  const handleConvert = async () => {
    if (jobs.length === 0) {
      toast.error("Add images first");
      return;
    }

    jobs.forEach((job) => {
      if (job.outputUrl) {
        URL.revokeObjectURL(job.outputUrl);
      }
    });

    const jobsToConvert = jobs.map((job) => ({
      ...job,
      status: "queued" as const,
      progress: 0,
      outputBlob: undefined,
      outputUrl: undefined,
      outputName: undefined,
      outputSize: undefined,
      error: undefined,
    }));

    setJobs(jobsToConvert);
    setIsConverting(true);
    toast.loading("Converting images", { id: "convert" });

    await Promise.all(jobsToConvert.map((job) => convertJob(job, format, quality, updateJob)));

    setIsConverting(false);
    toast.success("Conversion complete", {
      id: "convert",
      description: "Your files are ready to download.",
    });
  };

  const downloadAll = async () => {
    if (completedJobs.length === 0) {
      toast.error("No converted files yet");
      return;
    }

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    completedJobs.forEach((job) => {
      if (job.outputBlob && job.outputName) {
        zip.file(job.outputName, job.outputBlob);
      }
    });
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, "quickheic-converted-images.zip");
    toast.success("ZIP download started");
  };

  const stats = [
    { label: "Browser-only", value: "Private", icon: Lock },
    { label: "Selected", value: `${jobs.length} file${jobs.length === 1 ? "" : "s"}`, icon: FileImage },
    { label: "Completed", value: `${completedJobs.length}/${jobs.length || 0}`, icon: CheckCircle2 },
  ];

  return (
    <main className={cn("min-h-screen app-shell text-foreground", theme === "dark" ? "dark" : "")}> 
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-2xl">
        <nav className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#converter" className="group flex min-w-0 items-center gap-3" aria-label="QuickHEIC home">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface shadow-crisp transition-transform duration-300 group-hover:scale-105">
              <img src={quickheicMark} alt="" width={512} height={512} className="h-10 w-10 object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-xl font-bold leading-tight tracking-normal sm:text-2xl">
                Quick<span className="gradient-text">HEIC</span>
              </span>
              <span className="hidden text-xs font-semibold uppercase tracking-normal text-muted-foreground sm:block">
                Private image converter
              </span>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden border-border bg-surface px-3 py-1.5 text-muted-foreground md:inline-flex">
              <Sparkles className="mr-1 h-3.5 w-3.5 text-brand-cyan" />
              No uploads
            </Badge>
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-2 shadow-sm">
              <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                aria-label="Toggle dark mode"
              />
              <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </div>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-7xl justify-center px-4 py-4 sm:px-6 lg:px-8">
        <BannerAd adKey="ba0dcedea1a8f47c31ece611501a3bf0" width={728} height={90} />
      </section>

      <section id="converter" className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <div className="space-y-6">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <div className="flex min-h-[440px] flex-col justify-center rounded-[2rem] p-1 gradient-border">
              <div className="glass-panel relative h-full overflow-hidden rounded-[1.85rem] p-6 sm:p-8 lg:p-10">
                <div className="absolute left-0 right-0 top-0 h-px shimmer-line" aria-hidden="true" />
                <Badge className="mb-6 border-border bg-surface px-3 py-1 text-brand-cyan" variant="outline">
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Instant local conversion
                </Badge>
                <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                  Convert HEIC to JPG or PNG in your browser.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  QuickHEIC handles HEIC, HEIF, JPG, PNG, and WEBP files locally with batch conversion, quality control, and ZIP downloads.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {stats.map((item) => (
                    <div key={item.label} className="glass-soft rounded-2xl p-4">
                      <item.icon className="mb-3 h-5 w-5 text-brand-cyan" aria-hidden="true" />
                      <div className="font-display text-xl font-semibold tracking-normal">{item.value}</div>
                      <div className="mt-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Card className="glass-panel overflow-hidden rounded-[2rem] border-border bg-card shadow-panel">
              <CardContent className="p-5 sm:p-6">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-normal">Image converter</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Drop files, choose output, convert.</p>
                  </div>
                  <Button variant="glass" size="sm" onClick={clearJobs} disabled={jobs.length === 0 || isConverting}>
                    <RefreshCw />
                    Clear
                  </Button>
                </div>

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "group flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed p-6 text-center transition-all duration-300",
                    isDragging
                      ? "border-brand-cyan bg-accent shadow-glow"
                      : "border-border bg-surface hover:border-brand-cyan hover:bg-accent/60",
                  )}
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-brand-cyan transition-transform duration-300 group-hover:-translate-y-1">
                    <UploadCloud className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <p className="font-display text-xl font-semibold tracking-normal">Drag images here</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Supports HEIC, HEIF, PNG, JPG, and WEBP. Batch files are processed together.
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".heic,.heif,.png,.jpg,.jpeg,.webp,image/heic,image/heif,image/png,image/jpeg,image/webp"
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                  <Button variant="premium" className="mt-5" onClick={() => inputRef.current?.click()}>
                    <ImageIcon />
                    Select files
                  </Button>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_1.2fr]">
                  <div>
                    <label className="text-sm font-semibold text-foreground">Output format</label>
                    <div className="mt-2 grid grid-cols-2 rounded-2xl border border-border bg-surface p-1">
                      {(["jpg", "png"] as OutputFormat[]).map((option) => (
                        <Button
                          key={option}
                          variant={format === option ? "premium" : "ghost"}
                          size="sm"
                          onClick={() => setFormat(option)}
                          className="rounded-xl uppercase"
                          disabled={isConverting}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-foreground">Quality</label>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
                        {quality}%
                      </span>
                    </div>
                    <Slider
                      value={[quality]}
                      min={10}
                      max={100}
                      step={1}
                      onValueChange={(value) => {
                        const nextValue = value[0];
                        if (typeof nextValue === "number") {
                          setQuality(nextValue);
                        }
                      }}
                      disabled={isConverting}
                      className="mt-4"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">JPG uses quality control; PNG remains lossless.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {jobs.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-surface p-5 text-center text-sm text-muted-foreground">
                      Your conversion queue will appear here.
                    </div>
                  ) : (
                    jobs.map((job) => <JobRow key={job.id} job={job} onRemove={removeJob} />)
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Before</p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-normal">{formatBytes(totalInputSize)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">After</p>
                    <p className="mt-1 font-display text-2xl font-semibold tracking-normal">{formatBytes(totalOutputSize)}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button variant="premium" size="lg" className="flex-1" onClick={handleConvert} disabled={isConverting || jobs.length === 0}>
                    {isConverting ? <Loader2 className="animate-spin" /> : <Zap />}
                    {isConverting ? "Converting" : "Convert now"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-normal text-brand-cyan">Batch downloads</p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-normal">Export all converted images</h2>
              </div>
              <p className="text-sm text-muted-foreground">{completedJobs.length} ready</p>
            </div>
            <BannerAd adKey="5f70737fe64bfec6c80b581aa5b10535" width={320} height={50} className="mb-5" />
            <Button variant="premium" size="lg" className="w-full" onClick={downloadAll} disabled={completedJobs.length === 0}>
              <Archive />
              Download All as ZIP
            </Button>
          </section>
        </div>

        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <NativeBannerAd />

          <div className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-sm">
            <ShieldCheck className="mb-4 h-6 w-6 text-success" aria-hidden="true" />
            <h3 className="font-display text-lg font-semibold tracking-normal">Built for privacy</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Files stay on your device during conversion, so personal photos are not sent to a server.
            </p>
          </div>
        </aside>
      </section>

      <SeoSection />

      <footer className="border-t border-border bg-background/55 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <img src={quickheicMark} alt="" width={512} height={512} loading="lazy" className="h-8 w-8 object-contain" />
            <span>© 2026 QuickHEIC. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="#privacy" className="transition-colors hover:text-foreground">Privacy Policy</a>
            <a href="#terms" className="transition-colors hover:text-foreground">Terms of Use</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function JobRow({ job, onRemove }: { job: ConversionJob; onRemove: (id: string) => void }) {
  const statusIcon = {
    queued: <Gauge className="h-4 w-4 text-muted-foreground" />,
    processing: <Loader2 className="h-4 w-4 animate-spin text-brand-cyan" />,
    done: <CheckCircle2 className="h-4 w-4 text-success" />,
    error: <XCircle className="h-4 w-4 text-destructive" />,
  }[job.status];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-brand-cyan">
          <FileImage className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{job.file.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBytes(job.inputSize)}
                {job.outputSize ? ` → ${formatBytes(job.outputSize)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-secondary-foreground">
                {statusIcon}
                {job.status}
              </span>
              {job.status === "done" && job.outputBlob && job.outputName ? (
                <Button variant="glass" size="icon" onClick={() => downloadJob(job)} aria-label={`Download ${job.outputName}`}>
                  <Download />
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" onClick={() => onRemove(job.id)} aria-label={`Remove ${job.file.name}`}>
                <X />
              </Button>
            </div>
          </div>
          <Progress value={job.progress} className="mt-3" />
          {job.error ? <p className="mt-2 text-xs text-destructive">{job.error}</p> : null}
        </div>
      </div>
    </div>
  );
}

function SeoSection() {
  const steps = [
    {
      title: "Add your photos",
      description: "Drag HEIC or HEIF files into QuickHEIC, or select images from your device.",
      icon: UploadCloud,
    },
    {
      title: "Choose JPG or PNG",
      description: "Pick the output format and tune JPG quality for smaller files when needed.",
      icon: RefreshCw,
    },
    {
      title: "Download instantly",
      description: "Save each converted image or download the full batch as a ZIP file.",
      icon: Download,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <div className="glass-panel rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-brand-cyan">Online HEIC converter</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-normal sm:text-4xl">
              How to Convert HEIC to JPG Online
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              QuickHEIC makes iPhone photo conversion simple: choose files, select the output format, and download images ready for sharing, websites, email, and apps.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-brand-cyan">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-display text-3xl font-bold text-muted-foreground">{index + 1}</span>
                </div>
                <h3 className="font-display text-lg font-semibold tracking-normal">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <ShieldCheck className="mb-4 h-8 w-8 text-success" aria-hidden="true" />
            <h3 className="font-display text-2xl font-bold tracking-normal">FAQ</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Common answers for HEIC conversion, privacy, and batch file handling.
            </p>
          </div>

          <Accordion type="single" collapsible className="rounded-3xl border border-border bg-surface px-5">
            <AccordionItem value="safe" className="border-border">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Is QuickHEIC safe?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Yes. QuickHEIC runs conversion in your browser, so your images stay on your device and are not uploaded to a backend server.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="why" className="border-border">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Why convert HEIC to JPG?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                JPG is widely supported by websites, email clients, editing apps, and older devices. Converting HEIC photos helps them open almost anywhere.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="limit" className="border-border">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Is there any file limit?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                There is no account limit in QuickHEIC. Your practical limit depends on your browser, memory, and device performance during local batch conversion.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}

function NativeBannerAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://pl31479962.profitableratecpmnetwork.com/f964ea04c1e39226d1cc4d554a1b2ffa/invoke.js";
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    container.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="glass-soft flex min-h-[120px] items-center justify-center rounded-3xl p-4">
      <div ref={containerRef} id="container-f964ea04c1e39226d1cc4d554a1b2ffa" className="w-full" />
    </div>
  );
}

function BannerAd({ adKey, width, height, className }: { adKey: string; width: number; height: number; className?: string }) {
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body><script type="text/javascript">atOptions={'key':'${adKey}','format':'iframe','height':${height},'width':${width},'params':{}};<\/script><script type="text/javascript" src="https://www.highrevenueformat.com/${adKey}/invoke.js"><\/script></body></html>`;

  return (
    <iframe
      title="Advertisement"
      srcDoc={srcDoc}
      width={width}
      height={height}
      scrolling="no"
      frameBorder={0}
      className={cn("mx-auto block max-w-full overflow-hidden rounded-2xl border-0 bg-transparent", className)}
    />
  );
}


function downloadJob(job: ConversionJob) {
  if (!job.outputBlob || !job.outputName) {
    toast.error("This file is not ready yet");
    return;
  }
  triggerDownload(job.outputBlob, job.outputName);
}

async function convertJob(
  job: ConversionJob,
  format: OutputFormat,
  quality: number,
  updateJob: (id: string, patch: Partial<ConversionJob>) => void,
) {
  try {
    updateJob(job.id, { status: "processing", progress: 18, error: undefined });
    const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
    const blob = isHeicFile(job.file)
      ? await convertHeicFile(job.file, mimeType, quality / 100, (progress) => updateJob(job.id, { progress }))
      : await convertRasterFile(job.file, mimeType, quality / 100, (progress) => updateJob(job.id, { progress }));

    const outputName = createOutputName(job.file.name, format);
    const outputUrl = URL.createObjectURL(blob);

    updateJob(job.id, {
      status: "done",
      progress: 100,
      outputBlob: blob,
      outputUrl,
      outputName,
      outputSize: blob.size,
    });
  } catch (error) {
    updateJob(job.id, {
      status: "error",
      progress: 100,
      error: error instanceof Error ? error.message : "This image could not be converted.",
    });
  }
}

async function convertHeicFile(
  file: File,
  mimeType: string,
  quality: number,
  onProgress: (progress: number) => void,
) {
  onProgress(36);
  const { default: heic2any } = await import("heic2any");
  onProgress(68);
  const result = await heic2any({ blob: file, toType: mimeType, quality });
  onProgress(88);
  if (Array.isArray(result)) {
    const firstBlob = result[0];
    if (firstBlob) {
      return firstBlob;
    }
    throw new Error("This HEIC file did not contain a convertible image.");
  }
  return result;
}

async function convertRasterFile(
  file: File,
  mimeType: string,
  quality: number,
  onProgress: (progress: number) => void,
) {
  onProgress(35);
  const bitmap = await createImageBitmap(file).catch(() => undefined);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not prepare this image.");
  }

  if (bitmap) {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
  } else {
    const image = await loadImage(file);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
  }

  onProgress(78);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("This image could not be exported."));
      },
      mimeType,
      quality,
    );
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This image could not be read."));
    };
    image.src = url;
  });
}

function isSupportedFile(file: File) {
  const extension = getExtension(file.name);
  return supportedExtensions.has(extension) || ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"].includes(file.type);
}

function isHeicFile(file: File) {
  const extension = getExtension(file.name);
  return extension === "heic" || extension === "heif" || file.type === "image/heic" || file.type === "image/heif";
}

function getExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  const extension = parts.at(-1);
  return extension ?? "";
}

function createOutputName(fileName: string, format: OutputFormat) {
  const baseName = fileName.replace(/\.(heic|heif|png|jpe?g|webp)$/i, "") || "quickheic-image";
  return `${baseName}.${format === "jpg" ? "jpg" : "png"}`;
}

function createJobId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}