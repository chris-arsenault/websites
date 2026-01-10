import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Fuse from "fuse.js";
import "./App.css";
import { createTasting, deleteTasting, fetchTastings, rerunTasting, updateTastingMedia } from "./api";
import { getSession, signIn, signOut } from "./auth";
import type { CreateTastingInput, Filters, ProductType, TastingRecord, UpdateTastingMediaInput } from "./types";

const getStoredProductType = (): ProductType | "all" => {
  const stored = localStorage.getItem("productTypeFilter");
  if (stored === "sauce" || stored === "drink" || stored === "all") return stored;
  return "all";
};

const defaultFilters: Filters = {
  productType: getStoredProductType(),
  search: "",
  style: "",
  ingredient: "",
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
  ingredients_extracted: "Reading ingredients",
  nutrition_extracted: "Reading nutrition facts",
  back_extracted: "Reading label",
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
  const [viewingRecord, setViewingRecord] = useState<TastingRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showManualFields, setShowManualFields] = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);

  // Media state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ingredientsVideoRef = useRef<HTMLVideoElement | null>(null);
  const nutritionVideoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [ingredientsCameraActive, setIngredientsCameraActive] = useState(false);
  const [nutritionCameraActive, setNutritionCameraActive] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [imageMimeType, setImageMimeType] = useState("");
  const [ingredientsImagePreview, setIngredientsImagePreview] = useState("");
  const [ingredientsImageBase64, setIngredientsImageBase64] = useState("");
  const [ingredientsImageMimeType, setIngredientsImageMimeType] = useState("");
  const [nutritionImagePreview, setNutritionImagePreview] = useState("");
  const [nutritionImageBase64, setNutritionImageBase64] = useState("");
  const [nutritionImageMimeType, setNutritionImageMimeType] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [ingredientsCameraStream, setIngredientsCameraStream] = useState<MediaStream | null>(null);
  const [nutritionCameraStream, setNutritionCameraStream] = useState<MediaStream | null>(null);

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

  // Persist productType filter to localStorage
  useEffect(() => {
    localStorage.setItem("productTypeFilter", filters.productType);
  }, [filters.productType]);

  useEffect(() => {
    if (!formOpen) {
      stopCamera();
      stopIngredientsCamera();
      stopNutritionCamera();
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
    const video = ingredientsVideoRef.current;
    if (!ingredientsCameraStream || !ingredientsCameraActive || !video) return;
    video.srcObject = ingredientsCameraStream;
    const startPreview = async () => {
      try {
        await video.play();
      } catch {
        setErrorMessage("Unable to start camera preview.");
      }
    };
    startPreview();
    return () => {
      if (video.srcObject === ingredientsCameraStream) {
        video.srcObject = null;
      }
    };
  }, [ingredientsCameraStream, ingredientsCameraActive]);

  useEffect(() => {
    const video = nutritionVideoRef.current;
    if (!nutritionCameraStream || !nutritionCameraActive || !video) return;
    video.srcObject = nutritionCameraStream;
    const startPreview = async () => {
      try {
        await video.play();
      } catch {
        setErrorMessage("Unable to start camera preview.");
      }
    };
    startPreview();
    return () => {
      if (video.srcObject === nutritionCameraStream) {
        video.srcObject = null;
      }
    };
  }, [nutritionCameraStream, nutritionCameraActive]);

  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
      ingredientsCameraStream?.getTracks().forEach((track) => track.stop());
      nutritionCameraStream?.getTracks().forEach((track) => track.stop());
      audioStream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream, ingredientsCameraStream, nutritionCameraStream, audioStream]);

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
    const ingredientQuery = filters.ingredient.trim();
    const minScore = filters.minScore ? Number(filters.minScore) : null;
    const minHeat = filters.minHeat ? Number(filters.minHeat) : null;

    let results = tastings.filter((item) => {
      // Product type filter (treat undefined as "sauce" for backwards compatibility)
      if (filters.productType !== "all") {
        const itemType = item.productType ?? "sauce";
        if (itemType !== filters.productType) return false;
      }
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

    // Fuzzy ingredient search with Fuse.js
    if (ingredientQuery && results.length > 0) {
      const fuse = new Fuse(results, {
        keys: ["ingredients"],
        threshold: 0.4,
        ignoreLocation: true,
        useExtendedSearch: true
      });
      results = fuse.search(ingredientQuery).map((r) => r.item);
    }

    return [...results].sort((a, b) => {
      if (filters.sortBy === "name") return a.name.localeCompare(b.name);
      if (filters.sortBy === "score") return (b.score ?? -1) - (a.score ?? -1);
      if (filters.sortBy === "style") return a.style.localeCompare(b.style);
      if (filters.sortBy === "heat") return (b.heatUser ?? -1) - (a.heatUser ?? -1);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filters, tastings]);

  const activeFilterCount = [filters.minScore, filters.minHeat, filters.style, filters.ingredient, filters.date].filter(Boolean).length;

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
    closeViewModal();
    setMenuOpen(false);
  };

  const openAddForm = () => {
    setFormMode("add");
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowManualFields(false);
    setMediaExpanded(true);
    setViewOpen(false);
    setViewingRecord(null);
    clearMedia();
    setFormOpen(true);
  };

  const openEditForm = (record: TastingRecord) => {
    setFormMode("edit");
    setEditingId(record.id);
    setViewingRecord(record);
    setMediaExpanded(false);
    setViewOpen(false);
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
    setIngredientsImagePreview(record.ingredientsImageUrl || "");
    setNutritionImagePreview(record.nutritionImageUrl || "");
    setFormOpen(true);
  };

  const openViewModal = (record: TastingRecord) => {
    setViewingRecord(record);
    setViewOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormMode("add");
    setEditingId(null);
    setViewingRecord(null);
    setShowManualFields(false);
    setMediaExpanded(true);
    clearMedia();
  };

  const closeViewModal = () => {
    setViewOpen(false);
    setViewingRecord(null);
  };

  const clearMedia = () => {
    setImagePreview("");
    setImageBase64("");
    setImageMimeType("");
    setIngredientsImagePreview("");
    setIngredientsImageBase64("");
    setIngredientsImageMimeType("");
    setNutritionImagePreview("");
    setNutritionImageBase64("");
    setNutritionImageMimeType("");
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

  const startIngredientsCamera = async () => {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setIngredientsCameraStream(stream);
      setIngredientsCameraActive(true);
    } catch {
      setErrorMessage("Camera access denied or unavailable.");
    }
  };

  const stopIngredientsCamera = () => {
    ingredientsCameraStream?.getTracks().forEach((track) => track.stop());
    if (ingredientsVideoRef.current) {
      ingredientsVideoRef.current.srcObject = null;
    }
    setIngredientsCameraStream(null);
    setIngredientsCameraActive(false);
  };

  const captureIngredientsPhoto = async () => {
    if (!ingredientsVideoRef.current) {
      setErrorMessage("Camera preview is not ready.");
      return;
    }
    const video = ingredientsVideoRef.current;
    await waitForVideoReady(video);
    const canvas = document.createElement("canvas");
    const { width, height } = getVideoDimensions(video, ingredientsCameraStream);
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
    setIngredientsImagePreview(dataUrl);
    setIngredientsImageBase64(dataUrl);
    setIngredientsImageMimeType("image/jpeg");
    stopIngredientsCamera();
  };

  const clearIngredientsPhoto = () => {
    setIngredientsImagePreview("");
    setIngredientsImageBase64("");
    setIngredientsImageMimeType("");
  };

  const startNutritionCamera = async () => {
    setErrorMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setNutritionCameraStream(stream);
      setNutritionCameraActive(true);
    } catch {
      setErrorMessage("Camera access denied or unavailable.");
    }
  };

  const stopNutritionCamera = () => {
    nutritionCameraStream?.getTracks().forEach((track) => track.stop());
    if (nutritionVideoRef.current) {
      nutritionVideoRef.current.srcObject = null;
    }
    setNutritionCameraStream(null);
    setNutritionCameraActive(false);
  };

  const captureNutritionPhoto = async () => {
    if (!nutritionVideoRef.current) {
      setErrorMessage("Camera preview is not ready.");
      return;
    }
    const video = nutritionVideoRef.current;
    await waitForVideoReady(video);
    const canvas = document.createElement("canvas");
    const { width, height } = getVideoDimensions(video, nutritionCameraStream);
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
    setNutritionImagePreview(dataUrl);
    setNutritionImageBase64(dataUrl);
    setNutritionImageMimeType("image/jpeg");
    stopNutritionCamera();
  };

  const clearNutritionPhoto = () => {
    setNutritionImagePreview("");
    setNutritionImageBase64("");
    setNutritionImageMimeType("");
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

  const hasMedia = Boolean(imageBase64 || ingredientsImageBase64 || nutritionImageBase64 || audioBase64);

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
      ingredientsImageBase64: ingredientsImageBase64 || undefined,
      ingredientsImageMimeType: ingredientsImageMimeType || undefined,
      nutritionImageBase64: nutritionImageBase64 || undefined,
      nutritionImageMimeType: nutritionImageMimeType || undefined,
      voiceBase64: audioBase64 || undefined,
      voiceMimeType: audioMimeType || undefined
    };

    setSubmitStatus("saving");
    setErrorMessage("");

    try {
      if (formMode === "edit" && editingId) {
        const hasMediaUpdates = Boolean(imageBase64 || ingredientsImageBase64 || nutritionImageBase64);
        const mediaPayload: UpdateTastingMediaInput = {
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
          ingredientsImageBase64: ingredientsImageBase64 || undefined,
          ingredientsImageMimeType: ingredientsImageMimeType || undefined,
          nutritionImageBase64: nutritionImageBase64 || undefined,
          nutritionImageMimeType: nutritionImageMimeType || undefined
        };

        let updatedMedia: TastingRecord | null = null;
        if (hasMediaUpdates) {
          updatedMedia = await updateTastingMedia(editingId, mediaPayload, auth.token);
        }

        setTastings((prev) =>
          prev.map((t) => {
            if (t.id !== editingId) return t;
            const base = updatedMedia ?? t;
            return {
              ...base,
              name: form.name.trim() || base.name,
              maker: form.maker.trim() || base.maker,
              date: form.date || base.date,
              score: toNumberOrNull(form.score) ?? base.score,
              style: form.style.trim() || base.style,
              heatUser: toNumberOrNull(form.heatUser) ?? base.heatUser,
              heatVendor: toNumberOrNull(form.heatVendor) ?? base.heatVendor,
              tastingNotesUser: form.tastingNotesUser.trim() || base.tastingNotesUser,
              tastingNotesVendor: form.tastingNotesVendor.trim() || base.tastingNotesVendor,
              productUrl: form.productUrl.trim() || base.productUrl,
              needsAttention: false,
              attentionReason: undefined
            };
          })
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
    if (!record.imageKey && !record.ingredientsImageKey && !record.nutritionImageKey) {
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

  const brandName = filters.productType === "drink" ? "Quenchbook" : "Scorchbook";
  const brandTagline = filters.productType === "drink" ? "Drink Log" : filters.productType === "all" ? "Taste Log" : "Hot Sauce Log";
  const searchPlaceholder = filters.productType === "drink" ? "Search drinks..." : filters.productType === "all" ? "Search..." : "Search sauces...";
  const itemLabel = filters.productType === "drink" ? "drink" : filters.productType === "all" ? "item" : "sauce";
  const formProductType = viewingRecord?.productType ?? (formMode === "add" ? filters.productType : "sauce");
  const viewProductType = viewingRecord?.productType ?? "sauce";

  return (
    <div className={`app ${filters.productType === "drink" ? "theme-drink" : "theme-sauce"}`}>
      {/* Compact Header */}
      <header className="header">
        <div className="header-brand">
          <h1>{brandName}</h1>
          <span className="header-tagline">{brandTagline}</span>
        </div>

        <div className="product-toggle">
          <button
            className={filters.productType === "sauce" ? "active" : ""}
            onClick={() => setFilters((f) => ({ ...f, productType: "sauce" }))}
            title="Hot Sauces"
          >
            Sauces
          </button>
          <button
            className={filters.productType === "all" ? "active" : ""}
            onClick={() => setFilters((f) => ({ ...f, productType: "all" }))}
            title="All Items"
          >
            All
          </button>
          <button
            className={filters.productType === "drink" ? "active" : ""}
            onClick={() => setFilters((f) => ({ ...f, productType: "drink" }))}
            title="Drinks"
          >
            Drinks
          </button>
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
              placeholder={searchPlaceholder}
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
                <label>Ingredient</label>
                <input placeholder="e.g. Garlic" value={filters.ingredient} onChange={(e) => setFilters((prev) => ({ ...prev, ingredient: e.target.value }))} />
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

      {/* Add/Edit Form Modal */}
      {formOpen && (
        <div className="form-overlay" onClick={closeForm}>
          <section className="form-modal" onClick={(e) => e.stopPropagation()}>
            <header className="form-header">
              <h2>{formMode === "edit" ? "Edit Tasting" : "New Tasting"}</h2>
              <button type="button" className="form-close" onClick={closeForm}>×</button>
            </header>

            <form className="form-body" onSubmit={handleSubmit}>
              {/* Media Capture - Compact Grid */}
              <section className="form-section">
                <div className="form-section-header">
                  <h3>📷 Photos</h3>
                  {formMode === "edit" && (
                    <button type="button" className="form-section-toggle" onClick={() => setMediaExpanded((p) => !p)}>
                      {mediaExpanded ? "Hide" : "Edit"}
                    </button>
                  )}
                </div>
                {(formMode === "add" || mediaExpanded) && (
                  <div className="media-grid">
                    {/* Main Photo */}
                    <div className={`media-slot ${imagePreview ? "has-image" : ""}`}>
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} alt="Product" />
                          <button type="button" className="media-remove" onClick={clearPhoto}>×</button>
                        </>
                      ) : cameraActive ? (
                        <div className="media-camera">
                          <video ref={videoRef} playsInline muted autoPlay />
                          <button type="button" onClick={capturePhoto}>📸 Capture</button>
                        </div>
                      ) : (
                        <button type="button" className="media-add" onClick={startCamera}>
                          <span>📷</span>
                          <small>Product</small>
                        </button>
                      )}
                    </div>
                    {/* Ingredients Photo */}
                    <div className={`media-slot media-slot-sm ${ingredientsImagePreview ? "has-image" : ""}`}>
                      {ingredientsImagePreview ? (
                        <>
                          <img src={ingredientsImagePreview} alt="Ingredients" />
                          <button type="button" className="media-remove" onClick={clearIngredientsPhoto}>×</button>
                        </>
                      ) : ingredientsCameraActive ? (
                        <div className="media-camera">
                          <video ref={ingredientsVideoRef} playsInline muted autoPlay />
                          <button type="button" onClick={captureIngredientsPhoto}>📸</button>
                        </div>
                      ) : (
                        <button type="button" className="media-add" onClick={startIngredientsCamera}>
                          <span>📋</span>
                          <small>Ingredients</small>
                        </button>
                      )}
                    </div>
                    {/* Nutrition Photo */}
                    <div className={`media-slot media-slot-sm ${nutritionImagePreview ? "has-image" : ""}`}>
                      {nutritionImagePreview ? (
                        <>
                          <img src={nutritionImagePreview} alt="Nutrition" />
                          <button type="button" className="media-remove" onClick={clearNutritionPhoto}>×</button>
                        </>
                      ) : nutritionCameraActive ? (
                        <div className="media-camera">
                          <video ref={nutritionVideoRef} playsInline muted autoPlay />
                          <button type="button" onClick={captureNutritionPhoto}>📸</button>
                        </div>
                      ) : (
                        <button type="button" className="media-add" onClick={startNutritionCamera}>
                          <span>📊</span>
                          <small>Nutrition</small>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Voice Note (Add mode only) */}
                {formMode === "add" && (
                  <div className="voice-capture">
                    {audioUrl ? (
                      <div className="voice-preview">
                        <audio controls src={audioUrl} />
                        <button type="button" onClick={clearRecording}>Remove</button>
                      </div>
                    ) : isRecording ? (
                      <div className="voice-recording">
                        <span className="voice-pulse" />
                        <span>Recording...</span>
                        <button type="button" onClick={stopRecording}>Stop</button>
                      </div>
                    ) : (
                      <button type="button" className="voice-start" onClick={startRecording}>
                        🎙️ Record tasting notes
                      </button>
                    )}
                  </div>
                )}
              </section>

              {/* Details Section - Always visible in edit mode, toggle in add mode */}
              {(formMode === "edit" || showManualFields) && (
                <section className="form-section">
                  <h3>Details</h3>
                  <div className="form-fields">
                    <div className="form-row">
                      <label className="form-field form-field-lg">
                        <span>Name</span>
                        <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Product name" />
                      </label>
                      <label className="form-field">
                        <span>Maker</span>
                        <input value={form.maker} onChange={(e) => setForm((p) => ({ ...p, maker: e.target.value }))} placeholder="Brand" />
                      </label>
                    </div>
                    <div className="form-row">
                      <label className="form-field">
                        <span>Style</span>
                        <input value={form.style} onChange={(e) => setForm((p) => ({ ...p, style: e.target.value }))} placeholder="e.g. Habanero" />
                      </label>
                      <label className="form-field">
                        <span>Date</span>
                        <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
                      </label>
                      <label className="form-field">
                        <span>URL</span>
                        <input type="url" value={form.productUrl} onChange={(e) => setForm((p) => ({ ...p, productUrl: e.target.value }))} placeholder="https://..." />
                      </label>
                    </div>
                  </div>
                </section>
              )}

              {/* Ratings Section */}
              {(formMode === "edit" || showManualFields) && (
                <section className="form-section form-ratings">
                  <h3>Ratings</h3>
                  <div className="rating-row">
                    <div className="rating-block">
                      <span className="rating-label">Score</span>
                      <ScoreSelector value={form.score} onChange={(v) => setForm((p) => ({ ...p, score: v }))} showLabel={false} />
                    </div>
                    {formProductType !== "drink" && (
                      <>
                        <div className="rating-block">
                          <span className="rating-label">Your Heat</span>
                          <PepperSelector value={form.heatUser} onChange={(v) => setForm((p) => ({ ...p, heatUser: v }))} showLabel={false} />
                        </div>
                        <div className="rating-block">
                          <span className="rating-label">Vendor Heat</span>
                          <PepperSelector value={form.heatVendor} onChange={(v) => setForm((p) => ({ ...p, heatVendor: v }))} showLabel={false} />
                        </div>
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* Notes Section */}
              {(formMode === "edit" || showManualFields) && (
                <section className="form-section">
                  <h3>Notes</h3>
                  <div className="form-notes">
                    <label>
                      <span>Your Tasting Notes</span>
                      <textarea rows={2} value={form.tastingNotesUser} onChange={(e) => setForm((p) => ({ ...p, tastingNotesUser: e.target.value }))} placeholder="Flavor, impressions..." />
                    </label>
                    <label>
                      <span>Vendor Description</span>
                      <textarea rows={2} value={form.tastingNotesVendor} onChange={(e) => setForm((p) => ({ ...p, tastingNotesVendor: e.target.value }))} placeholder="Official description..." />
                    </label>
                  </div>
                </section>
              )}

              {/* Add mode: toggle for manual entry */}
              {formMode === "add" && !showManualFields && (
                <button type="button" className="form-toggle-manual" onClick={() => setShowManualFields(true)}>
                  + Add details manually
                </button>
              )}

              {/* Form Actions */}
              <footer className="form-footer">
                <button type="button" className="btn-cancel" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitStatus === "saving" || (formMode === "add" && !showManualFields && !hasMedia)}>
                  {submitStatus === "saving" ? "Saving..." : "Save"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {/* View Modal */}
      {viewOpen && viewingRecord && (
        <div className="view-overlay" onClick={closeViewModal}>
          <article className="view-modal" onClick={(e) => e.stopPropagation()}>
            {/* Hero Section */}
            <div className="view-hero-section">
              {viewingRecord.imageUrl ? (
                <img className="view-hero-img" src={viewingRecord.imageUrl} alt={viewingRecord.name || "Tasting"} />
              ) : (
                <div className="view-hero-empty">
                  <span>{viewProductType === "drink" ? "🥤" : "🌶️"}</span>
                </div>
              )}
              <button type="button" className="view-close" onClick={closeViewModal}>×</button>
            </div>

            {/* Product Info */}
            <div className="view-content">
              <header className="view-header-info">
                <div className="view-title-group">
                  <h2>{viewingRecord.name || "Untitled"}</h2>
                  <span className="view-maker">{viewingRecord.maker || "Unknown maker"}</span>
                </div>
                <div className="view-ratings-inline">
                  <div className="view-rating-item">
                    <ScoreDisplay value={viewingRecord.score} />
                  </div>
                  {viewProductType !== "drink" && viewingRecord.heatUser !== null && (
                    <div className="view-rating-item view-heat">
                      <HeatDisplay value={viewingRecord.heatUser} />
                    </div>
                  )}
                </div>
              </header>

              {/* Quick Info Bar */}
              <div className="view-quick-info">
                {viewingRecord.style && <span className="view-tag">{viewingRecord.style}</span>}
                {viewingRecord.date && <span className="view-date">{formatDate(viewingRecord.date)}</span>}
                {viewProductType !== "drink" && viewingRecord.heatVendor !== null && (
                  <span className="view-vendor-heat">
                    Vendor: <HeatDisplay value={viewingRecord.heatVendor} />
                  </span>
                )}
                {viewingRecord.productUrl && (
                  <a className="view-product-link" href={viewingRecord.productUrl} target="_blank" rel="noreferrer">
                    Product Page →
                  </a>
                )}
              </div>

              {/* Notes Section */}
              {(viewingRecord.tastingNotesUser || viewingRecord.tastingNotesVendor) && (
                <div className="view-notes">
                  {viewingRecord.tastingNotesUser && (
                    <div className="view-note">
                      <span className="view-note-label">Tasting Notes</span>
                      <p>{viewingRecord.tastingNotesUser}</p>
                    </div>
                  )}
                  {viewingRecord.tastingNotesVendor && (
                    <div className="view-note view-note-vendor">
                      <span className="view-note-label">Vendor Description</span>
                      <p>{viewingRecord.tastingNotesVendor}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Data */}
              {(viewingRecord.ingredients?.length || viewingRecord.nutritionFacts) && (
                <div className="view-details-row">
                  {viewingRecord.ingredients && viewingRecord.ingredients.length > 0 && (
                    <details className="view-details-block" open>
                      <summary>Ingredients</summary>
                      <div className="view-ingredients">
                        {viewingRecord.ingredients.map((ing, i) => (
                          <span key={i}>{ing}</span>
                        ))}
                      </div>
                    </details>
                  )}
                  {viewingRecord.nutritionFacts && (
                    <details className="view-details-block" open>
                      <summary>Nutrition Facts</summary>
                      <dl className="view-nutrition">
                        {viewingRecord.nutritionFacts.servingSize && <><dt>Serving</dt><dd>{viewingRecord.nutritionFacts.servingSize}</dd></>}
                        {viewingRecord.nutritionFacts.calories !== undefined && <><dt>Calories</dt><dd>{viewingRecord.nutritionFacts.calories}</dd></>}
                        {viewingRecord.nutritionFacts.sodium && <><dt>Sodium</dt><dd>{viewingRecord.nutritionFacts.sodium}</dd></>}
                        {viewingRecord.nutritionFacts.totalCarbs && <><dt>Carbs</dt><dd>{viewingRecord.nutritionFacts.totalCarbs}</dd></>}
                        {viewingRecord.nutritionFacts.sugars && <><dt>Sugars</dt><dd>{viewingRecord.nutritionFacts.sugars}</dd></>}
                        {viewingRecord.nutritionFacts.protein && <><dt>Protein</dt><dd>{viewingRecord.nutritionFacts.protein}</dd></>}
                      </dl>
                    </details>
                  )}
                </div>
              )}

              {/* Source Images - Hidden by default */}
              {(viewingRecord.ingredientsImageUrl || viewingRecord.nutritionImageUrl) && (
                <details className="view-source-images">
                  <summary>View Source Images</summary>
                  <div className="view-media-grid">
                    {viewingRecord.ingredientsImageUrl && (
                      <div className="view-media-slot">
                        <img src={viewingRecord.ingredientsImageUrl} alt="Ingredients label" />
                        <span>Ingredients</span>
                      </div>
                    )}
                    {viewingRecord.nutritionImageUrl && (
                      <div className="view-media-slot">
                        <img src={viewingRecord.nutritionImageUrl} alt="Nutrition facts" />
                        <span>Nutrition</span>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </article>
        </div>
      )}

      {/* Content */}
      <main className="content">
        <div className="content-header">
          <span className="content-count">{filteredTastings.length} {filteredTastings.length === 1 ? itemLabel : `${itemLabel}s`}</span>
        </div>

        {loading ? (
          <div className="loading">Loading your collection...</div>
        ) : filteredTastings.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🌶️</span>
            <p>{tastings.length === 0 ? `No ${itemLabel}s yet. Add your first tasting!` : `No ${itemLabel}s match your filters.`}</p>
          </div>
        ) : (
          <div className="card-grid">
            {filteredTastings.map((item) => (
              <article className={`card ${item.needsAttention ? "needs-attention" : ""} ${(item.productType ?? "sauce") === "drink" ? "card-drink" : "card-sauce"}`} key={item.id}>
                {/* Card Image */}
                <div className="card-image" onClick={() => openViewModal(item)}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} loading="lazy" />
                  ) : (
                    <div className="card-image-empty">
                      {(item.productType ?? "sauce") === "drink" ? "🥤" : "🌶️"}
                    </div>
                  )}
                  {filters.productType === "all" && (
                    <span className={`card-badge ${(item.productType ?? "sauce") === "drink" ? "badge-drink" : "badge-sauce"}`}>
                      {(item.productType ?? "sauce") === "drink" ? "🥤" : "🌶️"}
                    </span>
                  )}
                  {item.needsAttention && <span className="card-attention">!</span>}
                </div>

                {/* Card Content */}
                <div className="card-content">
                  <header className="card-header">
                    <h3>{item.name || "Untitled"}</h3>
                    <p>{item.maker || "Unknown"}</p>
                  </header>

                  {/* Inline Ratings */}
                  <div className="card-ratings">
                    <ScoreDisplay value={item.score} />
                    {(item.productType ?? "sauce") === "sauce" && <HeatDisplay value={item.heatUser} />}
                  </div>

                  {/* Meta Row */}
                  <div className="card-meta">
                    {item.style && <span className="card-tag">{item.style}</span>}
                    {item.date && <span className="card-date">{formatDate(item.date)}</span>}
                    {item.status && item.status !== "complete" && (
                      <span className={`card-status ${item.status === "error" ? "status-error" : ""}`}>
                        {formatStatus(item.status)}
                      </span>
                    )}
                  </div>

                  {/* Notes Preview */}
                  {item.tastingNotesUser && (
                    <p className="card-notes">{item.tastingNotesUser}</p>
                  )}

                  {/* Error Alert */}
                  {item.status === "error" && item.processingError && (
                    <div className="card-error">
                      <span>Error:</span> {item.processingError}
                    </div>
                  )}

                  {/* Card Footer */}
                  <footer className="card-footer">
                    <button className="card-view-btn" onClick={() => openViewModal(item)}>
                      View Details
                    </button>
                    {auth.status === "signedIn" && (
                      <div className="card-actions">
                        <button onClick={() => openEditForm(item)} title="Edit">Edit</button>
                        {(item.imageKey || item.ingredientsImageKey || item.nutritionImageKey) && (
                          <button onClick={() => handleRerun(item)} disabled={rerunId === item.id} title="Rerun AI">
                            {rerunId === item.id ? "..." : "↻"}
                          </button>
                        )}
                        <button className="card-delete" onClick={() => openDeleteModal(item)} title="Delete">×</button>
                      </div>
                    )}
                  </footer>
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
