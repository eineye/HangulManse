export default function Loading({ text = "불러오는 중… Loading…" }: { text?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8 text-sm text-forest-700" role="status">
      <span className="mr-2 inline-block size-4 animate-spin rounded-full border-2 border-forest-600 border-t-transparent" />
      {text}
    </div>
  );
}
