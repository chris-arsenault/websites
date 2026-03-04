import { HeatDisplay, ScoreDisplay } from "./display";
import type { AuthState } from "../hooks/useAuth";
import type { TastingRecord } from "../types";

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

type TastingCardProps = {
  item: TastingRecord;
  auth: AuthState;
  productTypeFilter: string;
  rerunId: string | null;
  onView: () => void;
  onEdit: () => void;
  onRerun: () => void;
  onDelete: () => void;
};

export function TastingCard({ item, auth, productTypeFilter, rerunId, onView, onEdit, onRerun, onDelete }: TastingCardProps) {
  return (
    <article className={`card ${item.needsAttention ? "needs-attention" : ""} ${(item.productType ?? "sauce") === "drink" ? "card-drink" : "card-sauce"}`}>
      <div className="card-image" onClick={onView}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} loading="lazy" />
        ) : (
          <div className="card-image-empty">
            {(item.productType ?? "sauce") === "drink" ? "🥤" : "🌶️"}
          </div>
        )}
        {productTypeFilter === "all" && (
          <span className={`card-badge ${(item.productType ?? "sauce") === "drink" ? "badge-drink" : "badge-sauce"}`}>
            {(item.productType ?? "sauce") === "drink" ? "🥤" : "🌶️"}
          </span>
        )}
        {item.needsAttention && <span className="card-attention">!</span>}
      </div>

      <div className="card-content">
        <header className="card-header">
          <h3>{item.name || "Untitled"}</h3>
          <p>{item.maker || "Unknown"}</p>
        </header>

        <div className="card-ratings">
          <ScoreDisplay value={item.score} />
          {(item.productType ?? "sauce") === "sauce" && <HeatDisplay value={item.heatUser} />}
        </div>

        <div className="card-meta">
          {item.style && <span className="card-tag">{item.style}</span>}
          {item.date && <span className="card-date">{formatDate(item.date)}</span>}
          {item.status && item.status !== "complete" && (
            <span className={`card-status ${item.status === "error" ? "status-error" : ""}`}>
              {formatStatus(item.status)}
            </span>
          )}
        </div>

        {item.tastingNotesUser && <p className="card-notes">{item.tastingNotesUser}</p>}

        {item.status === "error" && item.processingError && (
          <div className="card-error">
            <span>Error:</span> {item.processingError}
          </div>
        )}

        <footer className="card-footer">
          <button className="card-view-btn" onClick={onView}>View Details</button>
          {auth.status === "signedIn" && (
            <div className="card-actions">
              <button onClick={onEdit} title="Edit">Edit</button>
              {(item.imageKey || item.ingredientsImageKey || item.nutritionImageKey) && (
                <button onClick={onRerun} disabled={rerunId === item.id} title="Rerun AI">
                  {rerunId === item.id ? "..." : "↻"}
                </button>
              )}
              <button className="card-delete" onClick={onDelete} title="Delete">×</button>
            </div>
          )}
        </footer>
      </div>
    </article>
  );
}
