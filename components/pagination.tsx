// app/projects/_components/Pagination.tsx
"use client";

type Props = {
  totalPages: number;
  currentPage: number;
  onChange: (page: number) => void;
};

export function Pagination({ totalPages, currentPage, onChange }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="mt-6 flex items-center justify-center gap-2 text-sm">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="h-8 w-8 rounded-xl border border-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-white/10 transition"
      >
        ‹
      </button>

      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onChange(page)}
          className={[
            "min-w-[32px] h-8 rounded-xl px-2 text-center text-xs font-medium transition",
            page === currentPage
              ? "bg-white text-[#05070B]"
              : "border border-white/10 text-slate-300 hover:bg-white/10",
          ].join(" ")}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="h-8 w-8 rounded-xl border border-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-white/10 transition"
      >
        ›
      </button>
    </div>
  );
}
