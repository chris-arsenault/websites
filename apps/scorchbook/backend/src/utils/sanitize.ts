import sanitizeHtml from "sanitize-html";

export const sanitizeText = (value: string): string => {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
};

export const sanitizeOptional = (value?: string | null): string => {
  if (!value) {
    return "";
  }
  return sanitizeText(value);
};
