import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ApiError } from "@/api/client";
import { getLetter, listLetterVersions, patchLetter } from "@/api/letters";
import type { TextFragment } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { usePreviewState } from "@/hooks/usePreviewState";
import { useRequest } from "@/hooks/useRequest";
import { formatDate } from "@/lib/format";

type SaveState = "idle" | "saving" | "saved" | "error";

export function LetterEditorPage({ id }: { id: number }) {
  const preview = usePreviewState();
  const { data: letter, error, loading, reload } = useRequest(() => getLetter(id), id);
  const versions = useRequest(() => listLetterVersions(id), `versions-${id}`);

  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (letter) setContent(letter.content);
  }, [letter]);

  if (preview === "loading") return <EditorSkeleton />;

  if (preview === "error" || error) {
    return <ErrorState title="Письмо не найдено" message="Возможно, ссылка устарела." />;
  }

  if (loading || !letter) return <EditorSkeleton />;

  async function handleSave() {
    if (!letter) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      await patchLetter(letter.id, content, letter.version);
      setSaveState("saved");
      reload();
    } catch (saveError) {
      setSaveState("error");
      setSaveError(
        saveError instanceof ApiError ? saveError.message : "Не удалось сохранить письмо",
      );
    }
  }

  return (
    <div className="editor">
      <Card className="editor-card">
        <div className="editor-card__header">
          <h1 className="editor-card__title">Письмо к вакансии</h1>
          <span className="editor-card__version">Версия {letter.version}</span>
        </div>

        <p className="editor-hint">
          Жёлтым выделены утверждения, которых нет в портфолио, — проверьте их перед отправкой.
        </p>

        <HighlightedContent content={content} fragments={letter.unverified} />

        <Textarea
          className="editor-textarea"
          aria-label="Текст письма"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setSaveState("idle");
          }}
        />

        {saveState === "error" && saveError && <Alert tone="error">{saveError}</Alert>}
        {saveState === "saved" && <Alert tone="success">Сохранено</Alert>}

        <div className="editor-actions">
          <Button onClick={handleSave} loading={saveState === "saving"}>
            Сохранить
          </Button>
        </div>
      </Card>

      <Card className="editor-aside">
        <h2 className="editor-aside__title">Версии</h2>
        {versions.loading ? (
          <div style={{ marginTop: 8 }}>
            <Skeleton style={{ height: 56, width: "100%" }} />
          </div>
        ) : (
          <ul className="version-list">
            {versions.data?.items.map((version) => (
              <li key={version.version} className="version-item">
                <div className="version-item__row">
                  <span className="version-item__num">Версия {version.version}</span>
                  <span className="version-item__author">
                    {version.author === "model" ? "Модель" : "Вы"}
                  </span>
                </div>
                <p className="version-item__date">{formatDate(version.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * Подсвечивает непроверенные фрагменты. В примере openapi.yaml текст письма
 * сокращён, поэтому позиции могут выходить за его границы — тогда ищем фрагмент
 * по тексту, чтобы подсветка была видна и на заглушке.
 */
function HighlightedContent({ content, fragments }: { content: string; fragments: TextFragment[] }) {
  const ranges = buildRanges(content, fragments);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) nodes.push(content.slice(cursor, range.start));
    nodes.push(<mark key={range.start}>{content.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));

  return <p className="letter-preview">{nodes}</p>;
}

function buildRanges(content: string, fragments: TextFragment[]) {
  const ranges: Array<{ start: number; end: number }> = [];

  for (const fragment of fragments) {
    if (fragment.start >= 0 && fragment.end <= content.length && fragment.start < fragment.end) {
      ranges.push({ start: fragment.start, end: fragment.end });
    } else {
      const found = content.indexOf(fragment.text);
      if (found >= 0) ranges.push({ start: found, end: found + fragment.text.length });
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function EditorSkeleton() {
  return (
    <div className="editor">
      <Card className="editor-card">
        <Skeleton style={{ height: 24, width: "40%" }} />
        <Skeleton style={{ height: 160, width: "100%", marginTop: 16 }} />
        <Skeleton style={{ height: 40, width: 96, marginTop: 16 }} />
      </Card>
      <Card className="editor-aside">
        <Skeleton style={{ height: 16, width: 64 }} />
        <Skeleton style={{ height: 56, width: "100%", marginTop: 8 }} />
      </Card>
    </div>
  );
}
