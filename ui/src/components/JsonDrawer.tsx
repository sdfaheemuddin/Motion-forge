import { useEffect, useState } from "react";
import { X, Code2, Check } from "lucide-react";
import { api } from "../services/api";
import { useBuilder } from "../viewmodels/BuilderContext";

export function JsonDrawer() {
  const vm = useBuilder(),
    [file, setFile] = useState("project.json"),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (vm.bundle && vm.showJson) {
      setText(JSON.stringify(vm.bundle.documents[file] ?? {}, null, 2));
      setError("");
    }
  }, [file, vm.showJson, vm.bundle?.project]);
  if (!vm.showJson || !vm.bundle) return null;
  return (
    <div className="json-shade">
      <aside
        className="json-drawer"
        role="dialog"
        aria-label="Advanced JSON editor"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">ADVANCED</p>
            <h2>
              <Code2 size={20} />
              Project JSON
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close JSON editor"
            onClick={() => vm.setShowJson(false)}
          >
            <X size={20} />
          </button>
        </div>
        <select
          aria-label="JSON document"
          value={file}
          onChange={(event) => setFile(event.target.value)}
        >
          {Object.keys(vm.bundle.documents).map((path) => (
            <option key={path}>{path}</option>
          ))}
        </select>
        <textarea
          aria-label="JSON content"
          spellCheck={false}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
        />
        {error && <p className="inline-error">{error}</p>}
        <p className="field-note">
          Apply updates the working draft. The complete draft is validated
          before applying changes.
        </p>
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() => {
              setText(JSON.stringify(vm.bundle!.documents[file], null, 2));
              setError("");
            }}
          >
            Reset editor
          </button>
          <button
            className="button primary"
            onClick={async () => {
              try {
                const data = JSON.parse(text);
                if (
                  data === null ||
                  typeof data !== "object" ||
                  Array.isArray(data)
                )
                  throw new Error(
                    "A configuration document must be a JSON object.",
                  );
                const candidate = {
                  ...vm.bundle!,
                  documents: { ...vm.bundle!.documents, [file]: data },
                };
                const result = await api.validate(candidate);
                if (!result.valid) throw new Error(result.errors.join("\n"));
                vm.edit((documents) => {
                  documents[file] = data;
                });
                vm.setToast("JSON applied to draft");
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : String(error),
                );
              }
            }}
          >
            <Check size={15} />
            Apply JSON
          </button>
        </div>
      </aside>
    </div>
  );
}
