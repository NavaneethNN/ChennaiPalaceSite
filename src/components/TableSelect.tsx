"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

type TableChoice = {
  number: number;
  status: "available" | "yours" | "occupied";
};

export default function TableSelect({
  value,
  choices,
  loading,
  onChange,
}: {
  value: string;
  choices: TableChoice[];
  loading: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const selected = choices.find((choice) => String(choice.number) === value);
  const available = choices.filter((choice) => choice.status !== "occupied");
  const disabled = loading || choices.length === 0;
  const activeChoice = available.find((choice) => choice.number === active);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (open && active !== null) {
      const option = document.getElementById(`${id}-option-${active}`);
      const list = option?.parentElement;
      if (option && list) {
        const optionRect = option.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        if (optionRect.top < listRect.top)
          list.scrollTop -= listRect.top - optionRect.top;
        else if (optionRect.bottom > listRect.bottom)
          list.scrollTop += optionRect.bottom - listRect.bottom;
      }
    }
  }, [open, active, id]);

  const show = (last = false) => {
    setActive(
      available.find((choice) => String(choice.number) === value)?.number ??
        (last ? available.at(-1)?.number : available[0]?.number) ??
        null,
    );
    setOpen(true);
  };
  const choose = (choice: TableChoice) => {
    if (choice.status === "occupied") return;
    onChange(String(choice.number));
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className="ops-field table-select"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <label id={`${id}-label`} htmlFor={`${id}-trigger`}>
        Table number
      </label>
      <button
        id={`${id}-trigger`}
        ref={trigger}
        type="button"
        className="table-select-trigger"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required="true"
        aria-activedescendant={
          open && activeChoice ? `${id}-option-${active}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (
            ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
          ) {
            event.preventDefault();
            if (!open) {
              show(event.key === "ArrowUp" || event.key === "End");
              return;
            }
            const index = available.findIndex(
              (choice) => choice.number === active,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? available.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        available.length - 1,
                        index + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    );
            setActive(available[next]?.number ?? null);
          } else if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            if (activeChoice) choose(activeChoice);
          } else if (event.key === "Tab") {
            setOpen(false);
          }
        }}
      >
        <span className={selected ? "" : "table-select-placeholder"}>
          {loading
            ? "Loading tables…"
            : selected
              ? `Table ${selected.number}`
              : choices.length
                ? "Select your table"
                : "No tables available"}
        </span>
        {selected?.status === "yours" && <small>Your table</small>}
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div className="table-select-panel">
          <div className="table-select-hint">Choose where you’re sitting</div>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="table-select-options"
          >
            {choices.map((choice) => (
              <div
                id={`${id}-option-${choice.number}`}
                key={choice.number}
                role="option"
                aria-selected={String(choice.number) === value}
                aria-disabled={choice.status === "occupied"}
                className={`table-select-option${choice.number === active ? " is-active" : ""}`}
                onPointerMove={() =>
                  choice.status !== "occupied" && setActive(choice.number)
                }
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(choice)}
              >
                <span>Table {choice.number}</span>
                <small>
                  {choice.status === "occupied"
                    ? "In use"
                    : choice.status === "yours"
                      ? "Your table"
                      : "Available"}
                </small>
                {String(choice.number) === value && (
                  <Check size={16} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
