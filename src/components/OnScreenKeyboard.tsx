import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { ChevronDown } from "lucide-react";

type Mode = "text" | "numeric";

const layoutText = {
  default: [
    "1 2 3 4 5 6 7 8 9 0 ß {bksp}",
    "q w e r t z u i o p ü +",
    "{lock} a s d f g h j k l ö ä {enter}",
    "{shift} y x c v b n m , . - {shift}",
    "@ {space} {hide}",
  ],
  shift: [
    "! \" § $ % & / ( ) = ? {bksp}",
    "Q W E R T Z U I O P Ü *",
    "{lock} A S D F G H J K L Ö Ä {enter}",
    "{shift} Y X C V B N M ; : _ {shift}",
    "@ {space} {hide}",
  ],
};

const layoutNumeric = {
  default: [
    "7 8 9",
    "4 5 6",
    "1 2 3",
    "0 . {bksp}",
    "{enter} {hide}",
  ],
};

const display = {
  "{bksp}": "⌫",
  "{enter}": "↵",
  "{shift}": "⇧",
  "{lock}": "⇪",
  "{space}": "Leerzeichen",
  "{hide}": "▼ ausblenden",
};

function isEditable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el.hasAttribute("data-no-osk")) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "file", "button", "submit", "reset", "range", "color", "hidden"].includes(type);
  }
  return false;
}

function getMode(el: HTMLInputElement | HTMLTextAreaElement): Mode {
  if (el.tagName === "INPUT") {
    const i = el as HTMLInputElement;
    const t = i.type;
    if (t === "number" || t === "tel") return "numeric";
    const im = (i.getAttribute("inputmode") || "").toLowerCase();
    if (["numeric", "decimal", "tel"].includes(im)) return "numeric";
  }
  return "text";
}

export function OnScreenKeyboard() {
  const [target, setTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [mode, setMode] = useState<Mode>("text");
  const [layoutName, setLayoutName] = useState<"default" | "shift">("default");
  const [hidden, setHidden] = useState(false);
  const [oskHeight, setOskHeight] = useState(0);
  const keyboardRef = useRef<any>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (!isEditable(el)) {
        setTarget(null);
        return;
      }
      const input = el as HTMLInputElement | HTMLTextAreaElement;
      setTarget(input);
      setMode(getMode(input));
      setLayoutName("default");
      setHidden(false);
      // sync keyboard internal buffer
      requestAnimationFrame(() => {
        keyboardRef.current?.setInput(input.value ?? "");
      });
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = (e as any).relatedTarget as Element | null;
      // keep open if focus moved to the keyboard itself
      if (next && (next as HTMLElement).closest?.("[data-osk-root]")) return;
      setTimeout(() => {
        const active = document.activeElement;
        if (!isEditable(active)) setTarget(null);
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const writeValue = useCallback((value: string) => {
    const el = targetRef.current;
    if (!el) return;
    const proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const onChange = useCallback(
    (value: string) => {
      writeValue(value);
    },
    [writeValue],
  );

  const onKeyPress = useCallback(
    (button: string) => {
      if (button === "{shift}" || button === "{lock}") {
        setLayoutName((l) => (l === "default" ? "shift" : "default"));
        return;
      }
      if (button === "{enter}") {
        const el = targetRef.current;
        if (el?.tagName === "INPUT") {
          const form = (el as HTMLInputElement).form;
          if (form) {
            const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]');
            if (submitter) submitter.click();
            else form.requestSubmit?.();
          }
          (el as HTMLElement).blur();
          setTarget(null);
        } else if (el) {
          // textarea: insert newline
          const cur = el.value;
          writeValue(cur + "\n");
          keyboardRef.current?.setInput(cur + "\n");
        }
        return;
      }
      if (button === "{hide}") {
        setHidden(true);
        return;
      }
    },
    [writeValue],
  );

  const layout = useMemo(
    () => (mode === "numeric" ? layoutNumeric : layoutText),
    [mode],
  );

  if (!target || hidden) {
    return hidden ? (
      <button
        type="button"
        onClick={() => setHidden(false)}
        className="fixed bottom-3 right-3 z-[60] rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg"
      >
        Tastatur
      </button>
    ) : null;
  }

  return (
    <div
      ref={rootRef}
      data-osk-root
      onMouseDown={(e) => e.preventDefault()}
      className="osk-root fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-neutral-900/95 backdrop-blur-xl p-2 shadow-2xl"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between px-2 pb-1 text-[10px] text-white/50">
          <span>{mode === "numeric" ? "Zahlen" : "Tastatur"}</span>
          <button
            type="button"
            onClick={() => setHidden(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-white/70 hover:bg-white/10"
          >
            <ChevronDown className="h-3 w-3" /> ausblenden
          </button>
        </div>
        <Keyboard
          keyboardRef={(r) => (keyboardRef.current = r)}
          layoutName={layoutName}
          layout={layout as any}
          display={display}
          onChange={onChange}
          onKeyPress={onKeyPress}
          theme="hg-theme-default hg-layout-default osk-theme"
          mergeDisplay
        />
      </div>
    </div>
  );
}
