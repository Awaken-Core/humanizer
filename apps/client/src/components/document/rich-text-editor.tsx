"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  CheckSquare,
  ChevronDown,
  Code2,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Underline,
  Undo2,
} from "lucide-react";
import {
  createDocumentExtensions,
  EMPTY_TIPTAP_DOCUMENT,
} from "./tiptap-extensions";
import { getToolsForContext, type ToolId } from "@/lib/tool-registry";
import { DOCUMENT_TOOL_ICONS } from "./document-tool-icons";
import styles from "./rich-document.module.css";

interface RichTextEditorProps {
  content?: JSONContent | null;
  onChange?: (value: {
    json: JSONContent;
    text: string;
    words: number;
    characters: number;
  }) => void;
  editable?: boolean;
  onRunSelectionTool?: (service: ToolId, text: string) => void;
}

type MenuPosition = {
  left: number;
  top: number;
  slashFrom: number | null;
} | null;

export function RichTextEditor({
  content,
  onChange,
  editable = true,
  onRunSelectionTool,
}: RichTextEditorProps) {
  const [menu, setMenu] = useState<MenuPosition>(null);
  const [textStyleMenuOpen, setTextStyleMenuOpen] = useState(false);
  const [textStyleMenuPosition, setTextStyleMenuPosition] = useState({
    left: 0,
    bottom: 0,
  });
  const [blockPosition, setBlockPosition] = useState(0);
  const [selectionMenu, setSelectionMenu] = useState<{
    left: number;
    top: number;
    text: string;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textStyleControlRef = useRef<HTMLDivElement>(null);
  const textStyleMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  useEffect(() => {
    if (!textStyleMenuOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !textStyleMenuRef.current?.contains(target) &&
        !textStyleControlRef.current?.contains(target)
      ) {
        setTextStyleMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTextStyleMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [textStyleMenuOpen]);

  const openSlashMenu = useCallback(
    (editor: Editor, slashFrom: number | null, anchor?: HTMLElement | null) => {
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        setMenu({ left: rect.left, top: rect.bottom + 8, slashFrom });
        return;
      }
      const coordinates = editor.view.coordsAtPos(editor.state.selection.from);
      setMenu({
        left: coordinates.left,
        top: coordinates.bottom + 8,
        slashFrom,
      });
    },
    [],
  );

  const editor = useEditor(
    {
      extensions: createDocumentExtensions(),
      content: content || EMPTY_TIPTAP_DOCUMENT,
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: styles.proseMirror, spellcheck: "true" },
        handleKeyDown: (view, event) => {
          if (event.key === "/" && view.state.selection.empty) {
            window.setTimeout(() => {
              const instance = editor;
              if (instance)
                openSlashMenu(
                  instance,
                  Math.max(1, instance.state.selection.from - 1),
                );
            }, 0);
          }
          if (event.key === "Escape") setMenu(null);
          return false;
        },
      },
      onUpdate: ({ editor: current }) => {
        onChange?.({
          json: current.getJSON(),
          text: current.getText(),
          words: current.storage.characterCount.words(),
          characters: current.storage.characterCount.characters(),
        });
      },
      onSelectionUpdate: ({ editor: current }) => {
        const { from, to } = current.state.selection;
        if (from === to || !onRunSelectionTool) {
          setSelectionMenu(null);
          return;
        }

        const text = current.state.doc.textBetween(from, to, " ").trim();
        if (!text) {
          setSelectionMenu(null);
          return;
        }

        const start = current.view.coordsAtPos(from);
        const end = current.view.coordsAtPos(to);
        setSelectionMenu({
          left: Math.max(12, (start.left + end.right) / 2),
          top: Math.max(start.bottom, end.bottom) + 9,
          text,
        });
      },
    },
    [editable, onRunSelectionTool],
  );

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") || false,
      italic: current?.isActive("italic") || false,
      underline: current?.isActive("underline") || false,
      strike: current?.isActive("strike") || false,
      link: current?.isActive("link") || false,
      align:
        current?.getAttributes("paragraph").textAlign ||
        current?.getAttributes("heading").textAlign ||
        "left",
      words: current?.storage.characterCount?.words() || 0,
    }),
  });

  if (!editor || !state)
    return <div className={styles.editorLoading}>Preparing editor…</div>;

  const runBlockCommand = (
    command: (chain: ReturnType<Editor["chain"]>) => void,
  ) => {
    let chain = editor.chain().focus();
    if (menu?.slashFrom !== null && menu?.slashFrom !== undefined) {
      chain = chain.deleteRange({
        from: menu.slashFrom,
        to: editor.state.selection.from,
      });
    }
    command(chain);
    setMenu(null);
  };

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous || "https://");
    if (href === null) return;
    if (!href.trim())
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: href.trim() })
        .run();
  };

  const blockCommands = [
    {
      label: "Text",
      icon: Pilcrow,
      run: () => runBlockCommand((chain) => chain.setParagraph().run()),
    },
    {
      label: "Heading 1",
      icon: Heading1,
      run: () =>
        runBlockCommand((chain) => chain.setHeading({ level: 1 }).run()),
    },
    {
      label: "Heading 2",
      icon: Heading2,
      run: () =>
        runBlockCommand((chain) => chain.setHeading({ level: 2 }).run()),
    },
    {
      label: "Heading 3",
      icon: Heading3,
      run: () =>
        runBlockCommand((chain) => chain.setHeading({ level: 3 }).run()),
    },
    {
      label: "Bullet list",
      icon: List,
      run: () => runBlockCommand((chain) => chain.toggleBulletList().run()),
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      run: () => runBlockCommand((chain) => chain.toggleOrderedList().run()),
    },
    {
      label: "Task list",
      icon: CheckSquare,
      run: () => runBlockCommand((chain) => chain.toggleTaskList().run()),
    },
    {
      label: "Quote",
      icon: Quote,
      run: () => runBlockCommand((chain) => chain.toggleBlockquote().run()),
    },
    {
      label: "Code block",
      icon: Braces,
      run: () => runBlockCommand((chain) => chain.toggleCodeBlock().run()),
    },
    {
      label: "Divider",
      icon: Minus,
      run: () => runBlockCommand((chain) => chain.setHorizontalRule().run()),
    },
  ];

  const currentTextStyle = editor.isActive("heading", { level: 1 })
    ? "Heading 1"
    : editor.isActive("heading", { level: 2 })
      ? "Heading 2"
      : editor.isActive("heading", { level: 3 })
        ? "Heading 3"
        : "Text";

  const setTextStyle = (style: "p" | "h1" | "h2" | "h3") => {
    if (style === "p") editor.chain().focus().setParagraph().run();
    else
      editor
        .chain()
        .focus()
        .setHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 })
        .run();
    setTextStyleMenuOpen(false);
  };

  return (
    <div className={styles.editorShell}>
      <div className={styles.editorCanvas}>
        {editable && (
          <DragHandle
            editor={editor}
            onNodeChange={({ pos }) => setBlockPosition(pos)}
          >
            <div className={styles.blockHandle}>
              <button
                type="button"
                aria-label="Insert block"
                onClick={(event) => {
                  event.preventDefault();
                  editor.commands.setTextSelection(
                    Math.max(1, blockPosition + 1),
                  );
                  openSlashMenu(editor, null, event.currentTarget);
                }}
              >
                <Plus size={17} />
              </button>
              <span aria-label="Drag block">
                <GripVertical size={17} />
              </span>
            </div>
          </DragHandle>
        )}
        <EditorContent editor={editor} />
      </div>

      {menu && (
        <div
          ref={menuRef}
          className={styles.slashMenu}
          style={{ left: menu.left, top: menu.top }}
          role="menu"
        >
          <span className={styles.menuLabel}>Insert block</span>
          <div className={styles.commandGrid}>
            {blockCommands.map(({ label, icon: Icon, run }) => (
              <button key={label} type="button" onClick={run} role="menuitem">
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {editable && (
        <div className={styles.bottomBar}>
          <div className={styles.wordCount}>
            {state.words} {state.words === 1 ? "word" : "words"}
          </div>
          <div className={styles.formatToolbar}>
            <div ref={textStyleControlRef} className={styles.textStyleControl}>
              <button
                type="button"
                className={styles.textStyleTrigger}
                aria-label="Text style"
                aria-expanded={textStyleMenuOpen}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setTextStyleMenuPosition({
                    left: rect.left,
                    bottom: window.innerHeight - rect.top + 10,
                  });
                  setTextStyleMenuOpen((open) => !open);
                }}
              >
                <Pilcrow size={15} />
                <span>{currentTextStyle}</span>
                <ChevronDown size={13} />
              </button>
            </div>
            <ToolbarButton
              label="Bold"
              active={state.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold />
            </ToolbarButton>
            <ToolbarButton
              label="Italic"
              active={state.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </ToolbarButton>
            <ToolbarButton
              label="Underline"
              active={state.underline}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline />
            </ToolbarButton>
            <ToolbarButton
              label="Strike"
              active={state.strike}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough />
            </ToolbarButton>
            <label className={styles.colorControl} title="Text color">
              <span>A</span>
              <input
                type="color"
                defaultValue="#5555ff"
                onChange={(event) =>
                  editor.chain().focus().setColor(event.target.value).run()
                }
              />
              <ChevronDown size={12} />
            </label>
            <ToolbarButton
              label="Highlight"
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .toggleHighlight({ color: "#fff2a8" })
                  .run()
              }
            >
              <Highlighter />
            </ToolbarButton>
            <ToolbarButton
              label="Align left"
              active={state.align === "left"}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
            >
              <AlignLeft />
            </ToolbarButton>
            <ToolbarButton
              label="Align center"
              active={state.align === "center"}
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
            >
              <AlignCenter />
            </ToolbarButton>
            <ToolbarButton
              label="Align right"
              active={state.align === "right"}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
            >
              <AlignRight />
            </ToolbarButton>
            <ToolbarButton label="Link" active={state.link} onClick={setLink}>
              <Link2 />
            </ToolbarButton>
            <ToolbarButton
              label="Inline code"
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code2 />
            </ToolbarButton>
            <ToolbarButton
              label="Subscript"
              onClick={() => editor.chain().focus().toggleSubscript().run()}
            >
              <SubscriptIcon />
            </ToolbarButton>
            <ToolbarButton
              label="Superscript"
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
            >
              <SuperscriptIcon />
            </ToolbarButton>
            <ToolbarButton
              label="Clear formatting"
              onClick={() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              }
            >
              <RemoveFormatting />
            </ToolbarButton>
            <ToolbarButton
              label="Undo"
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 />
            </ToolbarButton>
            <ToolbarButton
              label="Redo"
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 />
            </ToolbarButton>
          </div>
        </div>
      )}

      {textStyleMenuOpen &&
        createPortal(
          <div
            ref={textStyleMenuRef}
            className={styles.textStyleMenu}
            style={{
              left: textStyleMenuPosition.left,
              bottom: textStyleMenuPosition.bottom,
            }}
            role="menu"
          >
            <button
              type="button"
              className={
                currentTextStyle === "Text"
                  ? styles.selectedTextStyle
                  : undefined
              }
              onClick={() => setTextStyle("p")}
            >
              <Pilcrow size={16} />
              <span>Text</span>
            </button>
            <button
              type="button"
              className={
                currentTextStyle === "Heading 1"
                  ? styles.selectedTextStyle
                  : undefined
              }
              onClick={() => setTextStyle("h1")}
            >
              <Heading1 size={17} />
              <span>Heading 1</span>
            </button>
            <button
              type="button"
              className={
                currentTextStyle === "Heading 2"
                  ? styles.selectedTextStyle
                  : undefined
              }
              onClick={() => setTextStyle("h2")}
            >
              <Heading2 size={17} />
              <span>Heading 2</span>
            </button>
            <button
              type="button"
              className={
                currentTextStyle === "Heading 3"
                  ? styles.selectedTextStyle
                  : undefined
              }
              onClick={() => setTextStyle("h3")}
            >
              <Heading3 size={17} />
              <span>Heading 3</span>
            </button>
          </div>,
          document.body,
        )}

      {selectionMenu &&
        onRunSelectionTool &&
        createPortal(
          <div
            className={styles.selectionTools}
            style={{ left: selectionMenu.left, top: selectionMenu.top }}
            role="menu"
            aria-label="Run a writing tool on selection"
            onPointerDown={(event) => event.preventDefault()}
          >
            <div>
              {getToolsForContext("document").map((tool) => {
                const ToolIcon = DOCUMENT_TOOL_ICONS[tool.id];
                return (
                  <button
                    key={tool.id}
                    type="button"
                    role="menuitem"
                    aria-label={tool.label}
                    data-tooltip={tool.label}
                    onClick={() => {
                      onRunSelectionTool(tool.id, selectionMenu.text);
                      setSelectionMenu(null);
                    }}
                  >
                    <ToolIcon size={16} />
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={active ? styles.activeFormat : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
