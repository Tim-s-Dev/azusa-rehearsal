'use client';

interface DissectionViewerProps {
  markdown: string | null;
}

export default function DissectionViewer({ markdown }: DissectionViewerProps) {
  if (!markdown) return null;

  // Simple markdown renderer for our specific format
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-3xl font-bold mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-xs uppercase tracking-[0.2em] text-violet-400 font-bold mt-6 mb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('---')) {
      elements.push(<div key={i} className="border-t border-white/10 my-4" />);
    } else if (line.startsWith('**')) {
      const text = line.replace(/\*\*(.*?)\*\*/g, '$1');
      elements.push(<p key={i} className="text-sm text-zinc-400">{text}</p>);
    } else if (line.startsWith('`') && line.endsWith('`')) {
      const content = line.slice(1, -1);
      elements.push(
        <div key={i} className="font-mono text-lg tracking-wider bg-zinc-900/50 rounded-xl px-4 py-3 my-1 border border-white/5">
          {content}
        </div>
      );
    } else if (line.startsWith('*') && line.endsWith('*')) {
      elements.push(<p key={i} className="text-xs text-zinc-600 italic mt-4">{line.slice(1, -1)}</p>);
    } else if (line.trim()) {
      elements.push(<p key={i} className="text-sm">{line}</p>);
    } else {
      elements.push(<div key={i} className="h-1" />);
    }
  });

  return <div className="space-y-1">{elements}</div>;
}
