'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Quote, Undo, Redo } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, onBlur, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || 'Add notes or description...',
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[180px] p-5 text-sm leading-relaxed text-foreground/80',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="w-full rounded-xl border-2 border-dashed border-muted-foreground/10 bg-muted/20 hover:bg-muted/30 focus-within:bg-background focus-within:border-solid focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5 transition-all duration-300 overflow-hidden bg-[radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] [background-size:24px_24px]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-muted-foreground/10 bg-muted/30">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive('bold') && "bg-primary/10 text-primary"
          )}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive('italic') && "bg-primary/10 text-primary"
          )}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-muted-foreground/20 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive('bulletList') && "bg-primary/10 text-primary"
          )}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive('orderedList') && "bg-primary/10 text-primary"
          )}
          title="Ordered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-muted-foreground/20 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "p-1.5 rounded hover:bg-muted transition-colors",
            editor.isActive('blockquote') && "bg-primary/10 text-primary"
          )}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
