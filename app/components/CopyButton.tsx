import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({
  text,
  label = "Copy",
  copiedLabel,
  tone = "light",
  showLabel = false,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  tone?: "light" | "dark";
  showLabel?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      console.error("clipboard copy failed");
    }
  };
  const className = ["copy-btn", tone === "dark" ? "copy-btn-dark" : "", showLabel ? "copy-btn-labeled" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={className} onClick={copy} aria-label={label} title={label} type="button">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {showLabel && <span>{copied ? (copiedLabel ?? label) : label}</span>}
    </button>
  );
}
