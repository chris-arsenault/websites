import { useEffect, useState } from "react";
import { createTasting, deleteTasting as apiDeleteTasting, fetchTastings, rerunTasting, updateTastingMedia } from "../api";
import type { AuthState } from "./useAuth";
import type { CreateTastingInput, TastingRecord, UpdateTastingMediaInput } from "../types";

type FormMode = "add" | "edit";

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
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

export type FormState = typeof emptyForm;

type MediaData = {
  imageBase64: string;
  imageMimeType: string;
  ingredientsImageBase64: string;
  ingredientsImageMimeType: string;
  nutritionImageBase64: string;
  nutritionImageMimeType: string;
  audioBase64: string;
  audioMimeType: string;
};

const buildEditedRecord = (existing: TastingRecord, base: TastingRecord, formData: FormState): TastingRecord => ({
  ...base,
  name: formData.name.trim() || existing.name,
  maker: formData.maker.trim() || existing.maker,
  date: formData.date || existing.date,
  score: toNumberOrNull(formData.score) ?? existing.score,
  style: formData.style.trim() || existing.style,
  heatUser: toNumberOrNull(formData.heatUser) ?? existing.heatUser,
  heatVendor: toNumberOrNull(formData.heatVendor) ?? existing.heatVendor,
  tastingNotesUser: formData.tastingNotesUser.trim() || existing.tastingNotesUser,
  tastingNotesVendor: formData.tastingNotesVendor.trim() || existing.tastingNotesVendor,
  productUrl: formData.productUrl.trim() || existing.productUrl,
  needsAttention: false,
  attentionReason: undefined
});

export function useTastings(auth: AuthState) {
  const [tastings, setTastings] = useState<TastingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [rerunId, setRerunId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TastingRecord | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting">("idle");

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("add");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<TastingRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [showManualFields, setShowManualFields] = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(true);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    fetchTastings()
      .then((data) => setTastings(data))
      .catch((error: unknown) => setErrorMessage((error as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Helpers to update tastings list (keeps nesting shallow)
  const updateTasting = (id: string, updater: (t: TastingRecord) => TastingRecord) => {
    setTastings((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  };

  const removeTasting = (id: string) => {
    setTastings((prev) => prev.filter((t) => t.id !== id));
  };

  const reloadTastings = () => {
    setLoading(true);
    fetchTastings()
      .then((data) => setTastings(data))
      .catch((error: unknown) => setErrorMessage((error as Error).message))
      .finally(() => setLoading(false));
  };

  const openAddForm = () => {
    setFormMode("add");
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowManualFields(false);
    setMediaExpanded(true);
    setViewOpen(false);
    setViewingRecord(null);
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
  };

  const closeViewModal = () => {
    setViewOpen(false);
    setViewingRecord(null);
  };

  const performEdit = async (id: string, formData: FormState, mediaData: MediaData, token: string) => {
    const hasMediaUpdates = Boolean(mediaData.imageBase64 || mediaData.ingredientsImageBase64 || mediaData.nutritionImageBase64);
    const mediaPayload: UpdateTastingMediaInput = {
      imageBase64: mediaData.imageBase64 || undefined,
      imageMimeType: mediaData.imageMimeType || undefined,
      ingredientsImageBase64: mediaData.ingredientsImageBase64 || undefined,
      ingredientsImageMimeType: mediaData.ingredientsImageMimeType || undefined,
      nutritionImageBase64: mediaData.nutritionImageBase64 || undefined,
      nutritionImageMimeType: mediaData.nutritionImageMimeType || undefined
    };

    const updatedMedia = hasMediaUpdates ? await updateTastingMedia(id, mediaPayload, token) : null;
    updateTasting(id, (t) => buildEditedRecord(t, updatedMedia ?? t, formData));
    setSubmitStatus("saved");
    closeForm();
  };

  const performCreate = async (payload: CreateTastingInput, token: string) => {
    await createTasting(payload, token);
    reloadTastings();
    setSubmitStatus("saved");
    closeForm();
  };

  const handleSubmit = (mediaData: MediaData) => {
    if (auth.status !== "signedIn") {
      setErrorMessage("Sign in to save.");
      return;
    }

    const hasMedia = Boolean(mediaData.imageBase64 || mediaData.ingredientsImageBase64 || mediaData.nutritionImageBase64 || mediaData.audioBase64);
    if (formMode === "add" && !showManualFields && !hasMedia) {
      setErrorMessage("Please capture a photo or record a voice note.");
      return;
    }

    setSubmitStatus("saving");
    setErrorMessage("");

    const payload: CreateTastingInput = {
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
      imageBase64: mediaData.imageBase64 || undefined,
      imageMimeType: mediaData.imageMimeType || undefined,
      ingredientsImageBase64: mediaData.ingredientsImageBase64 || undefined,
      ingredientsImageMimeType: mediaData.ingredientsImageMimeType || undefined,
      nutritionImageBase64: mediaData.nutritionImageBase64 || undefined,
      nutritionImageMimeType: mediaData.nutritionImageMimeType || undefined,
      voiceBase64: mediaData.audioBase64 || undefined,
      voiceMimeType: mediaData.audioMimeType || undefined
    };

    const op = formMode === "edit" && editingId
      ? performEdit(editingId, form, mediaData, auth.token)
      : performCreate(payload, auth.token);

    op.catch((error: unknown) => setErrorMessage((error as Error).message))
      .finally(() => setSubmitStatus("idle"));
  };

  const handleRerun = (record: TastingRecord) => {
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

    rerunTasting(record.id, auth.token)
      .then(() => {
        updateTasting(record.id, (item) => ({ ...item, status: "pending", processingError: undefined }));
        reloadTastings();
      })
      .catch((error: unknown) => setErrorMessage((error as Error).message))
      .finally(() => setRerunId(null));
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

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (auth.status !== "signedIn") {
      setErrorMessage("Sign in to delete.");
      return;
    }
    setErrorMessage("");
    setDeleteStatus("deleting");

    apiDeleteTasting(deleteTarget.id, auth.token)
      .then(() => {
        removeTasting(deleteTarget.id);
        closeDeleteModal();
      })
      .catch((error: unknown) => {
        setErrorMessage((error as Error).message);
        setDeleteStatus("idle");
      });
  };

  return {
    tastings,
    loading,
    errorMessage,
    setErrorMessage,
    submitStatus,
    rerunId,
    deleteTarget,
    deleteStatus,
    formOpen,
    formMode,
    editingId,
    viewingRecord,
    form,
    setForm,
    showManualFields,
    setShowManualFields,
    mediaExpanded,
    setMediaExpanded,
    viewOpen,
    openAddForm,
    openEditForm,
    openViewModal,
    closeForm,
    closeViewModal,
    handleSubmit,
    handleRerun,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete
  };
}
