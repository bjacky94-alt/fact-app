import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function SelectCustom({ value, onChange, children, className = "", disabled = false, style = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  const options = React.Children.toArray(children).filter(
    (child) => child.type === "option"
  );

  const selectedOption = options.find((opt) => opt.props.value === value);
  const selectedLabel = selectedOption ? selectedOption.props.children : "";

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (optValue) => {
    onChange({ target: { value: optValue } });
    setIsOpen(false);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        ...style,
      }}
    >
      <button
        className={`${className} select-custom-trigger`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        type="button"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 36,
          paddingLeft: 12,
          paddingRight: 12,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: `linear-gradient(180deg, var(--surface), var(--surface2))`,
          color: "var(--text)",
          fontSize: 13,
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        }}
        onFocus={(e) => {
          e.target.style.borderColor = "rgba(99, 102, 241, 0.6)";
          e.target.style.boxShadow = "0 0 0 4px var(--ring)";
        }}
        onBlur={(e) => {
          e.target.style.borderColor = "";
          e.target.style.boxShadow = "";
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDown
          size={16}
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {isOpen && (
        <div
          className="select-custom-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
            zIndex: 1000,
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.props.value}
              type="button"
              onClick={() => handleSelect(opt.props.value)}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 12px",
                textAlign: "left",
                border: "none",
                background:
                  opt.props.value === value
                    ? "var(--ring)"
                    : "transparent",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 14,
                fontFamily: "inherit",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (opt.props.value !== value) {
                  e.target.style.background = "rgba(99, 102, 241, 0.1)";
                }
              }}
              onMouseLeave={(e) => {
                if (opt.props.value !== value) {
                  e.target.style.background = "transparent";
                }
              }}
            >
              {opt.props.children}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
