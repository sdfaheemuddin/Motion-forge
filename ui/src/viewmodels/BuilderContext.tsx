import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Asset,
  Bundle,
  Documents,
  Job,
  ProjectSummary,
  Tab,
  ValidationResult,
} from "../models/types";
import { api } from "../services/api";
import {
  historyReducer,
  initialHistory,
  projectDoc,
  sceneEntries,
  timelineDoc,
  removeElement,
  elementById,
  sceneById,
  assetDoc,
} from "./projectModel";
import { addLayout, addPresentationScene, layouts } from "./presentationModel";
import { createElement, addScene, duplicateElement } from "./sceneModel";

function useBuilderModel() {
  const [history, dispatch] = useReducer(historyReducer, initialHistory);
  const [tab, setTab] = useState<Tab>("projects");
  const [projects, setProjects] = useState<ProjectSummary[]>([]),
    [templates, setTemplates] = useState<ProjectSummary[]>([]);
  const [sceneId, setSceneId] = useState(""),
    [elementId, setElementId] = useState("");
  const [time, setTime] = useState(0),
    [busy, setBusy] = useState(""),
    [toast, setToast] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]),
    [previewUrl, setPreviewUrl] = useState(""),
    [previewTime, setPreviewTime] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false),
    [connected, setConnected] = useState(true);
  const current = useRef(history);
  current.current = history;
  const bundle = history.bundle;
  const dirty = !!bundle && JSON.stringify(bundle.documents) !== history.saved;
  const fail = useCallback((error: unknown) => {
    setToast(error instanceof Error ? error.message : String(error));
  }, []);

  const refresh = useCallback(async () => {
    const [p, t] = await Promise.all([api.projects(), api.templates()]);
    setProjects(p.projects);
    setTemplates(t.templates);
    setConnected(true);
    return p.projects;
  }, []);
  const load = useCallback((value: Bundle) => {
    dispatch({ type: "load", bundle: value });
    const first = sceneEntries(value.documents)[0]?.scene;
    setSceneId(first?.id ?? "");
    setElementId(first?.elements?.[0]?.id ?? "");
    setTime(0);
    setValidation(null);
    setPreviewUrl("");
    setPreviewTime(null);
    localStorage.setItem("motion-forge-project", value.project);
  }, []);
  const open = useCallback(
    async (project: string) => {
      if (busy) {
        setToast(
          "Wait for the current operation before opening another project.",
        );
        return;
      }
      const state = current.current;
      if (
        state.bundle &&
        JSON.stringify(state.bundle.documents) !== state.saved &&
        !window.confirm("Discard unsaved changes and open another project?")
      )
        return;
      setBusy("Opening project");
      try {
        load(await api.open(project));
        setTab("scenes");
      } catch (error) {
        fail(error);
      } finally {
        setBusy("");
      }
    },
    [load, fail, busy],
  );
  useEffect(() => {
    let alive = true;
    refresh()
      .then(async (list) => {
        const previous = localStorage.getItem("motion-forge-project");
        const preferred =
          list.find((item) => item.project === previous) ??
          list.find((item) => item.id === "pvinsight-blueprint") ??
          list[0];
        if (preferred) {
          const data = await api.open(preferred.project);
          if (alive) load(data);
        }
      })
      .catch((error) => {
        if (alive) {
          fail(error);
          setConnected(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [refresh, load, fail]);
  useEffect(() => {
    const poll = async () => {
      try {
        setJobs((await api.jobs()).jobs);
        setConnected(true);
      } catch {
        setConnected(false);
      }
    };
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 8000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const edit = useCallback((update: (documents: Documents) => void) => {
    if (current.current.bundle?.readOnly) {
      setToast("Create a project from this template before editing.");
      return;
    }
    dispatch({ type: "edit", update });
    setValidation(null);
  }, []);
  const save = useCallback(async (): Promise<Bundle | null> => {
    const value = current.current.bundle;
    if (!value) return null;
    setBusy("Saving project");
    try {
      const saved = await api.save(value);
      dispatch({ type: "saved", bundle: saved, submitted: value.documents });
      setValidation({ valid: true, errors: [] });
      await refresh();
      setToast("Project saved");
      return saved;
    } catch (error) {
      fail(error);
      return null;
    } finally {
      setBusy("");
    }
  }, [refresh, fail]);
  const validate = useCallback(async () => {
    const value = current.current.bundle;
    if (!value) return;
    setBusy("Checking project");
    try {
      const result = await api.validate(value);
      setValidation(result);
      if (result.valid) setToast("Project is valid. Ready to render.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  }, [fail]);
  const create = async (name: string, template?: string) => {
    if (busy) return false;
    if (
      dirty &&
      !window.confirm("Discard unsaved changes and create a project?")
    )
      return false;
    setBusy("Creating project");
    try {
      load(await api.create(name, template));
      await refresh();
      setTab("scenes");
      setToast("Project created");
      return true;
    } catch (error) {
      fail(error);
      return false;
    } finally {
      setBusy("");
    }
  };
  const upload = async (files: FileList | File[]) => {
    const value = current.current.bundle;
    if (!value || value.readOnly) return;
    const all = Array.from(files);
    try {
      for (let index = 0; index < all.length; index++) {
        setBusy(`Importing asset ${index + 1} of ${all.length}`);
        const result = await api.upload(value.project, all[index]);
        dispatch({ type: "upload", ...result });
      }
      setToast(
        `${all.length} asset${all.length === 1 ? "" : "s"} imported. Save to keep the registration.`,
      );
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };
  const selectScene = (id: string) => {
    setSceneId(id);
    const docs = current.current.bundle?.documents;
    if (!docs) return;
    setElementId(sceneById(docs, id)?.elements?.[0]?.id ?? "");
    const clips = timelineDoc(docs).clips.filter((clip) => clip.scene === id);
    if (
      !clips.some(
        (clip) => clip.start <= time && time < clip.start + clip.duration,
      ) &&
      clips[0]
    )
      setTime(clips[0].start);
  };
  const add = (type: string, asset?: Asset) => {
    const value = current.current.bundle;
    if (!value || !sceneId) return;
    const owner = sceneById(value.documents, sceneId)?.id ?? sceneId;
    const item = createElement(value.documents, owner, type, asset?.id);
    edit((documents) => {
      sceneById(documents, owner)!.elements.push(item);
    });
    setElementId(item.id);
    selectScene(owner);
    setElementId(item.id);
    setTab("layouts");
  };
  const updateElement = (
    id: string,
    update: (element: NonNullable<ReturnType<typeof elementById>>) => void,
  ) =>
    edit((documents) => {
      const element = elementById(documents, sceneId, id);
      if (element) update(element);
    });
  const removeSelected = () => {
    if (!elementId) return;
    edit((documents) => removeElement(documents, sceneId, elementId));
    setElementId("");
  };
  const duplicateSelected = () => {
    if (!bundle || !elementId) return;
    const copy = structuredClone(bundle.documents);
    const id = duplicateElement(copy, sceneId, elementId);
    if (id) {
      edit((documents) => {
        Object.assign(documents, copy);
      });
      setElementId(id);
    }
  };
  const newScene = () => {
    if (!bundle) return;
    const copy = structuredClone(bundle.documents),
      id =
        (layouts(copy).length || addLayout(copy), addPresentationScene(copy));
    edit((documents) => Object.assign(documents, copy));
    setSceneId(id);
    setElementId("title");
    setTime(timelineDoc(copy).clips.find((clip) => clip.scene === id)!.start);
  };
  const renderFrame = async () => {
    const value = current.current.bundle;
    if (!value) return;
    setBusy("Rendering accurate preview");
    try {
      const at = Math.min(
        time,
        projectDoc(value.documents).timeline.duration -
          1 / projectDoc(value.documents).timeline.fps,
      );
      const image = await api.preview(value, at);
      setPreviewUrl(URL.createObjectURL(image));
      setPreviewTime(at);
      setToast("Engine preview ready");
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };
  const render = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy("Starting export");
    try {
      const job = await api.render(saved.project);
      setJobs((previous) => [
        job,
        ...previous.filter((item) => item.id !== job.id),
      ]);
      setToast("Export queued. You can keep working in other tabs.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };
  const undo = useCallback(() => dispatch({ type: "undo" }), []),
    redo = useCallback(() => dispatch({ type: "redo" }), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      const tag = (event.target as HTMLElement)?.tagName;
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
        (event.target as HTMLElement)?.isContentEditable
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (event.key === "Delete" && tab === "scenes") {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const project = bundle ? projectDoc(bundle.documents) : null;
  const selected = bundle
    ? elementById(bundle.documents, sceneId, elementId)
    : undefined;
  const activeJob = jobs.find(
    (job) => job.status === "running" || job.status === "queued",
  );
  return {
    history,
    bundle,
    project,
    dirty,
    tab,
    setTab,
    projects,
    templates,
    refresh,
    open,
    create,
    save,
    edit,
    validate,
    validation,
    setValidation,
    sceneId,
    selectScene,
    elementId,
    setElementId,
    selected,
    add,
    updateElement,
    removeSelected,
    duplicateSelected,
    newScene,
    time,
    setTime,
    busy,
    toast,
    setToast,
    fail,
    upload,
    jobs,
    activeJob,
    render,
    renderFrame,
    previewUrl,
    previewTime,
    undo,
    redo,
    showJson,
    setShowJson,
    connected,
  };
}
type BuilderModel = ReturnType<typeof useBuilderModel>;
const BuilderContext = createContext<BuilderModel | null>(null);
export function BuilderProvider({ children }: { children: ReactNode }) {
  const model = useBuilderModel();
  return (
    <BuilderContext.Provider value={model}>{children}</BuilderContext.Provider>
  );
}
export function useBuilder() {
  const value = useContext(BuilderContext);
  if (!value) throw new Error("Video builder context is missing");
  return value;
}
