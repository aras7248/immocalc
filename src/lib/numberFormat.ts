/** Legacy parsing rule: a single dot after one digit is decimal (3.571 = 3.571),
 * after multiple digits with exactly three following digits it is a thousands separator.
 * Use a decimal comma for unambiguous German entry; behavior is retained for old inputs.
 */
// Helper für Zahlen-Parsing und Formatierung
export const parseNumber = (val: string | number) => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (!val) return 0;

  const normalized = val
    .trim()
    .replace(/[\s\u00a0€%]/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized || !/^-?[\d.,]+$/.test(normalized)) return 0;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let cleaned = normalized;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = normalized.split(thousandsSeparator).join("");
    cleaned = cleaned.replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    cleaned = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    const dotCount = (normalized.match(/\./g) || []).length;
    const digitsAfterDot = normalized.length - lastDot - 1;
    const digitsBeforeDot = normalized.replace("-", "").slice(0, lastDot).length;
    const looksLikeGermanThousands = dotCount > 1 || (digitsAfterDot === 3 && digitsBeforeDot > 1);
    cleaned = looksLikeGermanThousands ? normalized.replace(/\./g, "") : normalized;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatAcc = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return "0,00";
  return val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

