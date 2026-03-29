import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Strikethrough } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onBlur?: () => void;
}

export function RichTextEditor({ content, onChange, onBlur }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Add notes or description...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      if (onBlur) onBlur();
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[150px] p-4 text-[#1a1a1a] prose-p:text-[#1a1a1a] prose-li:text-[#1a1a1a]',
      },
    },
  });

  // Update editor content when prop changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full rounded-2xl border border-border/40 bg-muted/10 focus-within:bg-background focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all duration-300 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border/40 p-2 bg-muted/20">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
            editor.isActive('bold') && "bg-muted text-foreground"
          )}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
            editor.isActive('italic') && "bg-muted text-foreground"
          )}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
            editor.isActive('strike') && "bg-muted text-foreground"
          )}
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-border/40 mx-1" />
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
            editor.isActive('bulletList') && "bg-muted text-foreground"
          )}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
            editor.isActive('orderedList') && "bg-muted text-foreground"
          )}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>
      <EditorContent editor={editor} className="text-[15px] leading-relaxed [&_.ProseMirror]:text-[#1a1a1a] [&_.ProseMirror_p]:text-[#1a1a1a]" />
    </div>
  );
}
