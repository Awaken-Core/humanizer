import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Typography from "@tiptap/extension-typography";

export const EMPTY_TIPTAP_DOCUMENT = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function createDocumentExtensions(withEditorUtilities = true) {
  return [
    StarterKit.configure({
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      undoRedo: { depth: 100 },
    }),
    TextStyleKit,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Typography,
    ...(withEditorUtilities
      ? [
          Placeholder.configure({
            placeholder: ({ node }) =>
              node.type.name === "heading"
                ? "Heading"
                : "Start typing or insert using /",
            includeChildren: true,
          }),
          CharacterCount,
        ]
      : []),
  ];
}
