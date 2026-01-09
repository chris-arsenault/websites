import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import "./App.css";
import { createTasting, deleteTasting, fetchTastings, rerunTasting } from "./api";
import { getSession, signIn, signOut } from "./auth";
import type { CreateTastingInput, Filters, TastingRecord } from "./types";

const defaultFilters: Filters = {
  search: "",
  style: "",
  minScore: "",
  minHeat: "",
  date: "",
  sortBy: "date"
};

const emptyForm = {
  name: "",
  maker: "",
  date: "",
  score: "",
  style: "",
  heatUser: "",
  heatVendor: "",
  tastingNotesUser: "",
  tastingNotesVendor: "",
  productUrl: ""
};

type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  token: string;
  username: string;
};

type FormMode = "add" | "edit";

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const fileToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

// Compact Heat Slider (1-5 peppers)
const HeatSlider = ({ value, onChange, label }: { value: string; onChange: (val: string) => void; label?: string }) => {
  const numValue = value ? parseInt(value, 10) : 0;
  return (
    <div className="heat-slider">
      {label && <span className="slider-label">{label}</span>}
      <div className="slider-track heat-track">
        <input
          type="range"
          min="0"
          max="5"
          value={numValue}
          onChange={(e) => onChange(e.target.value === "0" ? "" : e.target.value)}
          className="range-input"
        />
        <div className="slider-fill heat-fill" style={{ width: `${(numValue / 5) * 100}%` }} />
        <div className="slider-peppers">
          {[1, 2, 3, 4, 5].map((level) => (
            <span key={level} className={`slider-pepper ${numValue >= level ? "active" : ""}`}>🌶️</span>
          ))}
        </div>
      </div>
      <span className="slider-value">{numValue > 0 ? numValue : "Any"}</span>
    </div>
  );
};

// Compact Score Slider (0-10)
const ScoreSlider = ({ value, onChange, label }: { value: string; onChange: (val: string) => void; label?: string }) => {
  const numValue = value ? parseInt(value, 10) : 0;
  const hasValue = value !== "";
  return (
    <div className="score-slider">
      {label && <span className="slider-label">{label}</span>}
      <div className="slider-track score-track">
        <input
          type="range"
          min="0"
          max="10"
          value={numValue}
          onChange={(e) => onChange(e.target.value === "0" ? "" : e.target.value)}
          className="range-input"
        />
        <div className="slider-fill score-fill" style={{ width: `${(numValue / 10) * 100}%` }} />
      </div>
      <span className="slider-value">{hasValue && numValue > 0 ? `${numValue}+` : "Any"}</span>
    </div>
  );
};

// Pepper Selector for forms (1-5 scale)
const PepperSelector = ({ value, onChange, label, showLabel = true }: { value: number | string; onChange: (val: string) => void; label?: string; showLabel?: boolean }) => {
  const numValue = typeof value === "string" ? (value ? parseInt(value, 10) : 0) : value;
  return (
    <div className="pepper-selector">
      {showLabel && label && <span className="selector-label">{label}</span>}
      <div className="pepper-row">
        {[1, 2, 3, 4, 5].map((level) => (
          <button
            type="button"
            key={level}
            className={`pepper-btn ${numValue >= level ? "active" : ""}`}
            onClick={() => onChange(numValue === level ? "" : String(level))}
            title={`Heat level ${level}`}
          >
            <span className="pepper">🌶️</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Score Selector for forms (0-10 scale)
const ScoreSelector = ({ value, onChange, label, showLabel = true }: { value: number | string; onChange: (val: string) => void; label?: string; showLabel?: boolean }) => {
  const numValue = typeof value === "string" ? (value ? parseFloat(value) : -1) : value;
  return (
    <div className="score-selector">
      {showLabel && label && <span className="selector-label">{label}</span>}
      <div className="score-row">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
          <button
            type="button"
            key={score}
            className={`score-btn ${numValue === score ? "active" : ""} ${numValue > score ? "filled" : ""}`}
            onClick={() => onChange(numValue === score ? "" : String(score))}
            title={`Score ${score}`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
};

// Display peppers for heat level (read-only)
const HeatDisplay = ({ value, max = 5 }: { value: number | null; max?: number }) => {
  if (value === null) return <span className="heat-empty">-</span>;
  const filled = Math.min(Math.round(value), max);
  return (
    <span className="heat-display">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`pepper-icon ${i < filled ? "filled" : "empty"}`}>🌶️</span>
      ))}
    </span>
  );
};

// Display score as visual bar
const ScoreDisplay = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="score-empty">-</span>;
  const percentage = (value / 10) * 100;
  return (
    <div className="score-display">
      <div className="score-bar">
        <div className="score-fill" style={{ width: `${percentage}%` }} />
      </div>
      <span className="score-value">{value.toFixed(1)}</span>
    </div>
  );
};

const formatDate = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const statusLabels: Record<string, string> = {
  pending: "Queued",
  image_extracted: "Analyzing photo",
  image_enriched: "Finding product page",
  voice_transcribed: "Transcribing audio",
  voice_extracted: "Extracting scores",
  notes_formatted: "Formatting notes",
  complete: "Complete",
  error: "Error"
};

const formatStatus = (status?: string) => {
  if (!status) return "";
  return statusLabels[status] ?? status.replace(/_/g, " ");
};

const App = () => {
  const [auth, setAuth] = useState<AuthState>({ status: "loading", token: "", username: "" });
  const [tastings, setTastings] = useState<TastingRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [rerunId, setRerunId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TastingRecord | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showManualFields, setShowManualFields] = useState(false);

  // Media state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [imageMimeType, setImageMimeType] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBase64, setAudioBase64] = useState("");
  const [audioMimeType, setAudioMimeType] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const waitForVideoReady = (video: HTMLVideoElement) =>
    new Promise<void>((resolve) => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve();
        return;
      }
      const handleReady = () => resolve();
      video.addEventListener("loadedmetadata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
    });

  const getVideoDimensions = (video: HTMLVideoElement, stream: MediaStream | null) => {
    let width = video.videoWidth;
    let height = video.videoHeight;
    if ((!width || !height) && stream) {
      const settings = stream.getVideoTracks()[0]?.getSettings?.();
      width = settings?.width ?? width;
      height = settings?.height ?? height;
    }
    return {
      width: width || 640,
      height: height || 480
    };
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await getSession();
        if (session) {
          const payload = session.getIdToken().payload as Record<string, unknown>;
          const displayName =
            (typeof payload.name === "string" && payload.name) ||
            (typeof payload.preferred_username === "string" && payload.preferred_username) ||
            (typeof payload.email === "string" && payload.email) ||
            (typeof payload["cognito:username"] === "string" && payload["cognito:username"]) ||
            "";
          setAuth({ status: "signedIn", token: session.getIdToken().getJwtToken(), username: displayName });
          return;
        }
      } catch (error) {
        console.error(error);
      }
      setAuth({ status: "signedOut", token: "", username: "" });
    };
    loadSession();
  }, []);

  useEffect(() => {
    const loadTastings = async () => {
      try {
        setLoading(true);
        const data = await fetchTastings();
        setTastings(data);
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setLoading(false);
      }
    };
    loadTastings();
  }, []);

  useEffect(() => {
    if (!formOpen) {
      stopCamera();
      if (isRecording) stopRecording();
    }
  }, [formOpen, isRecording]);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraStream || !cameraActive || !video) return;
    video.srcObject = cameraStream;
    const startPreview = async () => {
      try {
        await video.play();
      } catch {
        setErrorMessage("Unable to start camera preview.");
      }
    };
    startPreview();
    return () => {
      if (video.srcObject === cameraStream) {
        video.srcObject = null;
      }
    };
  }, [cameraStream, cameraActive]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
      audioStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream, audioStream]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuOpen && !target.closest(".menu-container")) setMenuOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  const filteredTastings = useMemo(() => {
    const lowerSearch = filters.search.trim().toLowerCase();
    const lowerStyle = filters.style.trim().toLowerCase();
    const minScore = filters.minScore ? Number(filters.minScore) : null;
    const minHeat = filters.minHeat ? Number(filters.minHeat) : null;

    const results = tastings.filter((item) => {
      if (lowerSearch) {
        const combined = `${item.name} ${item.maker}`.toLowerCase();
        if (!combined.includes(lowerSearch)) return false;
      }
      if (lowerStyle && !item.style.toLowerCase().includes(lowerStyle)) return false;
      if (filters.date && item.date !== filters.date) return false;
      if (minScore !== null && (item.score ?? -1) < minScore) return false;
      if (minHeat !== null && (item.heatUser ?? -1) < minHeat) return false;
      return true;
    });

    return [...results].sort((a, b) => {
      if (filters.sortBy === "name") return a.name.localeCompare(b.name);
      if (filters.sortBy === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (filters.sortBy === "style") return a.style.localeCompare(b.style);
      if (filters.sortBy === "heat") return (b.heatUser ?? -1) - (a.heatUser ?? -1);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filters, tastings]);

  const activeFilterCount = [filters.minScore, filters.minHeat, filters.style, filters.date].filter(Boolean).length;

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    setErrorMessage("");
    try {
      const session = await signIn(username, password);
      setAuth({ status: "signedIn", token: session.getIdToken().getJwtToken(), username });
      setMenuOpen(false);
    } catch (error) {
      setErrorMessage((error as Error).message);
    }
  };

  const handleSignOut = () => {
    signOut();
    setAuth({ status: "signedOut", token: "", username: "" });
    closeForm();
    setMenuOpen(false);
  };

  const openAddForm = () => {
    setFormMode("add");
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowManualFields(false);
    clearMedia();
    setFormOpen(true);
  };

  const openEditForm = (record: TastingRecord) => {
    setFormMode("edit");
    setEditingId(record.id);
    setForm({
      name: record.name || "",
      maker: record.maker || "",
      date: record.date || "",
      score: record.score !== null ? String(record.score) : "",
      style: record.style || "",
      heatUser: record.heatUser !== null ? String(record.heatUser) : "",
      heatVendor: record.heatVendor !== null ? String(record.heatVendor) : "",
      tastingNotesUser: record.tastingNotesUser || "",
      tastingNotesVendor: record.tastingNotesVendor || "",
      productUrl: record.productUrl || ""
    });
    setShowManualFields(true);
    setImagePreview(record.imageUrl || "");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormMode("add");
    setEditingId(null);
    setShowManualFields(false);
    clearMedia();
  };

  const clearMedia = () => {
    setImagePreview("");
    setImageBase64("");
    setImageMimeType("");
    setAudioUrl("");
    setAudioBase64("");
    setAudioMimeType("");
  };

  const startCamera = async () => {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraStream(stream);
      setCameraActive(true);
    } catch {
      setErrorMessage("Camera access denied or unavailable.");
    }
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStream(null);
    setCameraActive(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) {
      setErrorMessage("Camera preview is not ready.");
      return;
    }
    const video = videoRef.current;
    await waitForVideoReady(video);
    const canvas = document.createElement("canvas");
    const { width, height } = getVideoDimensions(video, cameraStream);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const base64Payload = dataUrl.split(",")[1] ?? "";
    if (base64Payload.length < 100) {
      setErrorMessage("Unable to capture photo. Try again.");
      return;
    }
    setImagePreview(dataUrl);
    setImageBase64(dataUrl);
    setImageMimeType("image/jpeg");
    stopCamera();
  };

  const clearPhoto = () => {
    setImagePreview("");
    setImageBase64("");
    setImageMimeType("");
  };

  const startRecording = async () => {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setAudioMimeType(recorder.mimeType || "audio/webm");
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const base64 = await fileToBase64(blob);
        setAudioBase64(base64);
        stream.getTracks().forEach((track) => track.stop());
        setAudioStream(null);
      };
      recorder.start();
      recorderRef.current = recorder;
      setAudioStream(stream);
      setIsRecording(true);
    } catch {
      setErrorMessage("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setIsRecording(false);
  };

  const clearRecording = () => {
    setAudioUrl("");
    setAudioBase64("");
    setAudioMimeType("");
  };

  const hasMedia = Boolean(imageBase64 || audioBase64);
  const hasManualData = Boolean(form.name.trim() || form.maker.trim());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (auth.status !== "signedIn") {
      setErrorMessage("Sign in to save.");
      return;
    }

    // For add mode without manual fields, require at least some media
    if (formMode === "add" && !showManualFields && !hasMedia) {
      setErrorMessage("Please capture a photo or record a voice note.");
      return;
    }

    const payload: CreateTastingInput = {
      // Only include manual fields if they have values (they take precedence)
      name: form.name.trim() || undefined,
      maker: form.maker.trim() || undefined,
      date: form.date || undefined,
      score: toNumberOrNull(form.score),
      style: form.style.trim() || undefined,
      heatUser: toNumberOrNull(form.heatUser),
      heatVendor: toNumberOrNull(form.heatVendor),
      tastingNotesUser: form.tastingNotesUser.trim() || undefined,
      tastingNotesVendor: form.tastingNotesVendor.trim() || undefined,
      productUrl: form.productUrl.trim() || undefined,
      imageBase64: imageBase64 || undefined,
      imageMimeType: imageMimeType || undefined,
      voiceBase64: audioBase64 || undefined,
      voiceMimeType: audioMimeType || undefined
    };

    setSubmitStatus("saving");
    setErrorMessage("");

    try {
      if (formMode === "edit" && editingId) {
        // For edit mode, we'd call an update API
        // For now, simulate by updating local state
        setTastings((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  name: form.name.trim() || t.name,
                  maker: form.maker.trim() || t.maker,
                  date: form.date || t.date,
                  score: toNumberOrNull(form.score) ?? t.score,
                  style: form.style.trim() || t.style,
                  heatUser: toNumberOrNull(form.heatUser) ?? t.heatUser,
                  heatVendor: toNumberOrNull(form.heatVendor) ?? t.heatVendor,
                  tastingNotesUser: form.tastingNotesUser.trim() || t.tastingNotesUser,
                  tastingNotesVendor: form.tastingNotesVendor.trim() || t.tastingNotesVendor,
                  productUrl: form.productUrl.trim() || t.productUrl,
                  needsAttention: false,
                  attentionReason: undefined
                }
              : t
          )
        );
        setSubmitStatus("saved");
        closeForm();
      } else {
        await createTasting(payload, auth.token);
        setLoading(true);
        try {
          const data = await fetchTastings();
          setTastings(data);
        } finally {
          setLoading(false);
        }
        setSubmitStatus("saved");
        closeForm();
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setSubmitStatus("idle");
    }
  };

  const handleRerun = async (record: TastingRecord) => {
    if (auth.status !== "signedIn") {
      setErrorMessage("Sign in to rerun.");
      return;
    }
    if (!record.imageKey && !record.voiceKey) {
      setErrorMessage("No media available to rerun.");
      return;
    }
    setErrorMessage("");
    setRerunId(record.id);
    try {
      await rerunTasting(record.id, auth.token);
      setTastings((prev) =>
        prev.map((item) =>
          item.id === record.id
            ? {
                ...item,
                status: "pending",
                processingError: undefined
              }
            : item
        )
      );
      setLoading(true);
      try {
        const data = await fetchTastings();
        setTastings(data);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setRerunId(null);
    }
  };

  const openDeleteModal = (record: TastingRecord) => {
    if (auth.status !== "signedIn") {
      setErrorMessage("Sign in to delete.");
      return;
    }
    setDeleteTarget(record);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteStatus("idle");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    if (auth.status !== "signedIn") {
      setErrorMessage("Sign in to delete.");
      return;
    }
    setErrorMessage("");
    setDeleteStatus("deleting");
    try {
      await deleteTasting(deleteTarget.id, auth.token);
      setTastings((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      closeDeleteModal();
    } catch (error) {
      setErrorMessage((error as Error).message);
      setDeleteStatus("idle");
    }
  };

  return (
    <div className="app">
      {/* Compact Header */}
      <header className="header">
        <div className="header-brand">
          <h1>Scorchbook</h1>
          <span className="header-tagline">Hot Sauce Log</span>
        </div>

        <div className="header-actions">
          {auth.status === "signedIn" && (
            <button className="add-btn" onClick={() => (formOpen ? closeForm() : openAddForm())} title={formOpen ? "Close" : "Add tasting"}>
              {formOpen ? "×" : "+"}
            </button>
          )}

          <div className="menu-container">
            <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }} aria-label="Menu">
              <span className="menu-icon" />
            </button>

            {menuOpen && (
              <div className="menu-dropdown">
                {auth.status === "signedIn" ? (
                  <>
                    <div className="menu-user">
                      <span className="menu-user-label">Signed in as</span>
                      <span className="menu-user-name">{auth.username || "Taster"}</span>
                    </div>
                    <button className="menu-item" onClick={handleSignOut}>Sign out</button>
                  </>
                ) : auth.status === "signedOut" ? (
                  <form className="menu-auth-form" onSubmit={handleSignIn}>
                    <input name="username" placeholder="Username" required autoComplete="username" />
                    <input name="password" type="password" placeholder="Password" required autoComplete="current-password" />
                    <button type="submit">Sign in</button>
                  </form>
                ) : (
                  <div className="menu-loading">Loading...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-main">
          <button
            className={`filter-toggle ${filtersExpanded ? "active" : ""} ${activeFilterCount > 0 ? "has-filters" : ""}`}
            onClick={() => setFiltersExpanded((prev) => !prev)}
            title="Filters"
          >
            <span className="filter-icon">⚙</span>
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
          <select
            value={filters.sortBy}
            onChange={(e) => setFilters((prev) => ({ ...prev, sortBy: e.target.value as Filters["sortBy"] }))}
            className="sort-select"
            title="Sort by"
          >
            <option value="date">New</option>
            <option value="name">A-Z</option>
            <option value="score">Top</option>
            <option value="heat">Hot</option>
          </select>
          <div className="search-field">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              placeholder="Search sauces..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>

        {filtersExpanded && (
          <div className="filter-panel">
            <div className="filter-row">
              <HeatSlider value={filters.minHeat} onChange={(val) => setFilters((prev) => ({ ...prev, minHeat: val }))} label="Min Heat" />
              <ScoreSlider value={filters.minScore} onChange={(val) => setFilters((prev) => ({ ...prev, minScore: val }))} label="Min Score" />
            </div>
            <div className="filter-row">
              <div className="filter-field">
                <label>Style</label>
                <input placeholder="e.g. Habanero" value={filters.style} onChange={(e) => setFilters((prev) => ({ ...prev, style: e.target.value }))} />
              </div>
              <div className="filter-field">
                <label>Date</label>
                <input type="date" value={filters.date} onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))} />
              </div>
              {activeFilterCount > 0 && (
                <button className="clear-filters" onClick={() => setFilters(defaultFilters)}>Clear all</button>
              )}
            </div>
          </div>
        )}
      </div>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      {/* Add/Edit Form */}
      {formOpen && (
        <section className="add-panel">
          <div className="form-header">
            <h2>{formMode === "edit" ? "Edit Tasting" : "New Tasting"}</h2>
            <button type="button" className="close-btn" onClick={closeForm}>×</button>
          </div>

          <form className="add-form" onSubmit={handleSubmit}>
            {/* Media Capture - Primary */}
            <div className="media-primary">
              <p className="media-hint">
                {formMode === "add"
                  ? "Capture a photo and/or record your tasting notes. Our AI will extract the details."
                  : "Update the photo or recording, or edit the fields below."}
              </p>

              <div className="media-row">
                <div className="media-capture">
                  <span className="media-label">📷 Photo</span>
                  {imagePreview ? (
                    <div className="media-preview">
                      <img src={imagePreview} alt="Bottle" />
                      <button type="button" className="media-clear" onClick={clearPhoto}>Remove</button>
                    </div>
                  ) : cameraActive ? (
                    <div className="camera-active">
                      <video ref={videoRef} playsInline muted autoPlay />
                      <button type="button" className="capture-btn" onClick={capturePhoto}>Capture</button>
                    </div>
                  ) : (
                    <button type="button" className="media-start" onClick={startCamera}>
                      Open Camera
                    </button>
                  )}
                </div>

                <div className="media-capture">
                  <span className="media-label">🎙️ Voice Note</span>
                  {audioUrl ? (
                    <div className="media-preview">
                      <audio controls src={audioUrl} />
                      <button type="button" className="media-clear" onClick={clearRecording}>Remove</button>
                    </div>
                  ) : isRecording ? (
                    <div className="recording-active">
                      <span className="recording-indicator">Recording...</span>
                      <button type="button" className="stop-btn" onClick={stopRecording}>Stop</button>
                    </div>
                  ) : (
                    <button type="button" className="media-start" onClick={startRecording}>
                      Start Recording
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Manual Fields Toggle */}
            <div className="manual-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={showManualFields}
                  onChange={(e) => setShowManualFields(e.target.checked)}
                />
                <span>{formMode === "edit" ? "Edit fields" : "Add details manually"}</span>
              </label>
              {!showManualFields && hasManualData && (
                <span className="has-data-hint">Has manual data</span>
              )}
            </div>

            {/* Manual Fields */}
            {showManualFields && (
              <div className="manual-fields">
                <div className="form-grid">
                  <label>
                    Name
                    <input
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Sauce name"
                    />
                  </label>
                  <label>
                    Maker
                    <input
                      value={form.maker}
                      onChange={(e) => setForm((prev) => ({ ...prev, maker: e.target.value }))}
                      placeholder="Brand/Maker"
                    />
                  </label>
                  <label>
                    Style
                    <input
                      value={form.style}
                      onChange={(e) => setForm((prev) => ({ ...prev, style: e.target.value }))}
                      placeholder="e.g. Habanero"
                    />
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </label>
                  <label className="span-2">
                    Product URL
                    <input
                      type="url"
                      value={form.productUrl}
                      onChange={(e) => setForm((prev) => ({ ...prev, productUrl: e.target.value }))}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="rating-section">
                  <div className="rating-group">
                    <span className="rating-title">Your Score (0-10)</span>
                    <ScoreSelector value={form.score} onChange={(val) => setForm((prev) => ({ ...prev, score: val }))} showLabel={false} />
                  </div>
                  <div className="rating-group">
                    <span className="rating-title">Your Heat (1-5)</span>
                    <PepperSelector value={form.heatUser} onChange={(val) => setForm((prev) => ({ ...prev, heatUser: val }))} showLabel={false} />
                  </div>
                  <div className="rating-group">
                    <span className="rating-title">Vendor Heat (1-5)</span>
                    <PepperSelector value={form.heatVendor} onChange={(val) => setForm((prev) => ({ ...prev, heatVendor: val }))} showLabel={false} />
                  </div>
                </div>

                <div className="notes-section">
                  <label>
                    Your Tasting Notes
                    <textarea
                      rows={3}
                      value={form.tastingNotesUser}
                      onChange={(e) => setForm((prev) => ({ ...prev, tastingNotesUser: e.target.value }))}
                      placeholder="Flavor profile, impressions..."
                    />
                  </label>
                  <label>
                    Vendor Description
                    <textarea
                      rows={2}
                      value={form.tastingNotesVendor}
                      onChange={(e) => setForm((prev) => ({ ...prev, tastingNotesVendor: e.target.value }))}
                      placeholder="Official description..."
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={closeForm}>Cancel</button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitStatus === "saving" || (formMode === "add" && !showManualFields && !hasMedia)}
              >
                {submitStatus === "saving" ? "Saving..." : formMode === "edit" ? "Save Changes" : "Save Tasting"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Content */}
      <main className="content">
        <div className="content-header">
          <span className="content-count">{filteredTastings.length} {filteredTastings.length === 1 ? "sauce" : "sauces"}</span>
        </div>

        {loading ? (
          <div className="loading">Loading your collection...</div>
        ) : filteredTastings.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🌶️</span>
            <p>{tastings.length === 0 ? "No sauces yet. Add your first tasting!" : "No sauces match your filters."}</p>
          </div>
        ) : (
          <div className="card-grid">
            {filteredTastings.map((item) => (
              <article className={`card ${item.needsAttention ? "needs-attention" : ""}`} key={item.id}>
                {item.needsAttention && (
                  <div className="attention-banner">
                    <span>⚠️ Needs attention</span>
                    {item.attentionReason && <span className="attention-reason">{item.attentionReason}</span>}
                  </div>
                )}
                {item.imageUrl && (
                  <div className="card-image">
                    <img src={item.imageUrl} alt={item.name} loading="lazy" />
                  </div>
                )}
                <div className="card-body">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">{item.name || "Untitled"}</h3>
                      <p className="card-maker">{item.maker || "Unknown"}</p>
                    </div>
                    {auth.status === "signedIn" && (
                      <button className="edit-btn" onClick={() => openEditForm(item)} title="Edit">
                        ✎
                      </button>
                    )}
                  </div>
                  <div className="card-ratings">
                    <div className="card-rating">
                      <span className="card-rating-label">Score</span>
                      <ScoreDisplay value={item.score} />
                    </div>
                    <div className="card-rating">
                      <span className="card-rating-label">Heat</span>
                      <HeatDisplay value={item.heatUser} />
                    </div>
                  </div>
                  <div className="card-meta">
                    {item.status && item.status !== "complete" && (
                      <span className={`card-status status-${item.status}`}>{formatStatus(item.status)}</span>
                    )}
                    {item.style && <span className="card-tag">{item.style}</span>}
                    {item.date && <span className="card-date">{formatDate(item.date)}</span>}
                  </div>
                  {item.status === "error" && item.processingError && (
                    <div className="card-alert" role="alert">
                      <span className="card-alert-title">Processing error</span>
                      <span className="card-alert-message">{item.processingError}</span>
                    </div>
                  )}
                  {item.tastingNotesUser && <p className="card-notes">{item.tastingNotesUser}</p>}
                  {item.productUrl && (
                    <a className="card-link" href={item.productUrl} target="_blank" rel="noreferrer">View Product</a>
                  )}
                  {auth.status === "signedIn" && (
                    <div className="card-actions">
                      {(item.imageKey || item.voiceKey) && (
                        <button
                          className="rerun-btn"
                          onClick={() => handleRerun(item)}
                          disabled={rerunId === item.id}
                          title="Re-run the enrichment pipeline"
                        >
                          {rerunId === item.id ? "Re-running..." : "Rerun pipeline"}
                        </button>
                      )}
                      <button className="delete-btn" onClick={() => openDeleteModal(item)} title="Delete tasting">
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={closeDeleteModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete tasting?</h3>
              <button type="button" className="modal-close" onClick={closeDeleteModal} aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                This will permanently remove{" "}
                <strong>{deleteTarget.name || "this tasting"}</strong>.
              </p>
              <p className="modal-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={closeDeleteModal} disabled={deleteStatus === "deleting"}>
                Cancel
              </button>
              <button type="button" className="btn-danger" onClick={confirmDelete} disabled={deleteStatus === "deleting"}>
                {deleteStatus === "deleting" ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <span>Copyright © 2025</span>
        <a href="https://ahara.io" target="_blank" rel="noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
    </div>
  );
};

export default App;
