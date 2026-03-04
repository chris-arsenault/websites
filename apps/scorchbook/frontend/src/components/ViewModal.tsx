import { HeatDisplay, ScoreDisplay } from "./display";
import type { TastingRecord } from "../types";

const formatDate = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

type ViewModalProps = {
  record: TastingRecord;
  onClose: () => void;
};

export function ViewModal({ record, onClose }: ViewModalProps) {
  const productType = record.productType ?? "sauce";

  return (
    <div className="view-overlay" onClick={onClose}>
      <article className="view-modal" onClick={(e) => e.stopPropagation()}>
        {/* Hero Section */}
        <div className="view-hero-section">
          {record.imageUrl ? (
            <img className="view-hero-img" src={record.imageUrl} alt={record.name || "Tasting"} />
          ) : (
            <div className="view-hero-empty">
              <span>{productType === "drink" ? "🥤" : "🌶️"}</span>
            </div>
          )}
          <button type="button" className="view-close" onClick={onClose}>×</button>
        </div>

        {/* Product Info */}
        <div className="view-content">
          <header className="view-header-info">
            <div className="view-title-group">
              <h2>{record.name || "Untitled"}</h2>
              <span className="view-maker">{record.maker || "Unknown maker"}</span>
            </div>
            <div className="view-ratings-inline">
              <div className="view-rating-item">
                <ScoreDisplay value={record.score} />
              </div>
              {productType !== "drink" && record.heatUser !== null && (
                <div className="view-rating-item view-heat">
                  <HeatDisplay value={record.heatUser} />
                </div>
              )}
            </div>
          </header>

          {/* Quick Info Bar */}
          <div className="view-quick-info">
            {record.style && <span className="view-tag">{record.style}</span>}
            {record.date && <span className="view-date">{formatDate(record.date)}</span>}
            {productType !== "drink" && record.heatVendor !== null && (
              <span className="view-vendor-heat">
                Vendor: <HeatDisplay value={record.heatVendor} />
              </span>
            )}
            {record.productUrl && (
              <a className="view-product-link" href={record.productUrl} target="_blank" rel="noreferrer">
                Product Page →
              </a>
            )}
          </div>

          {/* Notes Section */}
          {(record.tastingNotesUser || record.tastingNotesVendor) && (
            <div className="view-notes">
              {record.tastingNotesUser && (
                <div className="view-note">
                  <span className="view-note-label">Tasting Notes</span>
                  <p>{record.tastingNotesUser}</p>
                </div>
              )}
              {record.tastingNotesVendor && (
                <div className="view-note view-note-vendor">
                  <span className="view-note-label">Vendor Description</span>
                  <p>{record.tastingNotesVendor}</p>
                </div>
              )}
            </div>
          )}

          {/* Extracted Data */}
          {(record.ingredients?.length || record.nutritionFacts) && (
            <div className="view-details-row">
              {record.ingredients && record.ingredients.length > 0 && (
                <details className="view-details-block" open>
                  <summary>Ingredients</summary>
                  <div className="view-ingredients">
                    {record.ingredients.map((ing, i) => (
                      <span key={i}>{ing}</span>
                    ))}
                  </div>
                </details>
              )}
              {record.nutritionFacts && (
                <details className="view-details-block" open>
                  <summary>Nutrition Facts</summary>
                  <dl className="view-nutrition">
                    {record.nutritionFacts.servingSize && <><dt>Serving</dt><dd>{record.nutritionFacts.servingSize}</dd></>}
                    {record.nutritionFacts.calories !== undefined && <><dt>Calories</dt><dd>{record.nutritionFacts.calories}</dd></>}
                    {record.nutritionFacts.sodium && <><dt>Sodium</dt><dd>{record.nutritionFacts.sodium}</dd></>}
                    {record.nutritionFacts.totalCarbs && <><dt>Carbs</dt><dd>{record.nutritionFacts.totalCarbs}</dd></>}
                    {record.nutritionFacts.sugars && <><dt>Sugars</dt><dd>{record.nutritionFacts.sugars}</dd></>}
                    {record.nutritionFacts.protein && <><dt>Protein</dt><dd>{record.nutritionFacts.protein}</dd></>}
                  </dl>
                </details>
              )}
            </div>
          )}

          {/* Source Images */}
          {(record.ingredientsImageUrl || record.nutritionImageUrl) && (
            <details className="view-source-images">
              <summary>View Source Images</summary>
              <div className="view-media-grid">
                {record.ingredientsImageUrl && (
                  <div className="view-media-slot">
                    <img src={record.ingredientsImageUrl} alt="Ingredients label" />
                    <span>Ingredients</span>
                  </div>
                )}
                {record.nutritionImageUrl && (
                  <div className="view-media-slot">
                    <img src={record.nutritionImageUrl} alt="Nutrition facts" />
                    <span>Nutrition</span>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </article>
    </div>
  );
}
