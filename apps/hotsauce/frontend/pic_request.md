# Image Asset Requests for Scorchbook

These are **optional** enhancements that would add extra visual polish. The app works great without them, but these would take it to the next level.

---

## 1. Background Texture - Aged Paper

**Purpose:** Replace the CSS-only paper texture with a real texture for more authenticity
**File name:** `paper-texture.png`
**Location:** `/src/assets/paper-texture.png`
**Content:** Subtle aged/worn paper texture, slightly yellowed/cream colored. Should be seamless/tileable. Low contrast so it doesn't interfere with readability.
**Size:** 400x400px, PNG with transparency or JPG
**Usage:** Will be used as `background-image` on body, tiled

---

## 2. Logo/Wordmark (Optional)

**Purpose:** Replace text "Scorchbook" with a proper logo
**File name:** `logo.svg` or `logo.png`
**Location:** `/src/assets/logo.svg`
**Content:** Bold, vintage-style hot sauce label wordmark. Think classic Americana hot sauce labels - bold condensed type, maybe with a flame accent or chili pepper integrated. Colors: flame red (#D62828) with gold (#FCBF49) accents on dark/transparent background.
**Size:** SVG preferred (scalable), or 600px wide PNG with transparency

---

## 3. Decorative Flame/Fire Element

**Purpose:** Add to hero section or buttons for extra flair
**File name:** `flame-accent.svg`
**Location:** `/src/assets/flame-accent.svg`
**Content:** Simple stylized flame illustration. Should work as a small accent element. Single color (ember orange #E85D04) or gradient from gold to red.
**Size:** SVG preferred, approximately 60-80px when used
**Style:** Slightly vintage/hand-drawn feel, not too realistic

---

## 4. Empty State Illustration

**Purpose:** Show when there are no tastings in the list
**File name:** `empty-bottles.svg` or `empty-bottles.png`
**Location:** `/src/assets/empty-bottles.svg`
**Content:** Illustration of empty hot sauce bottles or a sad/waiting chili pepper character. Friendly and fun, not too detailed. Monochrome or limited palette (use the smoke/soot colors).
**Size:** 200-300px wide
**Style:** Simple line art or flat illustration style

---

## 5. Stamp/Badge Graphics (Set of 3)

**Purpose:** Decorative stamps for cards showing heat levels or special designations
**File names:**
- `stamp-hot.svg` (for high heat items)
- `stamp-favorite.svg` (for top-rated)
- `stamp-new.svg` (for recent entries)

**Location:** `/src/assets/stamps/`
**Content:** Vintage circular rubber stamp style graphics. Slightly distressed/worn look. Text like "SCORCHING", "TOP PICK", "FRESH"
**Size:** 60-80px diameter
**Colors:** Single color - flame red (#D62828) with slight transparency to look printed

---

## Priority Order

1. **Paper texture** - Biggest visual impact for least effort
2. **Logo** - Strengthens brand identity
3. **Empty state** - Improves UX for new users
4. **Flame accent** - Nice to have decorative element
5. **Stamps** - Future feature enhancement

---

## Implementation Notes

Once you add these images, I can update the CSS to use them. For the paper texture, it would replace the current CSS gradient pattern in `index.css` body styles.

For the logo, we'd update the hero `h1` to use an `img` tag or background image instead of text.
