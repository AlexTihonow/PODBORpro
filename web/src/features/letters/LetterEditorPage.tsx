import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

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
import { formatDate } from "@/lib/format";

type SaveState = "idle" | "saving" | "saved" | "error";

export function LetterEditorPage() {
  const { id } = useParams();
  const preview = usePreviewState();
  const letterId = Number(id);

  const letterQuery = useQuery({
    queryKey: ["letter", letterId],
    queryFn: () => getLetter(letterId),
    enabled: Number.isFinite(letterId),
  });
  const versionsQuery = useQuery({
    queryKey: ["letter-versions", letterId],
    queryFn: () => listLetterVersions(letterId),
    enabled: Number.isFinite(letterId),
  });

  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (letterQuery.data) setContent(letterQuery.data.content);
  }, [letterQuery.data]);

  if (preview === "loading") return <EditorSkeleton />;

  if (preview === "error" || letterQuery.isError) {
    return <ErrorState title="Письмо не найдено" message="Возможно, ссылка устарела." />;
  }

  if (letterQuery.isLoading || !letterQuery.data) return <EditorSkeleton />;

  const letter = letterQuery.data;

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);
    try {
      await patchLetter(letter.id, content, letter.version);
      setSaveState("saved");
      void letterQuery.refetch();
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof ApiError ? error.message : "Не удалось сохранить письмо");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-ink">Письмо к вакансии</h1>
          <span className="text-xs text-ink-subtle">Версия {letter.version}</span>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm text-ink-muted">
            Жёлтым выделены утверждения, которых нет в портфолио, — проверьте их перед отправкой.
          </p>
          <HighlightedContent content={content} fragments={letter.unverified} />
        </div>

        <Textarea
          className="mt-4 min-h-[200px]"
          aria-label="Текст письма"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setSaveState("idle");
          }}
        />

        {saveState === "error" && saveError && (
          <Alert tone="error" className="mt-3">
            {saveError}
          </Alert>
        )}
        {saveState === "saved" && (
          <Alert tone="success" className="mt-3">
            Сохранено
          </Alert>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} loading={saveState === "saving"}>
            Сохранить
          </Button>
        </div>
      </Card>

      <Card className="h-fit p-4">
        <h2 className="text-sm font-semibold text-ink">Версии</h2>
        {versionsQuery.isLoading ? (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {versionsQuery.data?.items.map((version) => (
              <li key={version.version} className="rounded-lg border border-edge px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">Версия {version.version}</span>
                  <span className="text-ink-subtle">
                    {version.author === "model" ? "Модель" : "Вы"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-subtle">{formatDate(version.created_at)}</p>
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
function HighlightedContent({
  content,
  fragments,
}: {
  content: string;
  fragments: TextFragment[];
}) {
  const ranges = buildRanges(content, fragments);
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) nodes.push(content.slice(cursor, range.start));
    nodes.push(
      <mark key={range.start} className="rounded bg-warning-subtle px-0.5 text-warning">
        {content.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));

  return (
    <p className="whitespace-pre-wrap rounded-lg border border-edge bg-surface-subtle p-3 text-sm leading-relaxed text-ink">
      {nodes}
    </p>
  );
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
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <Card className="space-y-4 p-6">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-24" />
      </Card>
      <Card className="space-y-2 p-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-14 w-full" />
      </Card>
    </div>
  );
}
