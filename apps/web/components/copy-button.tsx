"use client";

import { useState } from "react";

import { Icon } from "./icons";

export function CopyButton({ value, label = "Copiar hash" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button className="button button-ghost button-small" onClick={() => void copy()} type="button">
      <Icon name={copied ? "check" : "copy"} size={16} />
      {copied ? "Copiado" : label}
    </button>
  );
}

export function ShareButton({ title, text }: { title: string; text: string }) {
  const [shared, setShared] = useState(false);

  async function share(): Promise<void> {
    if (navigator.share) {
      await navigator.share({ title, text });
    } else {
      await navigator.clipboard.writeText(text);
    }
    setShared(true);
    window.setTimeout(() => setShared(false), 1600);
  }

  return (
    <button className="button button-secondary" onClick={() => void share()} type="button">
      <Icon name={shared ? "check" : "link"} size={17} />
      {shared ? "Enlace copiado" : "Compartir prueba"}
    </button>
  );
}
