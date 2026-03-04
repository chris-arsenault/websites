import { useEffect, type FormEvent } from "react";
import { useCamera } from "../hooks/useCamera";
import { useRecorder } from "../hooks/useRecorder";
import { PepperSelector, ScoreSelector } from "./display";
import type { FormState } from "../hooks/useTastings";
import type { ProductType, TastingRecord } from "../types";

type TastingFormProps = {
  formMode: "add" | "edit";
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  showManualFields: boolean;
  setShowManualFields: (v: boolean) => void;
  mediaExpanded: boolean;
  setMediaExpanded: (v: boolean) => void;
  submitStatus: "idle" | "saving" | "saved";
  viewingRecord: TastingRecord | null;
  productType: ProductType | "all";
  onSubmit: (mediaData: {
    imageBase64: string;
    imageMimeType: string;
    ingredientsImageBase64: string;
    ingredientsImageMimeType: string;
    nutritionImageBase64: string;
    nutritionImageMimeType: string;
    audioBase64: string;
    audioMimeType: string;
  }) => void;
  onClose: () => void;
  onError: (msg: string) => void;
};

export function TastingForm({
  formMode,
  form,
  setForm,
  showManualFields,
  setShowManualFields,
  mediaExpanded,
  setMediaExpanded,
  submitStatus,
  viewingRecord,
  productType,
  onSubmit,
  onClose,
  onError
}: TastingFormProps) {
  const [productRef, productCamera] = useCamera(onError);
  const [ingredientsRef, ingredientsCamera] = useCamera(onError);
  const [nutritionRef, nutritionCamera] = useCamera(onError);
  const recorder = useRecorder(onError);

  // Set existing image previews when editing
  useEffect(() => {
    if (formMode === "edit" && viewingRecord) {
      productCamera.setExistingPreview(viewingRecord.imageUrl || "");
      ingredientsCamera.setExistingPreview(viewingRecord.ingredientsImageUrl || "");
      nutritionCamera.setExistingPreview(viewingRecord.nutritionImageUrl || "");
    }
  }, [formMode, viewingRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop cameras when form closes
  useEffect(() => {
    return () => {
      productCamera.stop();
      ingredientsCamera.stop();
      nutritionCamera.stop();
      if (recorder.isRecording) recorder.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMedia = Boolean(productCamera.base64 || ingredientsCamera.base64 || nutritionCamera.base64 || recorder.audioBase64);

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      imageBase64: productCamera.base64,
      imageMimeType: productCamera.mimeType,
      ingredientsImageBase64: ingredientsCamera.base64,
      ingredientsImageMimeType: ingredientsCamera.mimeType,
      nutritionImageBase64: nutritionCamera.base64,
      nutritionImageMimeType: nutritionCamera.mimeType,
      audioBase64: recorder.audioBase64,
      audioMimeType: recorder.audioMimeType
    });
  };

  const formProductType = viewingRecord?.productType ?? (formMode === "add" ? productType : "sauce");

  return (
    <div className="form-overlay" onClick={onClose}>
      <section className="form-modal" onClick={(e) => e.stopPropagation()}>
        <header className="form-header">
          <h2>{formMode === "edit" ? "Edit Tasting" : "New Tasting"}</h2>
          <button type="button" className="form-close" onClick={onClose}>×</button>
        </header>

        <form className="form-body" onSubmit={handleFormSubmit}>
          {/* Media Capture */}
          <section className="form-section">
            <div className="form-section-header">
              <h3>📷 Photos</h3>
              {formMode === "edit" && (
                <button type="button" className="form-section-toggle" onClick={() => setMediaExpanded(!mediaExpanded)}>
                  {mediaExpanded ? "Hide" : "Edit"}
                </button>
              )}
            </div>
            {(formMode === "add" || mediaExpanded) && (
              <div className="media-grid">
                {/* Main Photo */}
                <div className={`media-slot ${productCamera.preview ? "has-image" : ""}`}>
                  {productCamera.preview ? (
                    <>
                      <img src={productCamera.preview} alt="Product" />
                      <button type="button" className="media-remove" onClick={productCamera.clear}>×</button>
                    </>
                  ) : productCamera.active ? (
                    <div className="media-camera">
                      <video ref={productRef} playsInline muted autoPlay />
                      <button type="button" onClick={productCamera.capture}>📸 Capture</button>
                    </div>
                  ) : (
                    <button type="button" className="media-add" onClick={productCamera.start}>
                      <span>📷</span>
                      <small>Product</small>
                    </button>
                  )}
                </div>
                {/* Ingredients Photo */}
                <div className={`media-slot media-slot-sm ${ingredientsCamera.preview ? "has-image" : ""}`}>
                  {ingredientsCamera.preview ? (
                    <>
                      <img src={ingredientsCamera.preview} alt="Ingredients" />
                      <button type="button" className="media-remove" onClick={ingredientsCamera.clear}>×</button>
                    </>
                  ) : ingredientsCamera.active ? (
                    <div className="media-camera">
                      <video ref={ingredientsRef} playsInline muted autoPlay />
                      <button type="button" onClick={ingredientsCamera.capture}>📸</button>
                    </div>
                  ) : (
                    <button type="button" className="media-add" onClick={ingredientsCamera.start}>
                      <span>📋</span>
                      <small>Ingredients</small>
                    </button>
                  )}
                </div>
                {/* Nutrition Photo */}
                <div className={`media-slot media-slot-sm ${nutritionCamera.preview ? "has-image" : ""}`}>
                  {nutritionCamera.preview ? (
                    <>
                      <img src={nutritionCamera.preview} alt="Nutrition" />
                      <button type="button" className="media-remove" onClick={nutritionCamera.clear}>×</button>
                    </>
                  ) : nutritionCamera.active ? (
                    <div className="media-camera">
                      <video ref={nutritionRef} playsInline muted autoPlay />
                      <button type="button" onClick={nutritionCamera.capture}>📸</button>
                    </div>
                  ) : (
                    <button type="button" className="media-add" onClick={nutritionCamera.start}>
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
                {recorder.audioUrl ? (
                  <div className="voice-preview">
                    <audio controls src={recorder.audioUrl} />
                    <button type="button" onClick={recorder.clear}>Remove</button>
                  </div>
                ) : recorder.isRecording ? (
                  <div className="voice-recording">
                    <span className="voice-pulse" />
                    <span>Recording...</span>
                    <button type="button" onClick={recorder.stop}>Stop</button>
                  </div>
                ) : (
                  <button type="button" className="voice-start" onClick={recorder.start}>
                    🎙️ Record tasting notes
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Details Section */}
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
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit" disabled={submitStatus === "saving" || (formMode === "add" && !showManualFields && !hasMedia)}>
              {submitStatus === "saving" ? "Saving..." : "Save"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
